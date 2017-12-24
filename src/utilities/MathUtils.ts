import { BigJS } from 'gdax-trading-toolkit/build/src/lib/types';

export default class MathUtils {

    static calculateRemovePourcent(initPrice: number, pourcent: number): number {
        return initPrice - ((initPrice * pourcent) / 100);
    }

    static calculateAddPourcent(initPrice: number, pourcent: number): number {
        return initPrice + ((initPrice * pourcent) / 100);
    }

    static calculatePourcentDifference(referenceValue: number, newValue: number): number {
        return ((referenceValue * 100) / newValue) - 100;
    }

    static convertBigJSInStr(value: BigJS, precision: number): string {
        return Number(value).toFixed(precision);
    }
}