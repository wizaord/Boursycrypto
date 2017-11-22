import { GDAXExchangeAPI, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { Balances } from 'gdax-trading-toolkit/build/src/exchanges/AuthenticatedExchangeAPI';
import { padfloat, printSeparator } from 'gdax-trading-toolkit/build/src/utils';
import { Big, BigJS } from 'gdax-trading-toolkit/build/src/lib/types';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { ConfService } from './ConfService';
import { Fill } from '../model/fill';

export class AccountService {

    private gdaxExchangeApi: GDAXExchangeAPI;
    private confService: ConfService;

    private money: BigJS;
    private btc: BigJS;
    private lastFill: Fill;
    private _orderInProgress: boolean;
    // private lastOrder: LiveOrder;

    public constructor(options: GDAXFeedConfig, confService: ConfService) {
        this.gdaxExchangeApi = new GDAXExchangeAPI(options);
        this.confService = confService;
    }

    public refreshFromGDAX(): void {
        this.loadBalance();
        this.loadLastFill();
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

    public loadLastFill(): void {
        const apiCall = this.gdaxExchangeApi.authCall('GET', `/fills`, {});
        this.gdaxExchangeApi.handleResponse<Fill[]>(apiCall, null).then((fills: Fill[]) => {
            // on ne prend que l'ordre le plus recent
            const lastFill = fills.sort((a, b) => a.created_at < b.created_at ? 1 : 0)[0];
            this.lastFill = lastFill;
            this._orderInProgress = this.lastFill.side === 'buy';
            this.logLastFill();
            this.logMode();
        });
    }

    public logLastFill(): void {
        console.log(printSeparator());
        console.log('The last fill passed : ');
        console.log(`Date :     ${this.lastFill.created_at}`);
        console.log(`buy/sell : ${this.lastFill.side}`);
        console.log(`Cost :     ${padfloat(this.lastFill.fee, 8, 4)} €`);
        console.log(`Price :    ${padfloat(this.lastFill.price, 8, 4)} €`);
        console.log(`Size :     ${padfloat(this.lastFill.size, 8, 4)} BTC`);
        console.log(printSeparator());
    }

    public logMode(): void {
        console.log(printSeparator());
        console.log('MODE : ')
        if (this._orderInProgress) {
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
            orders.forEach((o: LiveOrder) => {
                total = total.plus(o.size);
            });
            console.log(`You have ${orders.length} orders on the book for a total of ${total.toFixed(1)} BTC`);
        });
    }

    get orderInProgress(): boolean {
        return this._orderInProgress;
    }
}
