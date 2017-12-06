import { TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import { HistoriqueCompute, HistoriqueTic, Tendance } from '../model/HistoriqueTic';
import * as BigNumber from 'bignumber.js';
import Collections = require('typescript-collections');
import { ConfService } from './ConfService';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';

export class HistoriqueService {

    public static _instance: HistoriqueService;
    private ticLst: Collections.Queue<HistoriqueTic>;
    private computeLst: Collections.LinkedList<HistoriqueCompute>;
    private computeDelay: number;

    public constructor(confService: ConfService) {
        HistoriqueService._instance = this;
        this.ticLst = new Collections.Queue();
        this.computeLst = new Collections.LinkedList();
        this.computeDelay = confService.configurationFile.application.historique.computeDelay;
        // ajout d'un timer pour calculer la tendance toutes les XX minutes configurables
        setInterval(computeTicLst, this.computeDelay);
    }

    /**
     * {"type":"trade","time":"2017-11-22T20:10:46.901Z","productId":"BTC-EUR",
     * "tradeId":5584405,"side":"buy","price":"7060.99000000","volumeEchange":"0.02317876",
     * "sourceSequence":2938061407,"origin":{"type":"match","trade_id":5584405,"maker_order_id":"ebf88e41-8be4-4218-a9cc-2d600d9d60da","taker_order_id":"1ab9d240-6ca2-4895-9804-20903fa42957","side":"sell","volumeEchange":"0.02317876","price":"7060.99000000","product_id":"BTC-EUR","sequence":2938061407,"time":"2017-11-22T20:10:46.901000Z"}}
     * @param {TradeMessage} tradeMessage
     */
    public saveTradeMessage(tradeMessage: TradeMessage): void {
        const tic = this.transformInTic(tradeMessage);
        this.ticLst.add(tic);
    }

    /**
     * Transforme tous les Tic messages. Cette fonction est appelée toutes les XX Minutes
     */
    public computeTicLst(): void {
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
            if (this.computeLst.size() === 0) {
                console.log('No order passed. Wait again one minute');
                return;
            }
            computeTic = this.computeLst.last();
        } else {
            while (tic = this.ticLst.dequeue()) {
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

        this.computeLst.add(computeTic);
        console.log('Generate new stat' + JSON.stringify(computeTic));

        // calcul des tendances
        const tendance2min = this.getLast2MinutesTendances();
        const tendance10min = this.getLast10MinutesTendances();
        const tendance30min = this.getLast30MinutesTendances();
        const tendance60min = this.getLast60MinutesTendances();

        console.log(printSeparator());
        console.log('Date : ' + new Date());
        console.log('Cours now : ' + JSON.stringify(this.computeLst.last()));
        console.log(printSeparator());
        console.log('Tendance 2 minutes : ' + JSON.stringify(tendance2min));
        console.log('Tendance 10 minutes : ' + JSON.stringify(tendance10min));
        console.log('Tendance 30 minutes : ' + JSON.stringify(tendance30min));
        console.log('Tendance 60 minutes : ' + JSON.stringify(tendance60min));
        console.log(printSeparator());
    }

    /**
     * Le calcul d'une tendance est simple.
     * On prend la date de Debut, on prend la date de fin et on compare
     * @param {Date} beginDate
     * @param {Date} endDate
     * @returns {number}
     */
    public calculeTendance(beginDate: Date, endDate?: Date): Tendance {
        if (endDate == null || endDate === undefined) {
            endDate = new Date();
        }

        if (this.computeLst.size() < 2) {
            console.log('Pas assez de valeur');
            return null;
        }

        const histoComputeLst = this.getLstComputeTic(beginDate, endDate);
        if (histoComputeLst.length === 0) {
            console.log('Unable to get computeHisto between beginDate ' + JSON.stringify(beginDate) + ' and endDate ' + JSON.stringify(endDate));
            return null;
        }

        console.log(JSON.stringify(histoComputeLst));

        const oldElement = histoComputeLst[0];
        const lastElement = histoComputeLst[histoComputeLst.length - 1];

        const tendance: Tendance = {
            evolPrice: 0,
            evolPourcentage: 0,
            type: '',
            volumeEchangee: 0
        };
        tendance.evolPrice = lastElement.averagePrice - oldElement.averagePrice;
        // (Valeur d’arrivée – Valeur de départ) / Valeur de départ x 100
        tendance.evolPourcentage = (lastElement.averagePrice - oldElement.averagePrice) / oldElement.averagePrice * 100;
        tendance.type = (tendance.evolPrice > 0) ? 'HAUSSE' : 'BAISSE';
        histoComputeLst.forEach((historiqueCompute) => tendance.volumeEchangee += historiqueCompute.volumeEchange);
        return tendance;
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    public getLast10MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 10 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    public getLast30MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 30 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    public getLast60MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 60 * 60000);
        console.log('hello2');
        return this.calculeTendance(last10MinuDate, lastMinute);

    }

    /**
     * permet de recuperer la tendance sur les 2 dernières minutes
     * @returns {number}
     */
    public getLast2MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.computeLst.last().generatedDate;
        const last2MinuDate = new Date(currentDate.getTime() - 2 * 60000);
        return this.calculeTendance(last2MinuDate, lastMinute);
    }

    private transformInTic(tradeMsg: TradeMessage): HistoriqueTic {
        return {
            receiveDate: tradeMsg.time,
            price: new BigNumber(tradeMsg.price),
            volumeEchange: new BigNumber(tradeMsg.size),
            isBuy: (tradeMsg.side === 'buy') ? true : false
        };
    }

    /**
     * Retourne la liste des historique entre la date de debut et la date de fin
     * @param {Date} beginDate
     * @param {Date} endDate
     * @returns {HistoriqueCompute[]}
     */
    private getLstComputeTic(beginDate: Date, endDate: Date): HistoriqueCompute[] {
        const histoComputeLst: HistoriqueCompute[] = [];
        this.computeLst.forEach((computeHisto) => {
            const diffWithBeginDate = computeHisto.generatedDate.getTime() - beginDate.getTime();
            const diffWithEndDate = computeHisto.generatedDate.getTime() - endDate.getTime();
            if (diffWithBeginDate >= 0 && diffWithEndDate <= 0) {
                histoComputeLst.push(computeHisto);
            }
        });
        return histoComputeLst;
    }

    // private getComputeTic(date: Date): HistoriqueCompute {
    //     let compteDate = null;
    //     this.computeLst.forEach((a) => {
    //         const diffTime = a.generatedDate.getTime() - date.getTime();
    //         // console.log('Compare ' + date.getTime() + ' with tictic ' + a.generatedDate.getTime() + ' - ' + JSON.stringify(a));
    //         if (diffTime >= 0 && diffTime <= this.computeDelay) {
    //             compteDate = a;
    //         }
    //     });
    //     return compteDate;
    // }
}

function computeTicLst() {
    HistoriqueService._instance.computeTicLst();
}