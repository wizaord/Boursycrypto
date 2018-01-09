import { GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { LiveOrderbook, TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { GDAXTradeService } from './GDAXTradeService';
import { TendanceService } from './TendanceService';

export class GDAXLiveOrderBookHandleService {
    // private options: GDAXFeedConfig;
    private _liveOrderBook: LiveOrderbook;
    private gdaxTradeService: GDAXTradeService;
    private tendanceService: TendanceService;
    private options: GDAXFeedConfig;

    constructor() {
        console.log('Create - GDAXLiveOrderBookHandleService');

    }

    public inject(options: GDAXFeedConfig, confService: ConfService, gdaxTradeService: GDAXTradeService, tendanceService: TendanceService): void {
        this.options = options;
        this.gdaxTradeService = gdaxTradeService;
        this.tendanceService = tendanceService;
        this.options.logger.log('debug', 'Inject - GDAXLiveOrderBookHandleService');

        this._liveOrderBook = new LiveOrderbook({product: confService.configurationFile.application.product.name, logger: options.logger});

    }

    public init(): void {
        this.options.logger.log('debug', 'Init - GDAXLiveOrderBookHandleService');
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
        this.options.logger.log('debug', 'Place <' + trade.productId + '>, price => ' + trade.price);
        this.tendanceService.addTradeMessage(trade);
        this.gdaxTradeService.notifyNewTradeMessage(trade);
    }

    get liveOrderBook(): LiveOrderbook {
        return this._liveOrderBook;
    }
}
