/* exported Context */

import { Modules } from './context/modules.js';
import { Async } from './context/async.js';
import { Signals } from './context/signals.js';
import { Icons } from './context/icons.js';
import { LauncherAPI } from './context/launcherAPI.js';

export class Context {

    /** @type {Context} */
    static #instance = null;

    /** @type {{path: string, metadata: Object.<string, string>, settings: Gio.Settings}} */
    #extensionInfo = null;

    /** @type {Modules} */
    #modules = null;

    /** @type {Async} */
    #async = null;

    /** @type {Signals} */
    #signals = null;

    /** @type {Icons} */
    #icons = null;

    /** @type {LauncherAPI} */
    #launcherAPI = new LauncherAPI();

    static get path() {
        return Context.#getInstance().#extensionInfo?.path;
    }

    static get metadata() {
        return Context.#getInstance().#extensionInfo?.metadata;
    }

    /** @type {Gio.Settings} */
    static get settings() {
        return Context.#getInstance().#extensionInfo?.settings;
    }

    /** @type {Async} */
    static get async() {
        const instance = Context.#getInstance();
        if (instance.#async) return instance.#async;
        instance.#async = new Async();
        return instance.#async;
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
        this.#signals?.destroy();
        this.#signals = null;
        this.#icons?.destroy();
        this.#icons = null;
        this.#launcherAPI?.destroy();
        this.#launcherAPI = null;
        this.#extensionInfo?.settings?.run_dispose();
        this.#extensionInfo = null;
        if (Context.#instance !== this) return;
        Context.#instance = null;
    }

}
