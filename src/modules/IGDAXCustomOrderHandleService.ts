import { GDAXExchangeAPI, GDAXFeed, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { GDAXTradeService } from './GDAXTradeService';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { Trader } from 'gdax-trading-toolkit/build/src/core';
import { Order } from '../model/fill';

export interface GDAXCustomOrderHandleInterface {
    trader: Trader;

    inject(optionsP: GDAXFeedConfig, confService: ConfService, gdaxTradeService: GDAXTradeService, feed: GDAXFeed, gdaxExchangeApi: GDAXExchangeAPI): void;
    init(): void;
    cancelAllOrders(): Promise<boolean>;
    cancelOrder(orderId: string): Promise<boolean>;
    placeStopSellOrder(priceP: number, nbCoin: number): Promise<LiveOrder>;
    placeLimitOrder(priceP: number, nbCoin: number): Promise<LiveOrder>;

    getLastBuyFill(): Promise<Order>;
}
