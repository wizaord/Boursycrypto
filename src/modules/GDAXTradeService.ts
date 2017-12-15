import { TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { BigJS } from 'gdax-trading-toolkit/build/src/lib/types';
import * as BigNumber from 'bignumber.js';
import { Order } from '../model/fill';
import { GDAXExchangeAPI, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import { Tendance } from '../model/HistoriqueTic';
import { TendanceService } from './TendanceService';

export class GDAXTradeService {

    public static _instance: GDAXTradeService;
    private currentPrice: BigJS;
    private lastOrder: Order;
    private options: GDAXFeedConfig;
    private gdaxExchangeApi: GDAXExchangeAPI;
    private confService: ConfService;
    private tendanceService: TendanceService;
    // private currentStopOrder: LiveOrder;

    constructor() {
        console.log('Create - GDAXTradeService');
        GDAXTradeService._instance = this;
    }

    public inject(options: GDAXFeedConfig, confService: ConfService, tendanceService: TendanceService): void {
        console.log('Inject - GDAXTradeService');
        this.tendanceService = tendanceService;
        this.options = options;
        this.confService = confService;

    }

    public init(): void {
        console.log('Init - GDAXTradeService');
        this.gdaxExchangeApi = new GDAXExchangeAPI(this.options);
        this.currentPrice = new BigNumber(0);

        setInterval(getTendance, this.confService.configurationFile.application.historique.computeDelay);
        // suppression de tous les orders
        this.cancelAllOrders();
    }

    /**
     * fonction contenant l'algo de trading.
     * @param {TradeMessage} trade
     */
    public notifyNewTradeMessage(trade: TradeMessage) {
        // console.log('TradeService : receive new tradeMessage');
        // console.log(JSON.stringify(trade));

        // sauvegarde de la derniere valeur du cours
        this.currentPrice = new BigNumber(trade.price);

        if (this.lastOrder === undefined) {
            console.log('Aucun ordre en cours. Rien à faire');
        } else {
            this.logBalance();
        //     const benefice = this.lastOrder.price.toNumber() - this.currentPrice.toNumber();
        //     if (benefice > 0) {
        //         console.log('Court supérieur à l achat, on repositionne le stopOrder');
        //     } else {
        //         console.log('Court ingérieur au prix d achat, on positionne le stopOrder a - 2%');
        //     }
        }
    }

    public newOrderPass(order: Order): void {
        console.log('Receive new order ' + JSON.stringify(order));
        this.lastOrder = order;
    }

    public logBalance(): void {
        if (this.lastOrder !== undefined) {
            const fee = Number(this.lastOrder.fee).toFixed(2)
            this.options.logger.log('info', `COURS EVOL : now ${this.currentPrice} - order price ${this.lastOrder.price} - fee ${fee} - benefice ${this.getBalance().toFixed(2)}`);
        }
    }

    public cancelAllOrders(): void {
        console.log('called cancel all orders');
        this.gdaxExchangeApi.loadAllOrders(this.confService.configurationFile.application.product.name).then((orders) => {
            orders.forEach((order) => {
                this.cancelOrder(order.id);
            });
        });
    }

    public cancelOrder(orderId: string): void {
        console.log('Cancel order with ID :' + orderId);
        this.gdaxExchangeApi.cancelOrder(orderId).then((result: string) => {
            console.log('Order with ID : ' + result + ' has been successfully cancelled');
        }).catch(logError);
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

        const prixVente = quantity * Number(this.currentPrice);
        const coutAchat = (quantity * lastOrderPrice) + fee;
        return prixVente - coutAchat;
    }

    private convertTendanceInStr(tendance: Tendance): string {
        return `type: ${tendance.type} => evolutionPrix: ${tendance.evolPrice.toFixed(2)}, pourcentage: ${tendance.evolPourcentage.toFixed(2)}, volume: ${tendance.volumeEchangee.toFixed(2)}`;
    }
}

function logError(err: any) {
    console.error(printSeparator());
    console.error('Error: ' + err.message);
    if (err && (err.response && err.response.error)) {
        console.error(err.response.error.message);
    }
    console.error(printSeparator());
}

function getTendance() {
    GDAXTradeService._instance.getTendance();
}