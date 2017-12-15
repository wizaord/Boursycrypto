import { GDAXExchangeAPI, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { Balances } from 'gdax-trading-toolkit/build/src/exchanges/AuthenticatedExchangeAPI';
import { padfloat, printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import { Big, BigJS } from 'gdax-trading-toolkit/build/src/lib/types';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { ConfService } from './ConfService';
import { Fill, GDAXFill, GDAXOrder } from '../model/fill';

export class AccountService {

    private gdaxExchangeApi: GDAXExchangeAPI;
    private confService: ConfService;

    private money: BigJS;          // argent disponible sur le compte
    private btc: BigJS;            // Coin disponible sur le compte
    private lastFill: Fill;

    public constructor(options: GDAXFeedConfig, confService: ConfService) {
        this.gdaxExchangeApi = new GDAXExchangeAPI(options);
        this.confService = confService;
    }

    public refreshFromGDAX(): void {
        this.loadBalance();
        this.loadAndLogLastFill();
        this.loadAndLogLastOrder();
        this.showOrders();
    }

    public loadBalance(): void {
        console.log('Retrieving account balances..');
        this.gdaxExchangeApi.loadBalances().then((balances: Balances) => {
            for (const profile in balances) {
                const account = balances[profile];
                this.money = account.EUR.available;
                this.btc = account[this.confService.configurationFile.application.product.type].available;
            }
            this.logBalance();
        });
    }

    public logBalance(): void {
        console.log(printSeparator());
        console.log('Balance successfully loaded : ');
        console.log(`Money: ${padfloat(this.money, 8, 4)} €`);
        console.log(`BTC:   ${padfloat(this.btc, 8, 4)} BTC`);
        console.log(printSeparator());
    }

    public loadAndLogLastFill(): void {
        this.loadLastFill()
            .then((value) => {
                this.lastFill = value;
                this.logLastFill();
                this.logMode();
            });
    }

    public loadLastFill(): Promise<Fill> {
        const apiCall = this.gdaxExchangeApi.authCall('GET', `/fills`, {});
        return Promise.resolve(this.gdaxExchangeApi.handleResponse<Fill[]>(apiCall, null).then((fills: GDAXFill[]) => {
            // on ne prend que l'ordre le plus recent

            return fills.filter((f) => f.product_id === this.confService.configurationFile.application.product.name)
                .sort((a, b) => {
                    return (a.trade_id - b.trade_id) * -1;
                })
                .map((value) => {
                    const customFill: Fill = {
                        created_at: value.created_at,
                        order_id: value.order_id,
                        trade_id: value.trade_id,
                        side: value.side,
                        price: value.price,
                        fee: value.fee,
                        size: value.size
                    };
                    return customFill;
                })[0];
        }));
    }

    public loadAndLogLastOrder(): void {
        const apiCall = this.gdaxExchangeApi.authCall('GET', `/orders`, {});
        this.gdaxExchangeApi.handleResponse<GDAXOrder[]>(apiCall, null).then((orders: GDAXOrder[]) => {
            // orders.filter((o) => o.product_id === this.confService.configurationFile.application.product.name)
            //     .forEach((value) => {
            //         this.logCurrentOrder(value);
            //     });
            return;
        });
    }

    public logLastFill(): void {
        console.log(printSeparator());
        console.log('The last fill passed : ');
        console.log(`Date :     ${this.lastFill.created_at}`);
        console.log(`buy/sell : ${this.lastFill.side}`);
        console.log(`Cost :     ${padfloat(this.lastFill.fee, 8, 4)} €`);
        console.log(`Price :    ${padfloat(this.lastFill.price, 8, 4)} €`);
        console.log(`Size :     ${padfloat(this.lastFill.size, 8, 4)} ${this.confService.configurationFile.application.product.type}`);
        console.log(JSON.stringify(this.lastFill));
        console.log(printSeparator());
    }

    public logMode(): void {
        console.log(printSeparator());
        console.log('MODE : ');
        if (this.orderInProgress) {
            console.log('Your last order is a BUY order => SELL MODE');
        } else {
            console.log('Your last order is a SELL order => BUY MODE');
        }
        console.log(printSeparator());
    }

    public showBalances(): void {
        console.log('Retrieving account balances..');
        this.gdaxExchangeApi.loadBalances().then((balances: Balances) => {
            for (const profile in balances) {
                const account = balances[profile];
                for (const cur in account) {
                    const bal = account[cur];
                    console.log(`Balances for ${cur} in ${profile}:`);
                    console.log(`Available: ${padfloat(bal.available, 8, 4)} ${cur}`);
                    console.log(`Total:     ${padfloat(bal.balance, 8, 4)} ${cur}\n`);
                }
            }
            console.log(printSeparator());
        });
    }

    public showOrders(): void {
        console.log('Showing orders');
        this.gdaxExchangeApi.loadAllOrders(this.confService.configurationFile.application.product.name).then((orders) => {
            let total: BigJS = Big(0);
            console.log(orders);
            orders.forEach((o: LiveOrder) => {
                total = total.plus(o.size);
            });
            console.log(`You have ${orders.length} orders on the book for a total of ${total.toFixed(1)} BTC`);
        });
    }

    get orderInProgress(): Promise<boolean> {
        if (this.lastFill === undefined) {
            return Promise.resolve(this.loadLastFill().then((value) => {
                return value.side === 'buy';
            }));

        } else {
            return Promise.resolve(this.lastFill.side === 'buy');
        }
    }
}
