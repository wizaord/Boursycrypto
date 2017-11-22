/**
 * {"created_at":"2017-11-22T13:08:05.323Z",
 * "trade_id":5574683,
 * "product_id":"BTC-EUR",
 * "order_id":"65269c2d-d293-48b4-911d-04c77e80cce6",
 * "user_id":"5a0072d571047e00bf56138a",
 * "profile_id":"bc56d860-7e12-4111-8f1e-da0dbb27696b",
 * "liquidity":"T",
 * "price":"7132.92000000",
 * "size":"0.01404327",
 * "fee":"0.2504238036210000","side":"buy","settled":true}
 */
import { BigJS } from 'gdax-trading-toolkit/build/src/lib/types';

export interface Fill {
    created_at: Date;
    trade_id: number;
    product_id: string;
    order_id: string;
    user_id: string;
    profile_id: string;
    liquidity: string;
    price: BigJS;
    size: BigJS;
    fee: BigJS;
    side: string;
    settled: string;
}
