import { HistoriqueCompute, HistoriqueTic, Tendance } from '../model/HistoriqueTic';
import { ConfService } from '../services/ConfService';
import { TradeMessage } from 'gdax-trading-toolkit/build/src/core';
import * as BigNumber from 'bignumber.js';
import LinkedList from 'typescript-collections/dist/lib/LinkedList';
import DateUtils from '../utilities/DateUtils';
import Collections = require('typescript-collections');

export class TendanceService {

    public static _instance: TendanceService ;
    private ticLst: Collections.Queue<HistoriqueTic>;
    private _computeLst: Collections.LinkedList<HistoriqueCompute>;
    private computeDelay: number;
    private confService: ConfService;

    constructor() {
        console.log('Create - TendanceService');
        TendanceService._instance = this;
    }

    public inject(confService: ConfService): void {
        console.log('Inject - TendanceService');
        this.confService = confService;
    }

    public init(): void {
        console.log('Init - TendanceService');

        this.ticLst = new Collections.Queue();
        this._computeLst = new Collections.LinkedList();
        this.computeDelay = this.confService.configurationFile.application.historique.computeDelay;

        // ajout d'un timer pour calculer la tendance toutes les XX minutes configurables
        setInterval(computeTradeMessagesInHistoriqueCompute, this.computeDelay);
    }

    get computeLst(): LinkedList<HistoriqueCompute> {
        return this._computeLst;
    }

    public addTradeMessage(tradeMessage: TradeMessage): void {
        const tic = this.mapTradeMessageInHistoricTic(tradeMessage);
        this.ticLst.add(tic);
    }

    public computeTradeMessagesInHistoriqueCompute(): void {
        let computeTic: HistoriqueCompute = {
            generatedDate: DateUtils.getTimeAroundSecond(new Date()),
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
            computeTic.generatedDate = DateUtils.getTimeAroundSecond(new Date());
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

        // remove old HistoriqueTendance
        while (this._computeLst.size() > Number(this.confService.configurationFile.application.historique.computeDelay.maxHistoriqueComputeKeepInMemory)) {
            this._computeLst.removeElementAtIndex(0);
        }

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

    /**
     * Retourne un tableau de tendance de toutes les minutes.
     * @param {number} nbTendances : le nombre de tendance à retourner
     * @returns {Tendance[]}
     */
    public getLastEveryMinutesTendances(nbTendances: number): Tendance[] {
        const tendancesTab: Tendance[] = [];
        if (this._computeLst.size() !== 0) {
            const lastDate = this._computeLst.last().generatedDate;
            for (let i = 0 ; i < nbTendances; i++) {
                const endDate = new Date(lastDate.getTime() - (i * 60000));
                const beginDate = new Date(lastDate.getTime() - ((i + 1) * 60000));
                const calculatedTendance = this.calculeTendance(beginDate, endDate);
                if (calculatedTendance !== null) {
                    tendancesTab.push(calculatedTendance);
                }
            }
        }
        return tendancesTab;
    }

    /**
     * permet de recuperer la tendance sur les 2 dernières minutes
     * @returns {number}
     */
    public getLast2MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this._computeLst.last().generatedDate;
        const last2MinuDate = new Date(currentDate.getTime() - 2 * 60000);
        return this.calculeTendance(last2MinuDate, lastMinute);
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    public getLast10MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this._computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 10 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    public getLast30MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this._computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 30 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    public getLast60MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this._computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 60 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);

    }

    private mapTradeMessageInHistoricTic(tradeMsg: TradeMessage): HistoriqueTic {
        return {
            receiveDate: tradeMsg.time,
            price: new BigNumber(tradeMsg.price),
            volumeEchange: new BigNumber(tradeMsg.size),
            isBuy: (tradeMsg.side === 'buy')
        };
    }

    /**
     * Le calcul d'une tendance est simple.
     * On prend la date de Debut, on prend la date de fin et on compare
     * @param {Date} beginDate
     * @param {Date} endDate
     * @returns {number}
     */
    private calculeTendance(beginDate: Date, endDate?: Date): Tendance {
        if (endDate == null || endDate === undefined) {
            endDate = new Date();
        }

        if (this._computeLst.size() === 0) {
            return null;
        }

        const firstListDate = DateUtils.getTimeAroundSecond(this._computeLst.first().generatedDate);
        const beginDateSec = DateUtils.getTimeAroundSecond(beginDate);
        const endDateSec = DateUtils.getTimeAroundSecond(endDate);

        // si la date de debut n'existe pas, on ne remonte pas de tendance
        // console.log('First date ' + firstListDate.getTime());
        // console.log('Begin Date ' + beginDateSec.getTime());
        // console.log('End date ' + endDateSec.getTime());
        if (firstListDate.getTime() > beginDateSec.getTime()) {
            return null;
        }

        const histoComputeLst = this.getHistoriqueComputes(beginDateSec, endDateSec);
        if (histoComputeLst.length === 0) {
            console.log('Unable to get computeHisto between beginDate ' + JSON.stringify(beginDateSec) + ' and endDate ' + JSON.stringify(endDateSec));
            return null;
        }

        const oldElement = histoComputeLst[0];
        const lastElement = histoComputeLst[histoComputeLst.length - 1];

        const tendance: Tendance = {
            beginDate: beginDateSec,
            endDate: endDateSec,
            averagePrice: histoComputeLst.map((v) => v.averagePrice).reduce((previousValue, currentValue) => previousValue + currentValue) / histoComputeLst.length,
            evolPrice: 0,
            evolPourcentage: 0,
            type: '',
            volumeEchangee: 0
        };

        tendance.evolPrice = lastElement.averagePrice - oldElement.averagePrice;
        // (Valeur d’arrivée – Valeur de départ) / Valeur de départ x 100
        tendance.evolPourcentage = (lastElement.averagePrice - oldElement.averagePrice) / oldElement.averagePrice * 100;
        tendance.type = (tendance.evolPrice >= 0) ? 'HAUSSE' : 'BAISSE';
        histoComputeLst.forEach((historiqueCompute) => tendance.volumeEchangee += historiqueCompute.volumeEchange);
        return tendance;
    }
}

function computeTradeMessagesInHistoriqueCompute() {
    TendanceService._instance.computeTradeMessagesInHistoriqueCompute();
}
