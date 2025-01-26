/**
 * @typedef {import('resource:///org/gnome/shell/extensions/sharedInternals').ExtensionBase} Extension
 */

import Jobs from './context/jobs.js';
import Signals from './context/signals.js';
import Settings from '../utils/settings.js';
import { MetadataField } from './enums.js';

/** @type {Context?} */
let _instance = null;

/** @type {Map<*, Map>?} a persistent cache to keep some data until the user's session ends or the extension gets disabled by the user */
let _sessionStorage = null;

export default class Context {

    /** @type {Context} */
    static get instance() {
        if (!_instance) throw new Error(`${this.name} has no instance.`);
        return _instance;
    }

    /** @type {{[key: string]: *}?} */
    static get metadata() {
        return this.instance.#extension?.metadata;
    }

    /** @type {string?} */
    static get path() {
        return this.instance.#extension?.path ?? null;
    }

    /** @type {((text: string) => string)} */
    static get gettext() {
        const extension = this.instance.#extension;
        if (!extension) throw new Error(`${this.name} is invalid.`);
        return text => extension.gettext(text);
    }

    /** @type {Jobs} */
    static get jobs() {
        const instance = this.instance;
        instance.#jobs ??= new Jobs();
        return instance.#jobs;
    }

    /** @type {Signals} */
    static get signals() {
        const instance = this.instance;
        instance.#signals ??= new Signals();
        return instance.#signals;
    }

    /**
     * @param {string?} [path]
     * @returns {Settings?}
     */
    static getSettings(path) {
        try {
            const extension = this.instance.#extension;
            if (!extension) return null;
            const schemaId = path ? `${extension.metadata[MetadataField.SettingsSchema]}.${path}` : '';
            const storage = this.getStorage(this.name);
            if (storage.has(schemaId)) return storage.get(schemaId);
            const settings = new Settings(extension.getSettings(schemaId));
            storage.set(schemaId, settings);
            return settings;
        } catch (e) {
            this.logError(`unable to load settings for the path ${path}.`);
        }
        return null;
    }

    /**
     * @param {*} client
     * @returns {Map}
     */
    static getStorage(client) {
        if (!_instance) throw new Error(`${this.name} is invalid.`);
        if (!client) throw new Error(`${this.name}.getStorage requires a client reference.`);
        _sessionStorage ??= new Map();
        const clientStorage = _sessionStorage.get(client) ?? new Map();
        _sessionStorage.set(client, clientStorage);
        return clientStorage;
    }

    /**
     * @param {string?} [message]
     * @param {*} [error]
     */
    static logError(message, error) {
        console.error(`${this.metadata?.name ?? this.name} ${message ?? ''}`, error ?? '');
    }

    /** @type {Extension?} */
    #extension = null;

    /** @type {Jobs?} */
    #jobs = null;

    /** @type {Signals?} */
    #signals = null;

    /** @type {() => boolean} */
    #destroyCallback = () => true;

    /**
     * @param {Extension} extension
     * @param {() => boolean} [destroyCallback] return `true` to destroy the session storage, otherwise return `false`
     */
    constructor(extension, destroyCallback) {
        if (_instance) throw new Error(`${this.constructor.name} already has an instance.`);
        if (!extension) throw new Error(`${this.constructor.name} requires an instance of the extension class.`);
        this.#extension = extension;
        this.#destroyCallback = destroyCallback ?? this.#destroyCallback;
        _instance = this;
    }

    destroy() {
        try {
            const callbackResult = this.#destroyCallback();
            this.#jobs?.removeAll(this);
            this.#jobs?.destroy();
            this.#signals?.destroy();
            this.#cleanSessionStorage(callbackResult);
        } catch (e) {
            Context.logError(`unable to destroy ${this.constructor.name}.`, e);
        } finally {
            this.#jobs = null;
            this.#signals = null;
            this.#extension = null;
            _instance = null;
        }
    }

    /**
     * @param {boolean} nullify
     */
    #cleanSessionStorage(nullify) {
        if (!_sessionStorage) return;
        if (nullify) {
            _sessionStorage.clear();
            _sessionStorage = null;
            return;
        }
        _sessionStorage.delete(this.constructor.name);
        const clients = [..._sessionStorage.keys()];
        for (let i = 0, l = clients.length; i < l; ++i) {
            const client = clients[i];
            if (_sessionStorage.get(client)?.size) continue;
            _sessionStorage.delete(client);
        }
        if (_sessionStorage.size) return;
        _sessionStorage = null;
    }

}
