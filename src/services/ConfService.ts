
import * as YAML from 'yamljs';

export class ConfService {
    public configurationFile: any;
    public isModeSimu: boolean;

    /**
     * Default constructor. Need the path to the configuration file
     * @param {string} filePath
     */
    constructor(isModeSimu: boolean, filePath: string) {
        this.isModeSimu = isModeSimu;
        this.loadConfiguration(filePath);
    }

    /**
     * Load the configuration file. return an error if the file is not well formatted
     * @param {string} filePath
     * @returns {any}
     */
    private loadConfiguration(filePath: string): any {
        console.log('Chargement du fichier de configuration : ' + filePath);
        this.configurationFile = YAML.load(filePath);
    }
}
