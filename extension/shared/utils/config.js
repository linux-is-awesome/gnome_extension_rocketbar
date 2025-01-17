/**
 * @typedef {{[configField: string]: *} & {[configField: string]: string|boolean|number|null}} Config
 * @typedef {[client: *, details: {[key: string]: *}]} ConfigClient
 */

import GObject from 'gi://GObject';
import Context from '../core/context.js';
import Settings from './settings.js';
import { Event } from '../core/enums.js';

const DUMMY_FIELD_PREFIX = '~';

/**
 * @param {*} client
 * @param {{[configField: string]: string}} fields
 * @param {(settingsKey: string) => void} [callback]
 * @param {{path?: string?, isAfter?: boolean}} [options]
 * @returns {Config}
 */
export const Config = (client, fields, callback, options = { path: null, isAfter: false }) => {
    if (!client || !fields) return {};
    const { path, isAfter } = options ?? {};
    /** @type {Settings?} */
    const settings = Context.getSettings(path);
    if (!settings) return {};
    /** @type {Config} */
    const values = {};
    /** @type {(string|GObject.ConnectFlags|((_, key: string) => void))[]} */
    const signals = [];
    /** @type {Map<string?, string>}*/
    const valueMapping = new Map();
    /** @type {(_, key: string) => void} */
    const valueHandler = (_, key) => {
        const configField = valueMapping.get(key);
        if (!configField) return;
        values[configField] = settings.get(key);
        if (typeof callback === 'function') callback(key);
    };
    for (const fieldName in fields) {
        const settingsKey = fields[fieldName];
        if (typeof settingsKey !== 'string') continue;
        if (settingsKey.startsWith(DUMMY_FIELD_PREFIX)) {
            values[fieldName] = null;
            continue;
        }
        values[fieldName] = settings.get(settingsKey);
        valueMapping.set(settingsKey, fieldName);
        signals.push(`${Event.Changed}::${settingsKey}`, valueHandler);
        if (isAfter) signals.push(GObject.ConnectFlags.AFTER);
    }
    if (signals.length) Context.signals.add(client, [settings.source, ...signals]);
    return values;
};

/**
 * @param {Config|Settings} parentConfig
 * @param {string} field
 * @returns {*}
 */
export const InnerConfig = (parentConfig, field) => {
    try {
        const value = parentConfig instanceof Settings ?
                      parentConfig.get(field) :
                      parentConfig?.[field];
        if (typeof value === 'string' && value.length) return JSON.parse(value);
    } catch (e) {
        Context.logError(`${InnerConfig.name} failed to parse value for field "${field}".`, e);
    }
    return null;
};

export class SharedConfig {

    /** @type {Config?} */
    #config = null;

    /** @type {Map<*, {[key: string]: *}>?} */
    #clients = new Map();

    /** @type {((client: ConfigClient, settingsKey: string) => void)?} */
    #configHandler = this.#handleClientConfig;

    /** @param {(client: ConfigClient, settingsKey: string) => void} callback */
    set configHandler(callback) {
        if (typeof callback !== 'function') return;
        this.#configHandler = callback;
    }

    /**
     * @param {{[configField: string]: string}} fields
     * @param {{path?: string?, isAfter?: boolean}} [options]
     */
    constructor(fields, options) {
        if (!fields) return;
        this.#config = Config(this, fields, settingsKey => this.#handleConfig(settingsKey), options);
    }

    /**
     * @param {*} [client]
     * @param {(settingsKey: string) => void} [callback]
     * @returns {Config?}
     */
    getConfig(client, callback) {
        if (client) this.#clients?.set(client, { callback });
        return this.#config;
    }

    /**
     * @param {*} client
     * @returns {{[key: string]: *}}
     */
    getClientDetails(client) {
        if (!client) return {};
        if (this.#clients && !this.#clients.has(client)) this.#clients.set(client, {});
        return this.#clients?.get(client) ?? {};
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    hasClient(client) {
        return this.#clients?.has(client) ?? false;
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    destroy(client) {
        if (!this.#clients) return true;
        if (!this.#clients.has(client)) return false;
        this.#clients.delete(client);
        if (this.#clients.size) return false;
        Context.signals.removeAll(this);
        this.#clients = null;
        this.#configHandler = null;
        this.#config = null;
        return true;
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        if (!this.#clients?.size || !this.#configHandler) return;
        for (const client of this.#clients) this.#configHandler(client, settingsKey);
    }

    /**
     * @param {ConfigClient} client
     * @param {string} settingsKey
     */
    #handleClientConfig(client, settingsKey) {
        if (!client?.length) return;
        const [_, { callback }] = client;
        if (typeof callback === 'function') callback(settingsKey);
    }

}
