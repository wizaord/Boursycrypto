import { TradeExecutedMessage, TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { Order } from '../model/fill';
import { GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import { Tendance } from '../model/HistoriqueTic';
import { TendanceService } from './TendanceService';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { GDAXAccountService } from './GDAXAccountService';
import { delay } from 'gdax-trading-toolkit/build/src/utils/promises';
import { GDAXCustomOrderHandleInterface } from './IGDAXCustomOrderHandleService';
import MathUtils from '../utilities/MathUtils';
import { E_TRADEMODE, E_TRADESELLMODE } from './E_TRADEMODE';
import { SlackService } from '../services/SlackService';

export class GDAXTradeService {
    public static _instance: GDAXTradeService;

    private currentPrice: number;
    private lastOrder: Order;
    private options: GDAXFeedConfig;
    private confService: ConfService;
    private tendanceService: TendanceService;
    private stopOrderCurrentOrder: LiveOrder;
    private customOrder: GDAXCustomOrderHandleInterface;
    private accountService: GDAXAccountService;
    private traderMode: E_TRADEMODE;

    private pourcentBeforeStartVenteMode: number;

    private pourcentBeforeStartAchatMode: number;
    private negatifWaitPourcent: number;
    private beneficeMinPoucent: number;
    private activateSecureVenteMode: boolean;
    private beneficeFollowPourcent: number;

    private lastBuyMessageSend: Date;

    constructor() {
        console.log('Create - GDAXTradeService');
        GDAXTradeService._instance = this;
    }

    public inject(options: GDAXFeedConfig, confService: ConfService, tendanceService: TendanceService, customOrder: GDAXCustomOrderHandleInterface, accountService: GDAXAccountService): void {
        console.log('Inject - GDAXTradeService');
        this.accountService = accountService;
        this.tendanceService = tendanceService;
        this.options = options;
        this.confService = confService;
        this.customOrder = customOrder;
    }

    public init(): void {
        console.log('Init - GDAXTradeService');
        this.traderMode = E_TRADEMODE.NOORDER;
        this.currentPrice = 0;
        this.negatifWaitPourcent = Number(this.confService.configurationFile.application.trader.vente.secureStopOrder.pourcent);
        this.pourcentBeforeStartVenteMode = Number(this.confService.configurationFile.application.trader.vente.benefice.pourcentBeforeStartVenteMode);
        this.activateSecureVenteMode = Boolean(this.confService.configurationFile.application.trader.vente.secureStopOrder.activate);
        this.beneficeMinPoucent = Number(this.confService.configurationFile.application.trader.vente.benefice.initialPourcent);
        this.beneficeFollowPourcent = Number(this.confService.configurationFile.application.trader.vente.benefice.followingPourcent);
        this.pourcentBeforeStartAchatMode = Number(this.confService.configurationFile.application.trader.achat.pourcentageChuteCoursStopOrder);


        if (Boolean(this.confService.configurationFile.application.historique.logTendance)) {
            setInterval(getTendance, this.confService.configurationFile.application.historique.computeDelay);
        }
        setInterval(tradeManHoYeah, 10000);
    }


    /**
     * Algo mis en place.
     * Si pas encore de cours sur le prix, on ne fait rien
     * Si on est pas en mode VENTE, on ne fait rien
     * Si on est en mode VENTE
     *  - on regarde si un stopOrder est positionné. Si non, on le positionne a XX% en dessous du prix en cours (possible si lors du demarrage de l'application, le cours est tellement bas qu'on ne peut pas mettre le stopOrder)
     *  - on calcule la balance et on l'affiche
     *  - si on est en deficite, on ne change pas le stop order
     *  - si on est en bénéfice, on positionne le stopOrder juste pour gagner de l'argent
     *      - et ensuite on fait monter ce stopOrder en fonction de la courbe
     */
    public doTrading(): void {
        // si on a pas de cours, on ne fait rien. Sans prix, on ne peut rien faire
        if (this.currentPrice === 0) {
            this.options.logger.log('info', 'en attente d une premiere transaction pour connaitre le cours');
            return;
        }

        switch (this.traderMode) {
            case E_TRADEMODE.NOORDER:
                this.options.logger.log('info', 'MODE UNKNOWN- determination du mode de fonctionnement');
                this.determineTradeMode();
                break;
            case E_TRADEMODE.ACHAT:
                this.options.logger.log('info', 'MODE ACHAT - cours ' + this.currentPrice.toFixed(2));
                this.doTradingBuy();
                break;
            case E_TRADEMODE.VENTE:
                this.logVenteEvolution();
                if (! Boolean(this.confService.configurationFile.application.trader.modeVisualisation)) {
                    this.options.logger.log('info', 'MODE VENTE');
                    this.doTradingSell();
                }
                break;
        }
    }

    public notifyNewTradeMessage(trade: TradeMessage) {
        this.currentPrice = Number(trade.price);
    }

    public notifyNewOrder(order: Order): void {
        this.options.logger.log('info', 'NEW ORDER - Receive order ' + JSON.stringify(order));
        SlackService._instance.postMessage('NEW ORDER - Handle order ' + JSON.stringify(order));
        this.accountService.loadBalance();
        this.lastOrder = order;
        this.traderMode = E_TRADEMODE.VENTE;
    }

    public logVenteEvolution(): void {
        const fee = MathUtils.convertBigJSInStr(this.lastOrder.fee, 2);
        const achatPrice = MathUtils.convertBigJSInStr(this.lastOrder.price, 2);
        const evolution = MathUtils.calculatePourcentDifference(this.currentPrice, Number(this.lastOrder.price));

        let message: string = `COURS EVOL : - achat ${achatPrice} - fee ${fee} - now ${this.currentPrice}`;
        message = `${message} - benefice ${this.getBalance(this.currentPrice).toFixed(2)} - evolution ${evolution.toFixed(2)}`;
        this.options.logger.log('info', message);
    }

    public notifyOrderFinished(order: TradeExecutedMessage) {
        // TODO : recevoir ici l'order et voir ce qu'on a gagné / perdu
        if (order.side === 'buy') {
            console.log('New order BUY - passage en mode VENTE');
            this.customOrder.getLastBuyFill()
                .then((newOrder) => this.notifyNewOrder(newOrder));
        }

        if (order.side === 'sell') {
            const balance = this.getBalance(Number(order.price));
            const messageStr = 'ORDER PASSED => gain/perte ' + balance.toFixed(2) + ' evol: ' + MathUtils.calculatePourcentDifference(Number(order.price), Number(this.lastOrder.price));

            this.options.logger.log('info', messageStr);
            SlackService._instance.postMessage(messageStr);

            this.accountService.changeBtc(0);   // on force à zero
            this.accountService.loadBalance();          // reload de la balance
            this.stopOrderCurrentOrder = undefined;
            this.traderMode = E_TRADEMODE.NOORDER;
        }
    }

    public tendanceLog(): void {
        if (this.currentPrice === 0) {
            console.log('Toujours pas recu de trade. Pas de possibilite d afficher la tendance');
            return;
        }
        // calcul des tendances
        const tendance2min = this.tendanceService.getLast2MinutesTendances();
        const tendance10min = this.tendanceService.getLast10MinutesTendances();
        const tendance30min = this.tendanceService.getLast30MinutesTendances();
        const tendance60min = this.tendanceService.getLast60MinutesTendances();

        console.log(printSeparator());
        console.log('Date : ' + new Date());
        console.log('Cours now : ' + JSON.stringify(this.tendanceService.computeLst.last()));
        console.log('Tendance 2 minutes  : ' + this.convertTendanceInStr(tendance2min));
        console.log('Tendance 10 minutes : ' + this.convertTendanceInStr(tendance10min));
        console.log('Tendance 30 minutes : ' + this.convertTendanceInStr(tendance30min));
        console.log('Tendance 60 minutes : ' + this.convertTendanceInStr(tendance60min));
        console.log(printSeparator());
    }

    public getBalance(currentPrice: number): number {
        const lastOrderPrice: number = Number(this.lastOrder.price);
        const quantity = Number(this.lastOrder.size);
        const feeAchat = Number(this.lastOrder.fee);
        const feeVente = quantity * currentPrice * 0.0025;

        const prixVente = (quantity * currentPrice) - feeVente;
        const coutAchat = (quantity * lastOrderPrice) + feeAchat;
        return prixVente - coutAchat;
    }

    public convertTendanceInStr(tendance: Tendance): string {
        return `type: ${tendance.type} => evolutionPrix: ${tendance.evolPrice.toFixed(2)}, pourcentage: ${tendance.evolPourcentage.toFixed(2)}, volume: ${tendance.volumeEchangee.toFixed(2)}`;
    }

    /**
     * Fonction qui positionne un stopOrder a XX% en dessous du court actuel.
     * Le XX% est configurable dans le fichier de configuration
     */
    public stopOrderPlace(price: number) {
        // si un stop order est deja present, il faut le supprimer
        if (this.stopOrderCurrentOrder !== undefined) {
            this.customOrder.cancelOrder(this.stopOrderCurrentOrder.id)
                .then(() => delay(1000))
                .then(() => {
                    this.stopOrderCurrentOrder = undefined;
                    this.stopOrderCreate(price);
                });
        } else {
            this.stopOrderCreate(price);
        }
    }

    public stopOrderCreate(price: number) {
        this.customOrder.placeStopSellOrder(price, this.accountService.btc).then((liveOrder) => {
            this.stopOrderCurrentOrder = liveOrder;
        }).catch((reason) => {
            console.log('impossible de creer le liveOrder... Bizarre ' + JSON.stringify(reason));
            this.stopOrderCurrentOrder = undefined;
            logError(reason);
        });
    }


    /**
     * Fonction qui permet de determiner dans quel mode de fonctionnement on se trouve
     */
    private determineTradeMode() {
        // this.traderMode = E_TRADEMODE.ACHAT;
        // on va verifier si on a pas encore des coins.
        if (this.accountService.btc > 0) {
            this.options.logger.log('info', 'CHECK MODE - coin in wallet <' + this.accountService.btc.toFixed(4) + '>. Looking for last buy order');
            this.customOrder.getLastBuyFill().then((order) => {
                this.options.logger.log('info', 'CHECK MODE - Find last order buy. Inject order in this AWESOME project');
                this.notifyNewOrder(order);
            });
        } else {
            this.options.logger.log('info', 'CHECK MODE - No Btc in wallet. Set en ACHAT MODE');
            this.traderMode = E_TRADEMODE.ACHAT;
        }
    }

    /**
     * realisation du trading en mode VENTE
     */
    private doTradingSell() {
        const isStopOrderPlaced = this.stopOrderCurrentOrder === undefined;

        // positionnement du stop order de secours si activé dans les logs
        if (this.activateSecureVenteMode && isStopOrderPlaced) {
            const stopPrice = MathUtils.calculateRemovePourcent(this.currentPrice, this.negatifWaitPourcent);
            this.options.logger.log('info', `MODE VENTE - Place a SECURE stop order to ${stopPrice}`);
            this.stopOrderPlace(stopPrice);
            return;
        }

        // on verifie si on est deja en benefice ou non
        //      - possible si stopOrder n'existe pas              et benefice supérieur à la valeur configurée dans le fichier de configuration
        //      - possible si stopOrder inférieur au prix d'achat et benefice supérieur à la valeur configurée dans le fichier de configuration
        //      - possible si le prix du stopOrder est supérieur au prix d'achat => deja en mode benefice
        const sellMode = this.determineTradeSellMode();
        switch (sellMode) {
            case E_TRADESELLMODE.WAITING_FOR_BENEFICE:
                const coursRequisPourBenefice = MathUtils.calculateAddPourcent(Number(this.lastOrder.price), this.pourcentBeforeStartVenteMode);
                this.options.logger.log('info', 'MODE VENTE - Not enougth benef. Waiting benefice to : ' + coursRequisPourBenefice);
                break;
            case E_TRADESELLMODE.BENEFICE:
                this.options.logger.log('info', 'MODE VENTE - Benefice OK');
                this.doTradingSellBenefice();
                break;
        }
    }

    /**
     * Fonction de gestion quand on est en mode vente et BENEFICE
     * Si le stopOrder n'est pas positionné ou inférieur au prix du lastOrderPrice, on le position au seuil minimal
     * Ensuite on fait monter ce stopOrder en fonction du cours
     */
    private doTradingSellBenefice() {
        const lastOrderPrice = Number(this.lastOrder.price);
        const seuilStopPrice = MathUtils.calculateAddPourcent(lastOrderPrice, this.beneficeMinPoucent);
        const isStopOrderPlaced = (this.stopOrderCurrentOrder !== undefined);

        // test si aucun stop order n'est positionné
        if (!isStopOrderPlaced) {
            // positionnement d'un stop order au prix seuil
            this.stopOrderPlace(seuilStopPrice);
            return;
        }

        const currentStopOrderPrice = Number(this.stopOrderCurrentOrder.price);

        // test si le stop order est le stop de secours
        if (isStopOrderPlaced && currentStopOrderPrice < lastOrderPrice) {
            this.stopOrderPlace(seuilStopPrice);
            return;
        }

        // on est dans les benefices et on a le stop order deja positionne pour assurer notre argent.
        // on fait donc monter le stop en fonction de la hausse de la courbe
        const newStopOrderPrice = MathUtils.calculateRemovePourcent(this.currentPrice, this.beneficeFollowPourcent);

        if (newStopOrderPrice <= currentStopOrderPrice) {
            this.options.logger.log('info', 'Cours en chute, on ne repositionne pas le stopOrder qui est a ' + currentStopOrderPrice);
        } else {
            this.stopOrderPlace(newStopOrderPrice);
            return;
        }
    }

    /**
     * Fonction qui détermine le mode de vente. Soit en benefice et on suit la courbe. Soit en mode attente
     * En mode benefice et on suit la courbe si :
     *      - possible si stopOrder n'existe pas              et benefice supérieur à la valeur configurée dans le fichier de configuration
     *      - possible si stopOrder inférieur au prix d'achat et benefice supérieur à la valeur configurée dans le fichier de configuration
     *      - possible si le prix du stopOrder est supérieur au prix d'achat => deja en mode benefice
     * @returns {E_TRADESELLMODE}
     */
    private determineTradeSellMode(): E_TRADESELLMODE {
        const coursRequisPourBenefice = MathUtils.calculateAddPourcent(Number(this.lastOrder.price), this.pourcentBeforeStartVenteMode);
        const lastOrderPrice = Number(this.lastOrder.price);
        const isStopOrderPlaced = (this.stopOrderCurrentOrder !== undefined);

        if (isStopOrderPlaced) {
            const stopOrderPrice = Number(this.stopOrderCurrentOrder.price);
            if (stopOrderPrice > lastOrderPrice) {
                // on est dans le cas où on a déjà été en BENEFICE. On y reste
                return E_TRADESELLMODE.BENEFICE;
            }
        }
        // le stop order est posé ou pas. On est en bénéfice uniquement si le cours le permet
        if (this.currentPrice >= coursRequisPourBenefice) {
            return E_TRADESELLMODE.BENEFICE;
        }
        // on a pas engendré assez de bénéfices
        return E_TRADESELLMODE.WAITING_FOR_BENEFICE;
    }

    /**
     * Fonction qui permet de déterminer le moment où il faut acheter
     */
    private doTradingBuy() {
        // on regarde les tendances sur les dernières minutes,
        // Si elles sont toutes baissière et que la dernière est une grosse chute > 2% (sur la minutes)
        // on positionne un stopOrder d'achat
        // et on suit la courbe baissière
        const everyMinutesTendances = this.tendanceService.getLastEveryMinutesTendances(15);
        this.options.logger.log('info', 'Retrieve ' + everyMinutesTendances.length + ' tendances');
        this.tendanceAchatLog(everyMinutesTendances);

        let lookingForBuy = false;
        let cumulEvolutionNegative = 0;

        while (everyMinutesTendances.length !== 0 && !lookingForBuy) {
            const tendance = everyMinutesTendances.shift();
            if (tendance.evolPourcentage < 0.3) {
                // on cumule l'evolution
                cumulEvolutionNegative += tendance.evolPourcentage;
            } else {
                // on arrete tout
                break;
            }

            // si l'evolution est negative à XX pourcent on remonte une alerte
            if (cumulEvolutionNegative <= this.pourcentBeforeStartAchatMode) {
                lookingForBuy = true;
            }
        }

        // reinit du message si plus de 10 minutes
        if (this.lastBuyMessageSend !== undefined) {
            const dateInMs = this.lastBuyMessageSend.getTime();
            const currentDate = new Date();
            const currentDateInMs = currentDate.getTime();
            // si le temps est superieur a 10 minutes, on reinitialise le tout
            if ((currentDateInMs - dateInMs) > 600000) {
                this.lastBuyMessageSend = undefined;
            }
        }

        if (lookingForBuy && this.lastBuyMessageSend === undefined) {
            this.lastBuyMessageSend = new Date();
            SlackService._instance.postMessage('CHECK FOR ACHAT - Baisse du cours de ' + cumulEvolutionNegative.toFixed(2));
        }

    }

    private tendanceAchatLog(tendances: Tendance[]): void {
        tendances.forEach((tendance) => {
            console.log('TENDANCE - Date : ' + tendance.endDate.getMinutes() + ' average: ' + tendance.averagePrice.toFixed(2) + ' prix: ' + tendance.evolPrice.toFixed(2) + ' %:' + tendance.evolPourcentage.toFixed(2));
        });
    }
}

function getTendance() {
    GDAXTradeService._instance.tendanceLog();
}

function logError(err: any) {
    console.error(printSeparator());
    console.error('Error: ' + err.message);
    if (err && (err.response && err.response.error)) {
        console.error(err.response.error.message);
    }
    console.error(printSeparator());
}

function tradeManHoYeah() {
    GDAXTradeService._instance.doTrading();
}
