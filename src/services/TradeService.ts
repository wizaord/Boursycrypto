import { Tendance } from '../model/HistoriqueTic';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import { HistoriqueService } from './HistoriqueService';

export class TradeService {

    private historiqueSrv: HistoriqueService;

    public constructor() {
        this.historiqueSrv = HistoriqueService._instance;
    }

    public checkTendance() {
        // calcul des tendances
        const tendance2min = this.getLast2MinutesTendances();
        const tendance10min = this.getLast10MinutesTendances();
        const tendance30min = this.getLast30MinutesTendances();
        const tendance60min = this.getLast60MinutesTendances();

        console.log(printSeparator());
        console.log('Date : ' + new Date());
        console.log('Cours now : ' + JSON.stringify(this.historiqueSrv.getLastComputeHisto()));
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
    private calculeTendance(beginDate: Date, endDate?: Date): Tendance {
        if (endDate == null || endDate === undefined) {
            endDate = new Date();
        }

        const histoComputeLst = this.historiqueSrv.getHistoriqueComputes(beginDate, endDate);
        if (histoComputeLst.length === 0) {
            console.log('Unable to get computeHisto between beginDate ' + JSON.stringify(beginDate) + ' and endDate ' + JSON.stringify(endDate));
            return null;
        }

        // console.log(JSON.stringify(histoComputeLst));

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
    private getLast10MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.historiqueSrv.computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 10 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    private getLast30MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.historiqueSrv.computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 30 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);
    }

    /**
     * permet de recuperer la tendance sur les 10 dernières minutes
     * @returns {number}
     */
    private getLast60MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.historiqueSrv.computeLst.last().generatedDate;
        const last10MinuDate = new Date(currentDate.getTime() - 60 * 60000);
        return this.calculeTendance(last10MinuDate, lastMinute);

    }

    /**
     * permet de recuperer la tendance sur les 2 dernières minutes
     * @returns {number}
     */
    private getLast2MinutesTendances(): Tendance {
        const currentDate = new Date();
        const lastMinute = this.historiqueSrv.computeLst.last().generatedDate;
        const last2MinuDate = new Date(currentDate.getTime() - 2 * 60000);
        return this.calculeTendance(last2MinuDate, lastMinute);
    }

}
