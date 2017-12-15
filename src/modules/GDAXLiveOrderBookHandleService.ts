import { GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { LiveOrderbook, TradeMessage } from 'gdax-trading-toolkit/build/src/core';

export class GDAXLiveOrderBookHandleService {
    private options: GDAXFeedConfig;
    // private confService: ConfService;
    private _liveOrderBook: LiveOrderbook;

    constructor() {
        console.log('Create - GDAXLiveOrderBookHandleService');

    }

    public inject(options: GDAXFeedConfig, confService: ConfService): void {
        console.log('Inject - GDAXLiveOrderBookHandleService');
        this.options = options;
        // this.confService = confService;

        this._liveOrderBook = new LiveOrderbook({product: confService.configurationFile.application.product.name, logger: options.logger});

    }

    public init(): void {
        console.log('Init - GDAXLiveOrderBookHandleService');
        this._liveOrderBook.on('LiveOrderbook.trade', (trade: TradeMessage) => {
            this.handleTradeMessage(trade);
        });
    }

    /**
     * Reception d'une nouvelle valeur de trading
     *  - Envoie à l'histo
     *  - Envoie au TradeService pour information
     * @param {TradeMessage} trade
     */
    public handleTradeMessage(trade: TradeMessage) {
        this.options.logger.log('info', 'Place <' + trade.productId + '>, price => ' + trade.price);
    }

    get liveOrderBook(): LiveOrderbook {
        return this._liveOrderBook;
    }
}