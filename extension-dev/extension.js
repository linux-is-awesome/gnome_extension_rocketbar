import Extension from './extensionBase.js';
import { RuntimeLocation, JSONConfig } from './devUtils.js';

const RUNTIME_SEARCH_PATH = '.runtime';
const DUMMY_CONFIG_SEARCH_PATH = 'config';
const DUMMY_CONFIG_FILE_TYPE = '.json';
const SETTINGS_SCHEMA_KEY = 'settings-schema';

export default class extends Extension {

    /**
     * @override
     * @type {string}
     */
    get runtimePath() {
        return `/${RUNTIME_SEARCH_PATH}${RuntimeLocation(`${this.path}/${RUNTIME_SEARCH_PATH}`)}${super.runtimePath}`;
    }

    /**
     * Returns config loaded from a .json file.
     *
     * @override
     * @param {string} [schemaId]
     * @returns {{[key: string]: *}}
     */
    getSettings(schemaId) {
        schemaId ||= this.metadata[SETTINGS_SCHEMA_KEY];
        if (!schemaId) return {};
        return JSONConfig(`${this.path}/${DUMMY_CONFIG_SEARCH_PATH}/${schemaId}${DUMMY_CONFIG_FILE_TYPE}`);
    }

}
