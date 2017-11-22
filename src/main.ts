///<reference path="services/AccountService.ts"/>
import * as GTT from 'gdax-trading-toolkit';
import { GDAX_API_URL, GDAX_WS_FEED, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { LiveOrderbook, TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';
import { ConfService } from './services/confService';
import { AccountService } from './services/AccountService';

// create the default logger
const logger = GTT.utils.ConsoleLoggerFactory();

// chargement du fichier de configuration
const confService = new ConfService('application.yml');

// specify the PRODUCT to connect
const products: string[] = [confService.configurationFile.application.product.name];

const options: GDAXFeedConfig = {
    logger: logger,
    auth: {
        key: confService.configurationFile.application.auth.apikey,
        secret: confService.configurationFile.application.auth.apisecretkey,
        passphrase: confService.configurationFile.application.auth.passphrase,
    },
    channels: null,
    wsUrl: GDAX_WS_FEED,
    apiUrl: GDAX_API_URL
};

logger.log('info', 'Init the api exchange and load data from GDAX');
const accountService = new AccountService(options, confService);
accountService.refreshFromGDAX();

logger.log('info', 'Using configuration ' + JSON.stringify(options));

const bookBTCEUR = new LiveOrderbook({product: 'BTC-EUR', logger: logger});

getSubscribedFeeds(options, products)
.then((feed: GDAXFeed) => {

    bookBTCEUR.on('LiveOrderbook.trade', (trade: TradeMessage) => {
        logger.log('info', 'Place <' + trade.productId + '>, price => ' + trade.price);
    });

    feed.pipe(bookBTCEUR);
}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});
