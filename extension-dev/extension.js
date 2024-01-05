import Extension from './extensionBase.js';
import { RuntimeLocation, DummyConfig } from './devUtils.js';

const RUNTIME_SEARCH_PATH = '.runtime';
const DUMMY_CONFIG_SEARCH_PATH = 'config';
const DUMMY_CONFIG_FILE_TYPE = '.json';
const SETTINGS_SCHEMA_KEY = 'settings-schema';

export default class extends Extension {

    /** @type {string} */
    get runtimePath() {
        return `/${RUNTIME_SEARCH_PATH}${RuntimeLocation(`${this.path}/${RUNTIME_SEARCH_PATH}`)}${super.runtimePath}`;
    }

    /**
     * @param {string} [schemaId]
     * @returns {Object.<string, *>}
     */
    getSettings(schemaId) {
        schemaId ??= this.metadata[SETTINGS_SCHEMA_KEY];
        if (!schemaId) return {};
        return DummyConfig(`${this.path}/${DUMMY_CONFIG_SEARCH_PATH}/${schemaId}${DUMMY_CONFIG_FILE_TYPE}`);
    }

}
