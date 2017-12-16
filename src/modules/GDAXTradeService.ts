import { TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { Order } from '../model/fill';
import { GDAXExchangeAPI, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import { Tendance } from '../model/HistoriqueTic';
import { TendanceService } from './TendanceService';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { GDAXCustomOrderHandleService } from './GDAXCustomOrderHandleService';

export class GDAXTradeService {

    public static _instance: GDAXTradeService;
    private currentPrice: number;
    private lastOrder: Order;
    private options: GDAXFeedConfig;
    private confService: ConfService;
    private tendanceService: TendanceService;
    private currentStopOrder: LiveOrder;
    private customOrder: GDAXCustomOrderHandleService;

    constructor() {
        console.log('Create - GDAXTradeService');
        GDAXTradeService._instance = this;
    }

    public inject(options: GDAXFeedConfig, confService: ConfService, tendanceService: TendanceService, customOrder: GDAXCustomOrderHandleService): void {
        console.log('Inject - GDAXTradeService');
        this.tendanceService = tendanceService;
        this.options = options;
        this.confService = confService;
        this.customOrder = customOrder;

    }

    public init(): void {
        console.log('Init - GDAXTradeService');
        this.currentPrice = 0;

        setInterval(getTendance, this.confService.configurationFile.application.historique.computeDelay);
        // suppression de tous les orders
        this.customOrder.cancelAllOrders();
    }

    /**
     * fonction contenant l'algo de trading.
     * @param {TradeMessage} trade
     */
    public notifyNewTradeMessage(trade: TradeMessage) {
        // console.log('TradeService : receive new tradeMessage');
        // console.log(JSON.stringify(trade));

        // sauvegarde de la derniere valeur du cours
        this.currentPrice = Number(trade.price);

        if (this.lastOrder === undefined) {
            console.log('Aucun ordre en cours. Rien à faire');
        } else {
            this.logBalance();
            const balance = this.getBalance();

            if (this.currentStopOrder === undefined) {
                console.log('Positionnement du premier stop order')
                this.placeStopOrder();
            }

            if (balance > 0) {
                console.log('Court supérieur à l achat, on repositionne le stopOrder');
            } else {
                console.log('Court ingérieur au prix d achat, on positionne le stopOrder a - 2%');
            }
        }
    }

    public newOrderPass(order: Order): void {
        console.log('Receive new order ' + JSON.stringify(order));
        this.lastOrder = order;
    }

    public logBalance(): void {
        if (this.lastOrder !== undefined) {
            const fee = Number(this.lastOrder.fee).toFixed(2)
            this.options.logger.log('info', `COURS EVOL : - achat ${this.lastOrder.price} - fee ${fee} - now ${this.currentPrice} - benefice ${this.getBalance().toFixed(2)}`);
        }
    }

    public notifyOrderFinished() {
        const balance = this.getBalance();
        console.info('ORDER PASSED => gain/perte ' + balance.toFixed(2));
        this.lastOrder = undefined;
    }

    public getTendance(): void {
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

    private getBalance(): number {
        const lastOrderPrice: number = Number(this.lastOrder.price);
        const quantity = Number(this.lastOrder.size);
        const fee = Number(this.lastOrder.fee);

        const prixVente = quantity * this.currentPrice;
        const coutAchat = (quantity * lastOrderPrice) + fee;
        return prixVente - coutAchat;
    }

    private convertTendanceInStr(tendance: Tendance): string {
        return `type: ${tendance.type} => evolutionPrix: ${tendance.evolPrice.toFixed(2)}, pourcentage: ${tendance.evolPourcentage.toFixed(2)}, volume: ${tendance.volumeEchangee.toFixed(2)}`;
    }

    /**
     * Fonction qui positionne un stopOrder a XX% en dessous du court actuel.
     * Le XX% est configurable dans le fichier de configuration
     */
    private placeStopOrder() {
        const poucent = Number(this.confService.configurationFile.application.stoporder.pourcent);
        const stopOrderPrice = this.currentPrice - ((this.currentPrice * poucent) / 100);
        console.log('positionnement d un stopOrder a ' + stopOrderPrice);
    }
}


function getTendance() {
    GDAXTradeService._instance.getTendance();
}