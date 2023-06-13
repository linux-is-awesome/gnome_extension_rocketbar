/* exported Context */

import St from 'gi://St';
import Gtk from 'gi://Gtk';
import { ExtensionUtils, Main } from './legacy.js';
import { LayoutManager } from './context/layout.js';
import { Modules } from './context/modules.js';
import { Jobs } from './context/jobs.js';
import { Signals } from './context/signals.js';
import { LauncherApiClient } from '../services/launcherApiService.js';

const CUSTOM_ICONS_PATH = '/assets/icons/';

export class Context {

    /**
     * Persistent cache to keep some data until user session end/shell restart
     * @type {Map<*, Map>}
     */
    static #sessionCache = null;

    /** @type {Context} */
    static #instance = null;

    /** @type {{path: string, metadata: Object.<string, string>}} */
    #extensionInfo = ExtensionUtils.getCurrentExtension();

    /** @type {Gio.Settings} */
    #settings = ExtensionUtils.getSettings();

    /** @type {LayoutManager} */
    #layoutManager = null;

    /** @type {Modules} */
    #modules = null;

    /** @type {Jobs} */
    #jobs = null;

    /** @type {Signals} */
    #signals = null;

    /** @type {St.IconTheme|Gtk.IconTheme} */
    #iconTheme = null;

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
        return Context.#getInstance().#settings;
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

    /** @type {St.IconTheme|Gtk.IconTheme} */
    static get iconTheme() {
        return Context.#getInstance().#iconTheme;
    }

    /** @type {LauncherApiClient} */
    static get launcherApi() {
        return Context.#getInstance().#launcherApi;
    }

    /** @type {boolean} */
    static get isSessionLocked() {
        return Main.sessionMode?.isLocked || Main.layoutManager?.screenShieldGroup?.visible;
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

    constructor() {
        if (Context.#instance instanceof Context) throw new Error(`${Context.name} already has an instance`);
        Context.#instance = this;
        this.#iconTheme = St.IconTheme ? new St.IconTheme() : Gtk.IconTheme.get_default();
        this.#launcherApi = new LauncherApiClient();
        this.#modules = new Modules();
    }

    destroy() {
        try {
            this.#destroy();
        } catch (e) {
            console.error(`${this.#extensionInfo?.metadata?.name} unable to destroy ${Context.name}.`, e);
        } finally {
            this.#extensionInfo = null;
            Context.#instance = null;
        }
    }

    #destroy() {
        this.#modules?.destroy();
        this.#modules = null;
        this.#layoutManager?.destroy();
        this.#layoutManager = null;
        this.#jobs?.destroy();
        this.#jobs = null;
        this.#signals?.destroy();
        this.#signals = null;
        this.#launcherApi?.destroy();
        this.#launcherApi = null;
        this.#iconTheme = null;
        this.#settings?.run_dispose();
        this.#settings = null;
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
