import * as GTT from 'gdax-trading-toolkit';
import { GDAXFeed } from 'gdax-trading-toolkit/build/src/exchanges';
import { TradeMessage } from 'gdax-trading-toolkit/build/src/core';

const logger = GTT.utils.ConsoleLoggerFactory();
const products: string[] = ['BTC-EUR', 'ETH-EUR', 'LTC-EUR'];
const tallies: any = {};
products.forEach((product: string) => {
    tallies[product] = {};
});

GTT.Factories.GDAX.FeedFactory(logger, products)
.then((feed: GDAXFeed) => {
        feed.on('data', (msg: any) => {
            if (!(msg as any).productId) {
                logger.log('error', 'No ProductId defined');
            } else {
                const msgType = (msg as any).type;
                if (msgType === 'trade') {
                    const tradeMsg = (msg as TradeMessage);
                    logger.log('debug', 'receive trade message');
                    logger.log('info', 'Place <' + tradeMsg.productId + '>, price => ' + tradeMsg.price);
                }
            }
        });
}).catch((err: Error) => {
    logger.log('error', err.message);
    process.exit(1);
});
