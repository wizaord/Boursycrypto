///<reference path="services/AccountService.ts"/>
import * as GTT from 'gdax-trading-toolkit';
import { GDAX_API_URL, GDAX_WS_FEED, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';
import { ConfService } from './services/confService';
import { AccountService } from './services/AccountService';
import { LiveOrderBookHandleService } from './services/LiveOrderBookHandleService';
import { HistoriqueService } from './services/HistoriqueService';
import { TradeService } from './services/TradeService';
import { MyOrderPlacedMessage, TradeExecutedMessage, TradeFinalizedMessage, Trader, TraderConfig } from 'gdax-trading-toolkit/build/src/core';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';

// Init objects
const confService = new ConfService('application.yml');
const logger = GTT.utils.ConsoleLoggerFactory();
const options: GDAXFeedConfig = {
    logger: logger,
    auth: {
        key: confService.configurationFile.application.auth.apikey,
        secret: confService.configurationFile.application.auth.apisecretkey,
        passphrase: confService.configurationFile.application.auth.passphrase,
    },
    channels: ['level2', 'matches', 'user', 'ticker'],
    wsUrl: GDAX_WS_FEED,
    apiUrl: GDAX_API_URL
};
logger.log('info', 'Using configuration ' + JSON.stringify(options));
const products: string[] = [confService.configurationFile.application.product.name];
const accountService = new AccountService(options, confService);
const historiqueService = new HistoriqueService(confService);
const tradeService = new TradeService(options);
historiqueService.registerTradeService(tradeService);
const bookBTC = new LiveOrderBookHandleService(options, confService, accountService, historiqueService);

// -------------------------------------------
// initialise services
accountService.refreshFromGDAX();

// -----------------------------------------
getSubscribedFeeds(options, products)
.then((feed: GDAXFeed) => {
    // redirect to liveOrderBook
    feed.pipe(bookBTC.liveOrderBook);

    // listen also the manual action
    // Configure the trader, and use the API provided by the feed
    const traderConfig: TraderConfig = {
        logger: logger,
        productId: 'LTC-EUR',
        exchangeAPI: feed.authenticatedAPI,
        fitOrders: false
    };

    const trader = new Trader(traderConfig);
    feed.pipe(trader);
    // We're basically done. Now set up listeners to log the trades as they happen
    trader.on('Trader.order-placed', (msg: LiveOrder) => {
        logger.log('info', 'Order placed', JSON.stringify(msg));
    });
    trader.on('Trader.trade-executed', (msg: TradeExecutedMessage) => {
        logger.log('info', 'Trade executed', JSON.stringify(msg));
    });
    trader.on('Trader.trade-finalized', (msg: TradeFinalizedMessage) => {
        logger.log('info', 'Order complete', JSON.stringify(msg));
    });
    trader.on('Trader.my-orders-cancelled', (ids: string[]) => {
        logger.log('info', `${ids.length} orders cancelled`);
    });
    trader.on('Trader.external-order-placement', (msg: MyOrderPlacedMessage) => {
        logger.log('info', 'orders manually placed', JSON.stringify(msg));
    });

    trader.on('error', (err: Error) => {
        logger.log('error', 'Error cancelling orders', err);
    });

}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});