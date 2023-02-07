/* exported Context */

import { Main } from './legacy.js';
import { LayoutManager } from './context/layout.js';
import { Modules } from './context/modules.js';
import { Jobs } from './context/jobs.js';
import { Signals } from './context/signals.js';
import { Icons } from './context/icons.js';
import { LauncherApiClient } from '../services/launcherApiService.js';

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

    /** @type {LayoutManager} */
    #layoutManager = null;

    /** @type {Modules} */
    #modules = null;

    /** @type {Jobs} */
    #jobs = null;

    /** @type {Signals} */
    #signals = null;

    /** @type {Icons} */
    #icons = null;

    /** @type {LauncherApiClient} */
    #launcherApi = null;

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

    /** @type {LayoutManager} */
    static get layout() {
        const instance = Context.#getInstance();
        if (instance.#layoutManager) return instance.#layoutManager;
        instance.#layoutManager = new LayoutManager();
        return instance.#layoutManager;
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

    /** @type {LauncherApiClient} */
    static get launcherApi() {
        return Context.#getInstance().#launcherApi;
    }

    /** @type {boolean} */
    static get isSessionLocked() {
        return Main.sessionMode?.isLocked || Main.layoutManager?.screenShieldGroup?.visible;
    }

    /** @type {boolean} */
    static get isSessionStartingUp() {
        return Main.layoutManager?._startingUp;
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

    /** 
     * @returns {Context}
     */
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
        this.#launcherApi = new LauncherApiClient();
        this.#modules = new Modules();
    }

    destroy() {
        try {
            this.#destroy();
        } catch(e) {
            console.error(`${this.#extensionInfo?.metadata?.name} unable to destroy context.`, e);
        } finally {
            this.#extensionInfo = null;
            if (Context.#instance !== this) return;
            Context.#instance = null;
        }
    }

    #destroy() {
        this.#modules?.destroy();
        this.#modules = null;
        this.#layoutManager?.destroy();
        this.#layoutManager = null;
        this.#icons?.destroy();
        this.#icons = null;
        this.#jobs?.destroy();
        this.#jobs = null;
        this.#signals?.destroy();
        this.#signals = null;
        this.#launcherApi?.destroy();
        this.#launcherApi = null;
        this.#extensionInfo?.settings?.run_dispose();
        this.#cleanSessionCache();
    }

    #cleanSessionCache() {
        if (!Context.#sessionCache) return;
        if (!Context.isSessionLocked) {
            Context.#sessionCache = null;
            return;
        }
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
