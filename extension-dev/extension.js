/**
 * JSDoc types
 *
 * @typedef {import('gi://Gio').Settings} Gio.Settings
 */

import Extension from './extensionBase.js';
import { RuntimeLocation, JSONConfig } from './devUtils.js';

const RUNTIME_SEARCH_PATH = '.runtime';
const JSON_CONFIG_SEARCH_PATH = 'config';
const JSON_CONFIG_FILE_TYPE = '.json';
const DEV_CONFIG_PATH = '.dev';
const SETTINGS_SCHEMA_KEY = 'settings-schema';

/** @enum {string} */
const DevConfigFields = {
    JsonConfig: 'json-config'
};

export default class extends Extension {

    /** @type {boolean} */
    #jsonConfig = true;

    /**
     * @override
     * @type {string}
     */
    get runtimePath() {
        return `/${RUNTIME_SEARCH_PATH}${RuntimeLocation(`${this.path}/${RUNTIME_SEARCH_PATH}`)}${super.runtimePath}`;
    }

    /**
     * @override
     */
    enable() {
        this.#loadConfig();
        super.enable();
    }

    /**
     * @override
     */
    disable() {
        this.#jsonConfig = true;
        super.disable();
    }

    /**
     * Returns config loaded from a .json file.
     *
     * @override
     * @param {string} [schemaId]
     * @returns {{[key: string]: *}|Gio.Settings}
     */
    getSettings(schemaId) {
        if (!this.#jsonConfig) return super.getSettings(schemaId);
        schemaId ||= this.metadata[SETTINGS_SCHEMA_KEY];
        if (!schemaId) return {};
        return JSONConfig(`${this.path}/${JSON_CONFIG_SEARCH_PATH}/${schemaId}${JSON_CONFIG_FILE_TYPE}`);
    }

    #loadConfig() {
        const schemaId = this.metadata[SETTINGS_SCHEMA_KEY];
        if (!schemaId) return;
        const devConfigId = `${schemaId}${DEV_CONFIG_PATH}`;
        const devConfig = this.getSettings(devConfigId);
        const jsonConfigValue = devConfig?.[DevConfigFields.JsonConfig];
        if (typeof jsonConfigValue !== 'boolean') return;
        this.#jsonConfig = jsonConfigValue;
    }

}
