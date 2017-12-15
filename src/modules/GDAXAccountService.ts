import { GDAXExchangeAPI, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { BigJS } from 'gdax-trading-toolkit/build/src/lib/types';
import { Balances } from 'gdax-trading-toolkit/build/src/exchanges/AuthenticatedExchangeAPI';
import { padfloat, printSeparator } from 'gdax-trading-toolkit/build/src/utils';

export class GDAXAccountService {
    public options: GDAXFeedConfig;
    public confService: ConfService;
    private gdaxExchangeApi: GDAXExchangeAPI;

    private money: BigJS;          // argent disponible sur le compte
    private btc: BigJS;

    // Coin disponible sur le compte

    constructor() {
        console.log('Create - GDAXAccountService');

    }

    public inject(options: GDAXFeedConfig, confService: ConfService): void {
        console.log('Inject - GDAXAccountService');
        this.options = options;
        this.confService = confService;
        this.gdaxExchangeApi = new GDAXExchangeAPI(options);

    }

    public init(): void {
        console.log('Init - GDAXAccountService');
        this.loadBalance();
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
}
