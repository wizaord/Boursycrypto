import { GDAXFeedConfig } from 'gdax-trading-toolkit/build/src/exchanges';
import { ConfService } from './ConfService';
import request = require('superagent');
import Response = request.Response;

export class SlackService {

    static SLACK_API = 'https://slack.com/api/';

    public options: GDAXFeedConfig;
    public confService: ConfService;
    static _instance: SlackService;

    private token: string;
    private customerChannel: string;

    constructor() {
        console.log('Create - SlackService');
    }

    public inject(confService: ConfService): void {
        console.log('Inject - SlackService');
        this.confService = confService;
        this.token = this.confService.configurationFile.application.slack.tokenId;
        this.customerChannel = this.confService.configurationFile.application.slack.personalAccountChannel;
        SlackService._instance = this;
    }

    public init(): void {
        console.log('Init - SlackService');
    }

    public postMessage(message: string): void {
        this.sendMessage('chat.postMessage', this.customerChannel, message).then((response) => {
            console.log(JSON.stringify(response));
        });
    }

    private sendMessage(uri: string, channel: string, message: string): Promise<Response> {
        const msgWithPrefixe = `${this.confService.configurationFile.application.product.type}|${message}`;
        const fullUri = `${uri}?token=${SlackService._instance.token}&channel=${channel}&text=${msgWithPrefixe}&pretty=1`
        return request.post(SlackService.SLACK_API + fullUri)
            // .set(headers)
            .send('');
    }
}