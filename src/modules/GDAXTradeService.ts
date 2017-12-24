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

export class GDAXTradeService {

    public static _instance: GDAXTradeService;
    private currentPrice: number;
    private lastOrder: Order;
    private options: GDAXFeedConfig;
    private confService: ConfService;
    private tendanceService: TendanceService;
    private stopOrderCurrentOrder: LiveOrder;
    private negatifWaitPourcent: number;
    private beneficeMinPoucent: number;
    private beneficeFollowPourcent: number;
    private beneficeMinimumAvantDeplacementStopOrder: number;
    private customOrder: GDAXCustomOrderHandleInterface;
    private accountService: GDAXAccountService;

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
        this.currentPrice = 0;
        this.negatifWaitPourcent = Number(this.confService.configurationFile.application.trader.stoporder.negatifWaitPourcent);
        this.beneficeMinPoucent = Number(this.confService.configurationFile.application.trader.stoporder.beneficeMinPoucent);
        this.beneficeFollowPourcent = Number(this.confService.configurationFile.application.trader.stoporder.beneficeFollowPourcent);
        this.beneficeMinimumAvantDeplacementStopOrder = Number(this.confService.configurationFile.application.trader.stoporder.beneficeMinimumAvantDeplacementStopOrder)


        if (this.confService.configurationFile.application.historique.logTendance === 'true') {
            setInterval(getTendance, this.confService.configurationFile.application.historique.computeDelay);
        }
        setInterval(tradeManHoYeah, 5);
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
    public tradeManHoYeah(): void {
        // si on a pas de cours, on ne fait rien. Sans prix, on ne peut rien faire
        if (this.currentPrice === 0) {
            this.options.logger.log('info', 'en attente d une premiere transaction pour connaitre le cours');
            return;
        }
        // si aucun order en cours, on ne fait rien. On verra dans la V2
        if (this.lastOrder === undefined) {
            // on va verifier si on a pas encore des coins.
            if (this.accountService.btc > 0) {
                console.log('Des coins dans le panier ' + this.accountService.btc.toFixed(4) + ', on va rechercher l ordre');
                this.customOrder.getLastBuyFill().then((order) => this.newOrderPass(order));
            } else {
                // si oui, on demande au customeOrder le dernier montant d'achat
                this.options.logger.log('info', 'Aucun ordre en cours. Rien à faire');
            }
            return;
        }

        // il est possible qu'il n'y ait aucun stop order à ce moment. Si au debut on a pas pu le mettre car le court est vraiment tres tres bas
        this.logBalance();

        // affichage du status en cours
        if (this.stopOrderCurrentOrder === undefined) {
            const stopPrice = this.calculateStopOrderPrice(this.currentPrice, this.negatifWaitPourcent);
            this.placeStopOrder(stopPrice);
            return;
        }

        // l'algo est le suivant :
        const getEvolPourcent = this.calculatePourcentEvolution(this.currentPrice);
        const currentStopOrderPrice = Number(this.stopOrderCurrentOrder.price);

        // on fait des benefices, on regarde si le stopOrder est bien positionné.
        if (getEvolPourcent <= this.beneficeMinimumAvantDeplacementStopOrder) {
            const coursRequisPourBenefice = Number(this.lastOrder.price) + (Number(this.lastOrder.price) * this.beneficeMinimumAvantDeplacementStopOrder / 100);
            this.options.logger.log('info', 'Benefice inferieur a ' + this.beneficeMinimumAvantDeplacementStopOrder + '%, on laisse le stoporder a ' + currentStopOrderPrice.toFixed(2) + ' cours requis : ' + coursRequisPourBenefice);
        } else {
            const lastOrderPrice = Number(this.lastOrder.price);

            if (currentStopOrderPrice < lastOrderPrice) {
                const stopPrice = this.calculateStopOrderPrice(this.currentPrice, this.beneficeMinPoucent);
                console.log('On positionne le stopOrder pour faire du benefice a ' + stopPrice);
                this.placeStopOrder(stopPrice);
                return;

            }
            // on est dans les benefices et on a le stop order deja positionne pour assurer notre argent.
            // on fait donc monter le stop en fonction de la hausse de la courbe
            const newStopOrderPrice = this.calculateStopOrderPrice(this.currentPrice, this.beneficeFollowPourcent);

            if (newStopOrderPrice <= currentStopOrderPrice) {
                this.options.logger.log('info', 'Cours en chute, on ne repositionne pas le stopOrder qui est a ' + currentStopOrderPrice);
            } else {
                this.placeStopOrder(newStopOrderPrice);
                return;
            }
        }
    }

