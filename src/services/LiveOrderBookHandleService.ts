
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

    public constructor(options: GDAXFeedConfig, confService: ConfService, accountService: AccountService) {
        LiveOrderBookHandleService._instance = this;
        this.logger = options.logger;
        this.accountService = accountService;
        this.historicService = new HistoriqueService(confService);
        this._liveOrderBook = new LiveOrderbook({product: confService.configurationFile.application.product.name, logger: options.logger});

        // register fonction based on message
        this._liveOrderBook.on('LiveOrderbook.trade', tradeMessageReceive);
    }



    /**
     * Fonction gérant la réception d'une mise à jour du montant du BTC
     * A chaque message, l'algo suivant est mis en place :
     *  - Sauvegarde dans le service Historique
     *  - Recuperation du mode de fonctionnement (BUY / SELL)
     *  - Si BUY
     *      - On demande au service TENDANCE s'il s'agit d'une hausse après une grosse chute
     *      - Si non, on passe son tour
     *      - Si oui, on demande au service ACHAT de passer un ordre
     *  - Si SELL
     *      - on regarde si le montant est > à l'ordre acheté, si non on ne fait rien
     *      - on regarde si on a atteint le pourcentage de benef, si non on ne fait rien
     *      - on regarde si on a atteint une tendance baissière
     *      - si non
     *          - on ne fait rien
     *      - si oui
     *          - on vend
     * @param {TradeMessage} trade
     */
    public handleTradeMessage(trade: TradeMessage) {
        this.historicService.saveTradeMessage(trade);
        const buyOrderHasBeenPassed = this.accountService.orderInProgress;
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