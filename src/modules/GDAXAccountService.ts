import { GDAXExchangeAPI, GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from '../services/ConfService';
import { Balances } from 'gdax-trading-toolkit/build/src/exchanges/AuthenticatedExchangeAPI';
import { padfloat, printSeparator } from 'gdax-trading-toolkit/build/src/utils';

export class GDAXAccountService {

    public options: GDAXFeedConfig;
    public confService: ConfService;
    private gdaxExchangeApi: GDAXExchangeAPI;

    private _money: number;          // argent disponible sur le compte
    private _btc: number;

    // Coin disponible sur le compte

    constructor() {
        console.log('Create - GDAXAccountService');
    }

    public inject(options: GDAXFeedConfig, confService: ConfService, gdaxExchangeApi: GDAXExchangeAPI): void {
        this.options = options;
        this.options.logger.log('debug', 'Inject - GDAXAccountService');
        this.confService = confService;
        this.gdaxExchangeApi = gdaxExchangeApi;

    }

    public init(): void {
        this.options.logger.log('debug', 'Init - GDAXAccountService');
        this.loadBalance();
    }

    get money(): number {
        return Number(this._money);
    }
    get btc(): number {
        return Number(this._btc);
    }

    public loadBalance(): Promise<boolean> {
        this.options.logger.log('debug', 'Retrieving account balances..');
        return Promise.resolve(this.gdaxExchangeApi.loadBalances().then((balances: Balances) => {
            for (const profile in balances) {
                const account = balances[profile];
                this._money = Number(account.EUR.available);
                this._btc = Number(account[this.confService.configurationFile.application.product.type].available);
            }
            this.logBalance();
            return true;
        })).catch((reason) => {
            this.options.logger.log('error', 'Error while get the account balance');
            this.options.logger.error(reason);
            logError(reason);
            return Promise.reject(reason);
        });
    }

    public changeBtc(newBtc: number) {
        this._btc = newBtc;
        this.logBalance();
    }

    public logBalance(): void {
        this.options.logger.log('debug', printSeparator());
        this.options.logger.log('debug', 'Balance successfully loaded : ');
        this.options.logger.log('debug', `Money: ${padfloat(this._money, 8, 4)} €`);
        this.options.logger.log('debug', `BTC:   ${padfloat(this._btc, 8, 8)} BTC`);
        this.options.logger.log('debug', printSeparator());
    }
}

function logError(err: any) {
    console.error(printSeparator());
    console.error('Error: ' + err.message);
    if (err && (err.response && err.response.error)) {
        console.error(err.response.error.message);
    }
    console.error(printSeparator());
}
