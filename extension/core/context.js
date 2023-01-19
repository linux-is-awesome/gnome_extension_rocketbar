/* exported Context */

import { Modules } from './context/modules.js';
import { Jobs } from './context/jobs.js';
import { Signals } from './context/signals.js';
import { Icons } from './context/icons.js';
import { LauncherAPI } from './context/launcherAPI.js';

export class Context {

    /**
     * Persistent cache to keep some data until user session end/shell restart
     * @type {Map<*, Map>}
     */
    static #sessionCache = null;

    /** @type {Context} */
    static #instance = null;

    /** @type {{path: string, metadata: Object.<string, string>, settings: Gio.Settings}} */
    #extensionInfo = null;

    /** @type {Modules} */
    #modules = null;

    /** @type {Jobs} */
    #jobs = null;

    /** @type {Signals} */
    #signals = null;

    /** @type {Icons} */
    #icons = null;

    /** @type {LauncherAPI} */
    #launcherAPI = new LauncherAPI();

    /** @type {string} */
    static get path() {
        return Context.#getInstance().#extensionInfo?.path;
    }

    /** @type {Object.<string, string>} */
    static get metadata() {
        return Context.#getInstance().#extensionInfo?.metadata;
    }

    /** @type {Gio.Settings} */
    static get settings() {
        return Context.#getInstance().#extensionInfo?.settings;
    }

    /** @type {Jobs} */
    static get jobs() {
        const instance = Context.#getInstance();
        if (instance.#jobs) return instance.#jobs;
        instance.#jobs = new Jobs();
        return instance.#jobs;
    }

    /** @type {Signals} */
    static get signals() {
        const instance = Context.#getInstance();
        if (instance.#signals) return instance.#signals;
        instance.#signals = new Signals();
        return instance.#signals;
    }

    /** @type {Icons} */
    static get icons() {
        const instance = Context.#getInstance();
        if (instance.#icons) return instance.#icons;
        instance.#icons = new Icons();
        return instance.#icons;
    }

    /** @type {LauncherAPI} */
    static get launcherAPI() {
        return Context.#getInstance().#launcherAPI;
    }

    /**
     * @param {*} client
     * @returns {Map}
     */
    static getSessionCache(client) {
        if (!client) return null;
        if (!Context.#sessionCache) {
            Context.#sessionCache = new Map();
        }
        if (!Context.#sessionCache.has(client)) Context.#sessionCache.set(client, new Map());
        return Context.#sessionCache.get(client);
    }

    static #getInstance() {
        if (Context.#instance instanceof Context) return Context.#instance;
        return new Context();
    }

    /**
     * @param {{path: string, metadata: Object.<string, string>, settings: Gio.Settings}} extensionInfo 
     */
    constructor(extensionInfo) {
        this.#extensionInfo = extensionInfo;
        if (Context.#instance instanceof Context) return;
        Context.#instance = this;
        this.#modules = new Modules();
    }

    destroy() {
        this.#modules?.destroy();
        this.#modules = null;
        this.#jobs?.destroy();
        this.#jobs = null;
        this.#signals?.destroy();
        this.#signals = null;
        this.#icons?.destroy();
        this.#icons = null;
        this.#launcherAPI?.destroy();
        this.#launcherAPI = null;
        this.#extensionInfo?.settings?.run_dispose();
        this.#extensionInfo = null;
        this.#cleanSessionCache();
        if (Context.#instance !== this) return;
        Context.#instance = null;
    }

    #cleanSessionCache() {
        if (!Context.#sessionCache) return;
        const clients = [...Context.#sessionCache.keys()];
        for (let i = 0, l = clients.length; i < l; ++i) {
            const client = clients[i];
            if (Context.#sessionCache.get(client)?.size) continue;
            Context.#sessionCache.delete(client);
        }
        if (Context.#sessionCache.size) return;
        Context.#sessionCache = null;
    }

}
