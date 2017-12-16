import * as GTT from 'gdax-trading-toolkit';
import { GDAX_API_URL, GDAX_WS_FEED, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from './services/confService';
import { GDAXAccountService } from './modules/GDAXAccountService';
import { GDAXCustomOrderHandleService } from './modules/GDAXCustomOrderHandleService';
import { GDAXLiveOrderBookHandleService } from './modules/GDAXLiveOrderBookHandleService';
import { GDAXTradeService } from './modules/GDAXTradeService';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';
import { TendanceService } from './modules/TendanceService';

if (process.argv.length !== 3) {
    console.error('Please set the name of the application_XXX.yml file');
    throw new Error('Please set the name of the application_XXX.yml file');
}
const applicationFileName = process.argv[2];

// Init objects
const confService = new ConfService(applicationFileName);
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

// create all new services
const gdaxAccount = new GDAXAccountService();
const gdaxCustomOrder = new GDAXCustomOrderHandleService();
const gdaxLiveOrder = new GDAXLiveOrderBookHandleService();
const gdaxTradeService = new GDAXTradeService();
const tendanceService = new TendanceService();

// -----------------------------------------
getSubscribedFeeds(options, products)
.then((feed: GDAXFeed) => {

    // inject all dependencies
    tendanceService.inject(confService);
    gdaxAccount.inject(options, confService);
    gdaxCustomOrder.inject(options, confService, gdaxTradeService, feed);
    gdaxLiveOrder.inject(options, confService, gdaxTradeService, tendanceService);
    gdaxTradeService.inject(options, confService, tendanceService, gdaxCustomOrder);

// init all modules
    gdaxAccount.init();
    tendanceService.init();
    gdaxCustomOrder.init();
    gdaxLiveOrder.init();
    gdaxTradeService.init();

    // redirect to liveOrderBook
    feed.pipe(gdaxLiveOrder.liveOrderBook);
    feed.pipe(gdaxCustomOrder.trader);


}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});
