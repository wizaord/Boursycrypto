import { Tendance } from '../model/HistoriqueTic';
import { printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import { HistoriqueService } from './HistoriqueService';
import { GDAXExchangeAPI, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { AccountService } from './AccountService';
import { ConfService } from './ConfService';

export class TradeService {

    private historiqueSrv: HistoriqueService;
    private gdaxExchangeApi: GDAXExchangeAPI;
    private accountService: AccountService;
    private confService: ConfService;

    public constructor(options: GDAXFeedConfig, accountService: AccountService, confService: ConfService) {
        this.historiqueSrv = HistoriqueService._instance;
        this.gdaxExchangeApi = new GDAXExchangeAPI(options);
        this.accountService = accountService;
        this.confService = confService;

        // regarde le mode de fonctionnement
        this.accountService.orderInProgress.then(value => {
            if (value === true) {
                console.log('en mode vente - suppression de tous les ordres');
            } else {
                console.log('en mode achat');
            }
            this.cancelAllOrders();
        });
    }

    public tradeNow() {
        // calcul des tendances
        const tendance2min = this.getLast2MinutesTendances();
        const tendance10min = this.getLast10MinutesTendances();
        const tendance30min = this.getLast30MinutesTendances();
        const tendance60min = this.getLast60MinutesTendances();

        console.log(printSeparator());
        console.log('Date : ' + new Date());
        console.log('Cours now : ' + JSON.stringify(this.historiqueSrv.getLastComputeHisto()));
        console.log('Tendance 2 minutes  : ' + this.convertTendanceInStr(tendance2min));
        console.log('Tendance 10 minutes : ' + this.convertTendanceInStr(tendance10min));
        console.log('Tendance 30 minutes : ' + this.convertTendanceInStr(tendance30min));
        console.log('Tendance 60 minutes : ' + this.convertTendanceInStr(tendance60min));
        console.log(printSeparator());
    }


    /**
     * Cancel all orders
     */
    public cancelAllOrders(): void {
        console.log('called cancel all orders');
        this.gdaxExchangeApi.loadAllOrders(this.confService.configurationFile.application.product.name).then((orders) => {
            orders.forEach((order) => {
                this.cancelOrder(order.id);
            });
        });
    }

    public cancelOrder(orderId: string): void {
        console.log('Cancel order with ID :' + orderId);
        this.gdaxExchangeApi.cancelOrder(orderId).then((result: string) => {
            console.log('Order with ID : ' + result + ' has been successfully cancelled');
        }).catch(logError);
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
        tendance.type = (tendance.evolPrice >= 0) ? 'HAUSSE' : 'BAISSE';
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

    private convertTendanceInStr(tendance: Tendance): string {
        return `type: ${tendance.type} => evolutionPrix: ${tendance.evolPrice.toFixed(2)}, pourcentage: ${tendance.evolPourcentage.toFixed(2)}, volume: ${tendance.volumeEchangee.toFixed(2)}`;
    }

    //
    // private placeLimitOrder(limit: number): void {
    //     // TODO : to implement
    // }
    //
    // private placeMarketOrder(limit: number): void {
    //     // TODO : to implement
    //     // const [side, size, price] = program.newLimitOrder.split(',');
    //     // const params: PlaceOrderMessage = {
    //     //     time: new Date(),
    //     //     clientId: null,
    //     //     side: side,
    //     //     size: size,
    //     //     type: 'market',
    //     //     productId: program.product,
    //     //     price: price,
    //     //     orderType: 'limit'
    //     // };
    //     // const msg = `Limit ${params.side} order for ${params.size} at ${params.price}`;
    //     // gdaxApi.placeOrder(params).then((result: LiveOrder) => {
    //     //     console.log(printSeparator());
    //     //     console.log(msg);
    //     //     console.log(result);
    //     // }).catch(logError);
    // }
}


function logError(err: any) {
    console.error(printSeparator());
    console.error('Error: ' + err.message);
    if (err && (err.response && err.response.error)) {
        console.error(err.response.error.message);
    }
    console.error(printSeparator());
}