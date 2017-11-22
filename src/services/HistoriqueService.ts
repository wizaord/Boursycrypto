import { TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { HistoriqueCompute, HistoriqueTic } from '../model/HistoriqueTic';
import * as BigNumber from 'bignumber.js';
import Collections = require('typescript-collections');
import { ConfService } from './ConfService';

export class HistoriqueService {

    private ticLst: Collections.Queue<HistoriqueTic>;
    private computeLst: Collections.LinkedList<HistoriqueCompute>;
    public static _instance: HistoriqueService;

    public constructor(confService: ConfService) {
        HistoriqueService._instance = this;
        this.ticLst = new Collections.Queue();
        this.computeLst = new Collections.LinkedList();
        setInterval(computeTicLst, confService.configurationFile.application.historique.computeDely);
    }

    /**
     * {"type":"trade","time":"2017-11-22T20:10:46.901Z","productId":"BTC-EUR",
     * "tradeId":5584405,"side":"buy","price":"7060.99000000","size":"0.02317876",
     * "sourceSequence":2938061407,"origin":{"type":"match","trade_id":5584405,"maker_order_id":"ebf88e41-8be4-4218-a9cc-2d600d9d60da","taker_order_id":"1ab9d240-6ca2-4895-9804-20903fa42957","side":"sell","size":"0.02317876","price":"7060.99000000","product_id":"BTC-EUR","sequence":2938061407,"time":"2017-11-22T20:10:46.901000Z"}}
     * @param {TradeMessage} tradeMessage
     */
    public saveTradeMessage(tradeMessage: TradeMessage): void {
        // DO SOMETHING
        const tic = this.transformInTic(tradeMessage);
        // add in list
        this.ticLst.add(tic);
        // console.log('Historique receive message');
        // console.log(JSON.stringify(tradeMessage));
    }

    public computeTicLst(): void {
        const computeTic: HistoriqueCompute = {
            generatedDate: new Date(),
            nbTic: 0,
            averagePrice: 0,
            totalSize: 0,
            minPrice: 0,
            maxPrice: 0,
            nbBuy: 0,
            nbSell: 0
        };
        let totalPrice = 0;
        let tic;
        while (tic = this.ticLst.dequeue()) {
            computeTic.nbTic++;
            computeTic.totalSize += tic.size.toNumber();
            (tic.isBuy) ? computeTic.nbBuy += 1 : computeTic.nbSell += 1;
            if (computeTic.minPrice > tic.price.toNumber() || computeTic.minPrice === 0) {
                computeTic.minPrice = tic.price.toNumber();
            }
            if (computeTic.maxPrice < tic.price.toNumber() || computeTic.maxPrice === 0) {
                computeTic.maxPrice = tic.price.toNumber();
            }

            totalPrice += tic.price.toNumber();
        }
        computeTic.averagePrice = totalPrice / computeTic.nbTic;
        this.computeLst.add(computeTic);
        console.log(JSON.stringify(computeTic));
    }

    private transformInTic(tradeMsg: TradeMessage): HistoriqueTic {
        return {
            receiveDate: tradeMsg.time,
            price: new BigNumber(tradeMsg.price),
            size: new BigNumber(tradeMsg.size),
            isBuy: (tradeMsg.side === 'buy') ? true : false
        };
    }
}

function computeTicLst() {
    HistoriqueService._instance.computeTicLst();
}
