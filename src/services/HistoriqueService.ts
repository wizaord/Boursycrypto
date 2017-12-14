import { TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { HistoriqueCompute, HistoriqueTic } from '../model/HistoriqueTic';
import * as BigNumber from 'bignumber.js';
import { ConfService } from './ConfService';
import LinkedList from 'typescript-collections/dist/lib/LinkedList';
import Collections = require('typescript-collections');
import { TradeService } from './TradeService';

export class HistoriqueService {

    public static _instance: HistoriqueService;
    private ticLst: Collections.Queue<HistoriqueTic>;
    private _computeLst: Collections.LinkedList<HistoriqueCompute>;
    private computeDelay: number;
    private tradeService: TradeService;

    public constructor(confService: ConfService) {
        HistoriqueService._instance = this;
        this.ticLst = new Collections.Queue();
        this._computeLst = new Collections.LinkedList();
        this.computeDelay = confService.configurationFile.application.historique.computeDelay;
        // ajout d'un timer pour calculer la tendance toutes les XX minutes configurables
        setInterval(computeTradeMessagesInHistoriqueCompute, this.computeDelay);
    }

    get computeLst(): LinkedList<HistoriqueCompute> {
        return this._computeLst;
    }

    public registerTradeService(tradeService: TradeService): void {
        this.tradeService = tradeService;
    }

    public addTradeMessage(tradeMessage: TradeMessage): void {
        const tic = this.mapTradeMessageInHistoricTic(tradeMessage);
        this.ticLst.add(tic);
    }

    public computeTradeMessagesInHistoriqueCompute(): void {
        let computeTic: HistoriqueCompute = {
            generatedDate: new Date(),
            nbTic: 0,
            averagePrice: 0,
            volumeEchange: 0,
            minPrice: 0,
            maxPrice: 0,
            nbBuy: 0,
            nbSell: 0
        };
        let totalPrice = 0;
        let tic;
        if (this.ticLst.size() === 0) {
            // just copy the last tic if exist. If not do nothing
            if (this._computeLst.size() === 0) {
                console.log('No order passed. Wait again one minute');
                return;
            }
            computeTic = this._computeLst.last();
            computeTic.generatedDate = new Date();
            computeTic.nbSell = computeTic.nbBuy = computeTic.nbTic = computeTic.volumeEchange = 0;
        } else {
            while (this.ticLst.size() !== 0) {
                tic = this.ticLst.dequeue();
                computeTic.nbTic++;
                computeTic.volumeEchange += tic.volumeEchange.toNumber();
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
        }

        this._computeLst.add(computeTic);
        // console.log('Generate new stat' + JSON.stringify(computeTic));
        this.tradeService.tradeNow();
    }

    public getLastComputeHisto(): HistoriqueCompute {
        return this._computeLst.last();
    }

    /**
     * Retourne la liste des historique entre la date de debut et la date de fin
     * @param {Date} beginDate
     * @param {Date} endDate
     * @returns {HistoriqueCompute[]}
     */
    public getHistoriqueComputes(beginDate: Date, endDate: Date): HistoriqueCompute[] {
        const histoComputeLst: HistoriqueCompute[] = [];
        this._computeLst.forEach((computeHisto) => {
            const diffWithBeginDate = computeHisto.generatedDate.getTime() - beginDate.getTime();
            const diffWithEndDate = computeHisto.generatedDate.getTime() - endDate.getTime();
            if (diffWithBeginDate >= 0 && diffWithEndDate <= 0) {
                histoComputeLst.push(computeHisto);
            }
        });
        return histoComputeLst;
    }

    private mapTradeMessageInHistoricTic(tradeMsg: TradeMessage): HistoriqueTic {
        return {
            receiveDate: tradeMsg.time,
            price: new BigNumber(tradeMsg.price),
            volumeEchange: new BigNumber(tradeMsg.size),
            isBuy: (tradeMsg.side === 'buy') ? true : false
        };
    }
}

function computeTradeMessagesInHistoriqueCompute() {
    HistoriqueService._instance.computeTradeMessagesInHistoriqueCompute();
}
