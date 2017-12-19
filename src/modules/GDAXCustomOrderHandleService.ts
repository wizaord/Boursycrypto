import { Fill, GDAXFill } from '../model/fill';
import { GDAXExchangeAPI, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { GDAXTradeService } from './GDAXTradeService';
import { MyOrderPlacedMessage, PlaceOrderMessage, TradeExecutedMessage, TradeFinalizedMessage, Trader, TraderConfig } from 'gdax-trading-toolkit/build/src/core';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import * as BigNumber from 'bignumber.js';
import { delay } from 'gdax-trading-toolkit/build/src/utils/promises';
import { GDAXCustomOrderHandleInterface } from './IGDAXCustomOrderHandleService';

export class GDAXCustomOrderHandleService implements GDAXCustomOrderHandleInterface {
    trader: Trader;
    private gdaxExchangeApi: GDAXExchangeAPI;
    private options: GDAXFeedConfig;
    private confService: ConfService;
    private gdaxTradeService: GDAXTradeService;

    constructor() {
        console.log('Create - GDAXCustomOrderHandleService');

    }

    public inject(optionsP: GDAXFeedConfig, confService: ConfService, gdaxTradeService: GDAXTradeService, feed: GDAXFeed, gdaxExchangeApi: GDAXExchangeAPI): void {
        console.log('Inject - GDAXCustomOrderHandleService');
        this.options = optionsP;
        this.confService = confService;
        this.gdaxExchangeApi = gdaxExchangeApi;
        this.gdaxTradeService = gdaxTradeService;

        const traderConfig: TraderConfig = {
            logger: this.options.logger,
            productId: this.confService.configurationFile.application.product.name,
            exchangeAPI: feed.authenticatedAPI,
            fitOrders: false
        };

        this.trader = new Trader(traderConfig);

    }

    public init(): void {
        console.log('Init - GDAXCustomOrderHandleService');
        this.cancelAllOrders()
            .then((a) => delay(3000))
            .then((b) => this.loadLastFill())
            .then((fill) => {
                if (fill.side === 'buy') {
                    // le dernier point est un achat. On envoie donc comme s'il venait de passer
                    console.log('INIT - Le dernier ordre est une commande. Prise en compte par le programme');
                    this.gdaxTradeService.newOrderPass({
                        id: fill.order_id,
                        price: fill.price,
                        side: fill.side,
                        fee: fill.fee,
                        size: fill.size,
                        time: fill.created_at,
                        status: 'open',
                    });
                }
            });


        this.trader.on('Trader.order-placed', (msg: LiveOrder) => {
            this.options.logger.log('info', 'Order placed', JSON.stringify(msg));
        });
        this.trader.on('Trader.trade-executed', (msg: TradeExecutedMessage) => {
            this.options.logger.log('info', 'Trade executed', JSON.stringify(msg));
            // lorsque la vente d'un ordre a eu lieu
            this.gdaxTradeService.notifyOrderFinished();
        });
        this.trader.on('Trader.trade-finalized', (msg: TradeFinalizedMessage) => {
            this.options.logger.log('info', 'Order complete', JSON.stringify(msg));
        });
        this.trader.on('Trader.my-orders-cancelled', (ids: string[]) => {
            this.options.logger.log('info', `${ids.length} orders cancelled`);
        });
        this.trader.on('Trader.external-order-placement', (msg: MyOrderPlacedMessage) => {
            this.options.logger.log('info', 'orders manually placed', JSON.stringify(msg));
        });

        this.trader.on('error', (err: Error) => {
            this.options.logger.log('error', 'Error cancelling orders', err);
        });

    }

    public loadLastFill(): Promise<Fill> {
        const apiCall = this.gdaxExchangeApi.authCall('GET', `/fills`, {});
        return Promise.resolve(this.gdaxExchangeApi.handleResponse<Fill[]>(apiCall, null).then((fills: GDAXFill[]) => {
            // on ne prend que l'ordre le plus recent

            return fills.filter((f) => f.product_id === this.confService.configurationFile.application.product.name)
                .sort((a, b) => {
                    return (a.trade_id - b.trade_id) * -1;
                })
                .map((value) => {
                    const customFill: Fill = {
                        created_at: value.created_at,
                        order_id: value.order_id,
                        trade_id: value.trade_id,
                        side: value.side,
                        price: value.price,
                        fee: value.fee,
                        size: value.size
                    };
                    return customFill;
                })[0];
        }).catch((reason) => {
            logError(reason);
            return null;
        }));
    }

    public cancelAllOrders(): Promise<boolean> {
        console.log('called cancel all orders');
        return Promise.resolve(this.trader.checkState()
            .then((value) => this.gdaxExchangeApi.loadAllOrders(this.confService.configurationFile.application.product.name))
            .then((orders) => {
                orders.forEach((order) => {
                    this.cancelOrder(order.id).then((value) => console.log('successfully deleted'));
                });
                return true;
            })).catch((reason) => {
            return logError(reason);
        });
    }

    public cancelOrder(orderId: string): Promise<boolean> {
        return Promise.resolve(this.gdaxExchangeApi.cancelOrder(orderId).then((result: string) => {
            console.log('Order with ID : ' + result + ' has been successfully cancelled');
            return true;
        }).catch(logError));
    }

    public placeStopOrder(priceP: number, nbCoin: string): Promise<LiveOrder> {
        const myOrder: PlaceOrderMessage = {
            type: 'placeOrder',
            orderType: 'stop',
            side: 'sell',
            productId: this.confService.configurationFile.application.product.name,
            price: priceP.toFixed(8),
            size: nbCoin,
            time: new Date()
        };
        console.log('positionnement d un stopOrder a ' + priceP + ' pour ' + nbCoin + ' coins');
        // console.log(JSON.stringify(myOrder));
        return this.trader.placeOrder(myOrder).then((order) => {
            // console.log('Live order post : ' + JSON.stringify(order));
            order.price = new BigNumber(priceP.toFixed(10));
            return Promise.resolve(order);
        }).catch((reason) => {
            console.log('Unable to place an order');
            logError(reason);
            return Promise.reject(reason);
        });
    }
}

function logError(err: any): boolean {
    console.error(printSeparator());
    console.error('Error: ' + err.message);
    if (err && (err.response && err.response.error)) {
        console.error(err.response.error.message);
    }
    console.error(printSeparator());
    return false;
}
