import * as GTT from 'gdax-trading-toolkit';
import { GDAX_API_URL, GDAX_WS_FEED, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { LiveOrderbook, TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';
import { ConfService} from './services/confService';

// create the default logger
const logger = GTT.utils.ConsoleLoggerFactory();

// chargement du fichier de configuration
const confService = new ConfService('application.yml');

// specify the PRODUCT to connect
const products: string[] = ['BTC-EUR', 'ETH-EUR', 'LTC-EUR'];

const options: GDAXFeedConfig = {
    logger: logger,
    auth: {
        key: confService.configurationFile.application.apikey,
        secret: confService.configurationFile.application.apisecretkey,
        passphrase: null,
    },
    channels: null,
    wsUrl: GDAX_WS_FEED,
    apiUrl: GDAX_API_URL
};

logger.log('info', 'Using configuration ' + JSON.stringify(options));

const bookBTCEUR = new LiveOrderbook({product: 'BTC-EUR', logger: logger});
const bookLTCEUR = new LiveOrderbook({product: 'LTC-EUR', logger: logger});
const bookETHEUR = new LiveOrderbook({product: 'ETH-EUR', logger: logger});

getSubscribedFeeds(options, products)
.then((feed: GDAXFeed) => {

    bookBTCEUR.on('LiveOrderbook.trade', (trade: TradeMessage) => {
        logger.log('info', 'Place <' + trade.productId + '>, price => ' + trade.price);
    });
    bookLTCEUR.on('LiveOrderbook.trade', (trade: TradeMessage) => {
        logger.log('info', 'Place <' + trade.productId + '>, price => ' + trade.price);
    });
    bookETHEUR.on('LiveOrderbook.trade', (trade: TradeMessage) => {
        logger.log('info', 'Place <' + trade.productId + '>, price => ' + trade.price);
    });

    feed.pipe(bookBTCEUR);
    feed.pipe(bookLTCEUR);
    feed.pipe(bookETHEUR);
}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});
