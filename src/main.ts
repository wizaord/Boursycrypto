import * as GTT from 'gdax-trading-toolkit';
import { GDAX_API_URL, GDAX_WS_FEED, GDAXExchangeAPI, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from './services/ConfService';
import { GDAXAccountService } from './modules/GDAXAccountService';
import { GDAXCustomOrderHandleService } from './modules/GDAXCustomOrderHandleService';
import { GDAXLiveOrderBookHandleService } from './modules/GDAXLiveOrderBookHandleService';
import { GDAXTradeService } from './modules/GDAXTradeService';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';
import { TendanceService } from './modules/TendanceService';
import { GDAXCustomOrderHandleServiceSimu } from './modules/GDAXCustomOrderHandleServiceSimu';
import { GDAXCustomOrderHandleInterface } from './modules/IGDAXCustomOrderHandleService';
import { SlackService } from './services/SlackService';

if (process.argv.length !== 4) {
    console.error('Please set the name of the application_XXX.yml file');
    throw new Error('Please set the name of the application_XXX.yml file');
}
const applicationFileName = process.argv[2];
const isModeSimu = (process.argv[3] !== 'no');

console.log('#############################################################');
console.log(' DEMARRAGE EN MODE SIMU = ' + isModeSimu);
console.log('#############################################################');

// Init objects
const confService = new ConfService(isModeSimu, applicationFileName);
const logger = GTT.utils.ConsoleLoggerFactory({ level: confService.configurationFile.application.logger.level });
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
const gdaxExchangeApi = new GDAXExchangeAPI(options);

// create all new services
const gdaxAccount = new GDAXAccountService();
let gdaxCustomOrder: GDAXCustomOrderHandleInterface;
if (isModeSimu) {
    gdaxCustomOrder = new GDAXCustomOrderHandleServiceSimu();
} else {
    gdaxCustomOrder = new GDAXCustomOrderHandleService();
}
const gdaxLiveOrder = new GDAXLiveOrderBookHandleService();
const gdaxTradeService = new GDAXTradeService();
const tendanceService = new TendanceService();
const slackService = new SlackService();

// -----------------------------------------
getSubscribedFeeds(options, products)
.then((feed: GDAXFeed) => {

    // inject all dependencies
    tendanceService.inject(confService);
    gdaxAccount.inject(options, confService, gdaxExchangeApi);
    gdaxCustomOrder.inject(options, confService, gdaxTradeService, feed, gdaxExchangeApi);
    gdaxLiveOrder.inject(options, confService, gdaxTradeService, tendanceService);
    gdaxTradeService.inject(options, confService, tendanceService, gdaxCustomOrder, gdaxAccount);
    slackService.inject(confService);

// init all modules
    gdaxAccount.init();
    tendanceService.init();
    gdaxCustomOrder.init();
    gdaxLiveOrder.init();
    gdaxTradeService.init();
    slackService.init();

    SlackService._instance.postMessage('Starting application for ' + confService.configurationFile.application.product.name);

    // redirect to liveOrderBook
    feed.pipe(gdaxLiveOrder.liveOrderBook);
    feed.pipe(gdaxCustomOrder.trader);

}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});
