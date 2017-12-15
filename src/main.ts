///<reference path="services/AccountService.ts"/>
import * as GTT from 'gdax-trading-toolkit';
import { GDAX_API_URL, GDAX_WS_FEED, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';
import { ConfService } from './services/confService';
import { AccountService } from './services/AccountService';
import { LiveOrderBookHandleService } from './services/LiveOrderBookHandleService';
import { HistoriqueService } from './services/HistoriqueService';
import { TradeService } from './services/TradeService';
import { TradeGDAXHandleService } from './services/TradeGDAXHandleService';

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

    const tradeGDAXHandleService = new TradeGDAXHandleService(feed);
    tradeGDAXHandleService.startOn();

}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});