    public notifyNewTradeMessage(trade: TradeMessage) {
        // sauvegarde de la derniere valeur du cours
        this.currentPrice = Number(trade.price);
    }

    public newOrderPass(order: Order): void {
        console.log('Receive new order ' + JSON.stringify(order));
        // refresh du compte utilisateur
        this.accountService.loadBalance();
        this.lastOrder = order;
    }

    public logBalance(): void {
        if (this.lastOrder !== undefined) {
            const fee = Number(this.lastOrder.fee).toFixed(2);
            const achatPrice = Number(this.lastOrder.price).toFixed(2);
            this.options.logger.log('info', `COURS EVOL : - achat ${achatPrice} - fee ${fee} - now ${this.currentPrice} - benefice ${this.getBalance(this.currentPrice).toFixed(2)} - evolution ${this.calculatePourcentEvolution(this.currentPrice).toFixed(2)}`);
        }
    }

    public notifyOrderFinished(order: TradeExecutedMessage) {
        // TODO : recevoir ici l'order et voir ce qu'on a gagné / perdu
        if (order.side === 'buy') {
            console.log('New order BUY - passage en mode VENTE');
            this.customOrder.getLastBuyFill()
                .then((newOrder) => this.newOrderPass(newOrder));
        }

        if (order.side === 'sell') {
            console.log('Reception d un ordre de VENTE');
            const balance = this.getBalance(Number(order.price));
            console.info('ORDER PASSED => gain/perte ' + balance.toFixed(2) + ' evolution : ' + this.calculatePourcentEvolution(Number(order.price)));
            this.lastOrder = undefined;                 // on enleve le lastOrder
            this.stopOrderCurrentOrder = undefined;     // on enleve le stopOrder
            this.accountService.changeBtc(0);   // on force à zero
            this.accountService.loadBalance();          // reload de la balance
        }
    }

    public getTendance(): void {
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
    public placeStopOrder(price: number) {
        // si un stop order est deja present, il faut le supprimer
        if (this.stopOrderCurrentOrder !== undefined) {
            this.customOrder.cancelOrder(this.stopOrderCurrentOrder.id)
                .then((a) => delay(1000))
                .then((value) => {
                    this.stopOrderCurrentOrder = undefined;
                    this.createStopOrder(price);
                });
        } else {
            this.createStopOrder(price);
        }
    }

    public createStopOrder(price: number) {
        this.customOrder.placeStopSellOrder(price, this.accountService.btc).then((liveOrder) => {
            this.stopOrderCurrentOrder = liveOrder;
        }).catch((reason) => {
            console.log('impossible de creer le liveOrder... Bizarre ' + JSON.stringify(reason));
            this.stopOrderCurrentOrder = undefined;
            logError(reason);
        });
    }

    public calculateStopOrderPrice(price: number, pourcent: number): number {
        return price - ((price * pourcent) / 100);
    }

    private calculatePourcentEvolution(price: number): number {
        return ((price * 100) / Number(this.lastOrder.price)) - 100;
    }
}

function getTendance() {
    GDAXTradeService._instance.getTendance();
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
    GDAXTradeService._instance.tradeManHoYeah();
}
