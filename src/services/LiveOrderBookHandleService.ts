
import { LiveOrderbook, TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { ConfService } from './ConfService';
import { GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { Logger } from 'gdax-trading-toolkit/build/src/utils';
import { AccountService } from './AccountService';
import { HistoriqueService } from './HistoriqueService';

export class LiveOrderBookHandleService {

    public static _instance: LiveOrderBookHandleService;
    private logger: Logger;
    private _liveOrderBook: LiveOrderbook;
    private accountService: AccountService;
    private historicService: HistoriqueService;

    public constructor(options: GDAXFeedConfig, confService: ConfService, accountService: AccountService, historiqueService: HistoriqueService) {
        LiveOrderBookHandleService._instance = this;
        this.logger = options.logger;
        this.accountService = accountService;
        this.historicService = historiqueService;
        this._liveOrderBook = new LiveOrderbook({product: confService.configurationFile.application.product.name, logger: options.logger});

        // register fonction based on message
        this._liveOrderBook.on('LiveOrderbook.trade', tradeMessageReceive);
    }

    public handleTradeMessage(trade: TradeMessage) {
        this.historicService.addTradeMessage(trade);
        const buyOrderHasBeenPassed = this.accountService.orderInProgress;

        // receive new message
        // console.log(JSON.stringify(trade));
        if (buyOrderHasBeenPassed) {
            this.logger.log('info', 'Place <' + trade.productId + '>, price => ' + trade.price);
        } else {
            this.logger.log('info', 'Place <' + trade.productId + '>, price => ' + trade.price);
        }
    }

    get liveOrderBook(): LiveOrderbook {
        return this._liveOrderBook;
    }
}

function tradeMessageReceive(trade: TradeMessage) {
    LiveOrderBookHandleService._instance.handleTradeMessage(trade);
}
