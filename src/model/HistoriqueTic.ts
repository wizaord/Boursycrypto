
import { BigJS } from 'gdax-trading-toolkit/build/src/lib/types';

export interface HistoriqueTic {
    receiveDate: Date;
    price: BigJS;
    size: BigJS;
    isBuy: boolean;
}

export interface HistoriqueCompute {
    generatedDate: Date;
    nbTic: number;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    totalSize: number;
    nbBuy: number;
    nbSell: number;
}
