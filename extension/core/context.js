/* exported Context */

const ExtensionUtils = imports.misc.extensionUtils;
const Extension = imports.ui.extensionSystem.rocketbar;

const { Signals } = Extension.imports.core._context.signals;
const { Icons } = Extension.imports.core._context.icons;
const { LauncherAPI } = Extension.imports.core._context.launcherAPI;

var Context = class {

    /** @type {Context} */
    static #instance = null;

    /** @type {Gio.Settings} */
    #settings = null;

    /** @type {Signals} */
    #signals = null;

    /** @type {Icons} */
    #icons = null;

    /** @type {LauncherAPI} */
    #launcherAPI = new LauncherAPI();

    /** @type {Gio.Settings} */
    static get settings() {
        const instance = Context.#getInstance();
        if (instance.#settings) return instance.#settings;
        instance.#settings = ExtensionUtils.getSettings();
        return instance.#settings;
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

    constructor() {
        if (Context.#instance instanceof Context) return;
        Context.#instance = this;
    }

    destroy() {
        this.#settings?.run_dispose();
        this.#signals?.destroy();
        this.#icons?.destroy();
        this.#launcherAPI?.destroy();
        if (Context.#instance !== this) return;
        Context.#instance = null;
    }

}
