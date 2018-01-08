import { Fill, GDAXFill, GDAXOrder, Order } from '../model/fill';
import { GDAXExchangeAPI, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { GDAXTradeService } from './GDAXTradeService';
import { MyOrderPlacedMessage, PlaceOrderMessage, TradeExecutedMessage, TradeFinalizedMessage, Trader, TraderConfig } from 'gdax-trading-toolkit/build/src/core';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import * as BigNumber from 'bignumber.js';
import { delay } from 'gdax-trading-toolkit/build/src/utils/promises';
import { GDAXCustomOrderHandleInterface } from './IGDAXCustomOrderHandleService';
import { SlackService } from '../services/SlackService';

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
            fitOrders: false,
            pricePrecision: 2,
            sizePrecision: 8
        };

        this.trader = new Trader(traderConfig);

    }

    public init(): void {
        console.log('Init - GDAXCustomOrderHandleService');
        this.loadOrders()
            .then((orders: GDAXOrder[]) => {
                const cleanPreviousOrder = Boolean(this.confService.configurationFile.application.trader.vente.start.cleanCurrentOrder);
                // si on est en mode delete old placeOrder, on supprime l'ancien stop.
                // sinon on le recupere
                if (cleanPreviousOrder) {
                    return this.cancelAllOrders();
                } else if (orders !== undefined && orders.length !== 0) {
                    const order = orders[0];
                    const stopOrder: LiveOrder = {
                        id: order.id,
                        price: order.price,
                        productId: order.product_id,
                        side: order.side,
                        size: order.size,
                        status: order.status,
                        time: order.create_at,
                        extra: null
                    };
                    this.gdaxTradeService.notifyStopOrder(stopOrder);
                }
                return Promise.resolve(null);
            })
            .then(() => delay(3000))
            .then(() => this.loadFills())
            .then((fills) => Promise.resolve(fills[0]))
            .then((fill) => {
                if (fill.side === 'buy') {
                    // le dernier point est un achat. On envoie donc comme s'il venait de passer
                    console.log('INIT - Le dernier ordre est une commande. Prise en compte par le programme');
                    this.gdaxTradeService.notifyNewOrder(this.mapFillInOrder(fill));
                }
            });

        this.trader.on('Trader.order-placed', (msg: LiveOrder) => {
            this.options.logger.log('info', 'Order placed', JSON.stringify(msg));
        });
        this.trader.on('Trader.trade-executed', (msg: TradeExecutedMessage) => {
            this.options.logger.log('info', 'Trade executed', JSON.stringify(msg));
            // lorsque la vente d'un ordre a eu lieu
            this.gdaxTradeService.notifyOrderFinished(msg);
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

    getLastBuyFill(): Promise<Order> {
        return this.loadFills()
            .then((fills) => {
                return Promise.resolve(fills.filter((value) => value.side === 'buy')[0]);
            }).then((fill) => Promise.resolve(this.mapFillInOrder(fill)));
    }

    public cancelAllOrders(): Promise<boolean> {
        console.log('called cancel all orders');
        return Promise.resolve(this.trader.checkState()
            .then(() => this.gdaxExchangeApi.loadAllOrders(this.confService.configurationFile.application.product.name))
            .then((orders) => {
                orders.forEach((order: LiveOrder) => {
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

    public placeStopSellOrder(priceP: number, nbCoin: number): Promise<LiveOrder> {
        const myOrder: PlaceOrderMessage = {
            orderType: 'stop',
            type: 'placeOrder',
            side: 'sell',
            productId: this.confService.configurationFile.application.product.name,
            price: priceP.toFixed(2),
            size: nbCoin.toFixed(8),
            // size: '0.0001',
            time: new Date()
        };

        console.log('positionnement d un stopOrder a ' + priceP + ' pour ' + nbCoin + ' coins');
        SlackService._instance.postMessage('positionnement d un stopOrder a ' + priceP + ' pour ' + nbCoin + ' coins');

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

    public placeLimitOrder(priceP: number, nbCoin: number): Promise<LiveOrder> {
        const myOrder: PlaceOrderMessage = {
            type: 'limit',
            orderType: 'limit',
            size: nbCoin.toFixed(8),
            price: priceP.toFixed(2),
            side: 'sell',
            productId: this.confService.configurationFile.application.product.name,
            time: new Date()
        };

        console.log('positionnement d un order limit a ' + priceP + ' pour ' + nbCoin + ' coins');
        SlackService._instance.postMessage('positionnement d un order limit a ' + priceP + ' pour ' + nbCoin + ' coins');

        return this.trader.placeOrder(myOrder).then((order) => {
            order.price = new BigNumber(priceP.toFixed(10));
            return Promise.resolve(order);
        }).catch((reason) => {
            console.log('Unable to place an order limit');
            logError(reason);
            return Promise.reject(reason);
        });
    }

    private loadFills(): Promise<Fill[]> {
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
                });
        }).catch((reason: any) => {
            logError(reason);
            return Promise.resolve(null);
        }));
    }

    private loadOrders(): Promise<GDAXOrder[]> {
        const apiCall = this.gdaxExchangeApi.authCall('GET', `/orders`, {});
        return Promise.resolve(this.gdaxExchangeApi.handleResponse<GDAXOrder[]>(apiCall, null).then((orders: GDAXOrder[]) => {
            return orders;
        }));
    }

    private mapFillInOrder(fill: Fill): Order {
        return {
            id: fill.order_id,
            price: fill.price,
            side: fill.side,
            fee: fill.fee,
            size: fill.size,
            time: fill.created_at,
            status: 'open',
        };
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
