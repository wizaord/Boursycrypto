
import { BigJS } from 'gdax-trading-toolkit/build/src/lib/types';

export interface HistoriqueTic {
    receiveDate: Date;
    price: BigJS;
    volumeEchange: BigJS;
    isBuy: boolean;
}

export interface HistoriqueCompute {
    generatedDate: Date;
    nbTic: number;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    volumeEchange: number;
    nbBuy: number;
    nbSell: number;
}

export interface Tendance {
    beginDate: Date;
    endDate: Date;
    averagePrice: number;
    type: string;
    evolPrice: number;
    evolPourcentage: number;
    volumeEchangee: number;
}
