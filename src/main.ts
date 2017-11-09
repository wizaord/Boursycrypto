import * as GTT from 'gdax-trading-toolkit';
import program  = require('commander');
import { GDAX_API_URL, GDAX_WS_FEED, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { StreamMessage, TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';

// create the default logger
const logger = GTT.utils.ConsoleLoggerFactory();

// specify the PRODUCT to connect
const products: string[] = ['BTC-EUR', 'ETH-EUR', 'LTC-EUR'];

program
    .option('--api [value]', 'API url', 'https://api.gdax.com')
    .option('--ws [value]', 'WSI url', 'https://ws-feed.gdax.com')
    .option('-p --product [value]', 'The GDAX product to query', 'BTC-USD')
    .parse(process.argv);

const options: GDAXFeedConfig = {
    logger: logger,
    auth: {
        key: program.key || process.env.GDAX_KEY,
        secret: program.secret || process.env.GDAX_SECRET,
        passphrase: program.passphrase || process.env.GDAX_PASSPHRASE}, // use public feed
    channels: null,
    wsUrl: GDAX_WS_FEED,
    apiUrl: GDAX_API_URL
};

getSubscribedFeeds(options, products)
.then((feed: GDAXFeed) => {
        feed.on('data', (msg: StreamMessage) => {
            // console.log(JSON.stringify(msg));
            if (msg.type === 'trade') {
                const tradeMsg = (msg as TradeMessage);
                logger.log('info', 'Place <' + tradeMsg.productId + '>, price => ' + tradeMsg.price);
                console.log(JSON.stringify(msg));
            }
        });
}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});
