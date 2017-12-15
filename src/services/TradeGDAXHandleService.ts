import { MyOrderPlacedMessage, TradeExecutedMessage, TradeFinalizedMessage, Trader, TraderConfig } from 'gdax-trading-toolkit/build/src/core';
import { GDAXFeed } from 'gdax-trading-toolkit/build/src/exchanges';
import * as GTT from 'gdax-trading-toolkit';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';

export class TradeGDAXHandleService {
    private logger = GTT.utils.ConsoleLoggerFactory();
    private trader: Trader;

    public constructor(feed: GDAXFeed) {

        const traderConfig: TraderConfig = {
            logger: this.logger,
            productId: 'LTC-EUR',
            exchangeAPI: feed.authenticatedAPI,
            fitOrders: false
        };

        this.trader = new Trader(traderConfig);
        feed.pipe(this.trader);
    }

    public startOn() {
        // We're basically done. Now set up listeners to log the trades as they happen
        this.trader.on('Trader.order-placed', (msg: LiveOrder) => {
            this.logger.log('info', 'Order placed', JSON.stringify(msg));
        });
        this.trader.on('Trader.trade-executed', (msg: TradeExecutedMessage) => {
            this.logger.log('info', 'Trade executed', JSON.stringify(msg));
        });
        this.trader.on('Trader.trade-finalized', (msg: TradeFinalizedMessage) => {
            this.logger.log('info', 'Order complete', JSON.stringify(msg));
        });
        this.trader.on('Trader.my-orders-cancelled', (ids: string[]) => {
            this.logger.log('info', `${ids.length} orders cancelled`);
        });
        this.trader.on('Trader.external-order-placement', (msg: MyOrderPlacedMessage) => {
            this.logger.log('info', 'orders manually placed', JSON.stringify(msg));
        });

        this.trader.on('error', (err: Error) => {
            this.logger.log('error', 'Error cancelling orders', err);
        });
    }
}
