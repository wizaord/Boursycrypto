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

/*
{
	"created_at": "2017-12-15T08:03:10.016Z",
	"trade_id": 1225775,
	"product_id": "LTC-EUR",
	"order_id": "fcef122c-a5d8-424b-9750-13a80501383a",
	"user_id": "5a0072d571047e00bf56138a",
	"profile_id": "bc56d860-7e12-4111-8f1e-da0dbb27696b",
	"liquidity": "M",
	"price": "225.01000000",
	"size": "0.36644149",
	"fee": "0.0000000000000000",
	"side": "buy",
	"settled": true
}
 */
import { BigJS } from 'gdax-trading-toolkit/build/src/lib/types';

export interface Fill {
    created_at: Date;       // date de la transaction
    trade_id: number;       // l'identifiant de la transaction
    order_id: string;       // l'identifiant de l'ordre
    price: BigJS;           // le prix en € de la transaction
    size: BigJS;            // la quantite de COIN dans la transaction
    fee: BigJS;             // les frais de la transaction
    side: string;
}

export interface GDAXFill {
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

/*
    "id": "d0c5340b-6d6c-49d9-b567-48c4bfca13d2",
    "price": "0.10000000",
    "size": "0.01000000",
    "product_id": "BTC-USD",
    "side": "buy",
    "stp": "dc",
    "type": "limit",
    "time_in_force": "GTC",
    "post_only": false,
    "created_at": "2016-12-08T20:02:28.53864Z",
    "fill_fees": "0.0000000000000000",
    "filled_size": "0.00000000",
    "executed_value": "0.0000000000000000",
    "status": "open",
    "settled": false
*/
export interface GDAXOrder {
   id: string;
   price: BigJS;
   size: BigJS;
   product_id: string;
   side: string;
   stp: string;
   type: string;
   time_in_force: string;
   post_only: boolean;
   create_at: Date;
   fill_fees: BigJS;
   filled_size: BigJS;
   executed_value: BigJS;
   status: string;
   settled: boolean;
   stop: string;
   stop_price: BigJS;
}
