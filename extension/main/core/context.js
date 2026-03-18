/**
 * @typedef {import('resource:///org/gnome/shell/extensions/extension.js').Extension} Extension
 */

import { MainLayout, Session } from './shell.js';
import SharedContext from '../../shared/core/context.js';
import Desktop from './context/desktop.js';
import Hooks from './context/hooks.js';
import Monitors from './context/monitors.js';
import Modules from '../services/modules.js';
import LauncherApi from '../services/launcherApi.js';
import { SessionModesWatchdog } from '../../shared/utils/sessionModesWatchdog.js';
import { Event, SessionMode } from '../../shared/enums/general.js';

export default class Context extends SharedContext {

    /** @type {Context?} store another context instance in this class to optimize the call path */
    static #instance = null;

    /**
     * @override
     * @type {Context}
     */
    static get instance() {
        if (!this.#instance) throw new Error(`${this.name} has no instance.`);
        return this.#instance;
    }

    /** @type {Desktop} */
    static get desktop() {
        const instance = this.instance;
        instance.#desktop ??= new Desktop();
        return instance.#desktop;
    }

    /** @type {Hooks} */
    static get hooks() {
        const instance = this.instance;
        instance.#hooks ??= new Hooks();
        return instance.#hooks;
    }

    /** @type {Monitors} */
    static get monitors() {
        const instance = this.instance;
        instance.#monitors ??= new Monitors();
        return instance.#monitors;
    }

    /** @type {LauncherApi} */
    static get launcherApi() {
        const result = this.instance.#launcherApi;
        if (!result) throw new Error(`${this.name} has invalid ${LauncherApi.name} instance.`);
        return result;
    }

    /**
     * @override
     * @param {*} client
     */
    static clearStorage(client) {
        if (this.#instance && !this.#instance.#isSessionUnlocked) return;
        super.clearStorage(client);
    }

    /** @type {Modules?} */
    #modules = null;

    /** @type {LauncherApi?} */
    #launcherApi = null;

    /** @type {Desktop?} */
    #desktop = null;

    /** @type {Hooks?} */
    #hooks = null;

    /** @type {Monitors?} */
    #monitors = null;

    /** @type {boolean} */
    get #isSessionUnlocked() {
        return Session.currentMode !== SessionMode.Locksreen &&
               !MainLayout.screenShieldGroup?.visible;
    }

    /**
     * @param {Extension} extension
     */
    constructor(extension) {
        super(extension, () => this.#destroy());
        Context.#instance = this;
        if (this.#isSessionUnlocked) this.#initialize();
        else Context.jobs.new(this).destroy(() => this.#initialize());
    }

    /**
     * @override
     */
    destroy() {
        super.destroy();
        Context.#instance = null;
    }

    #initialize() {
        this.#launcherApi = new LauncherApi();
        this.#modules = new Modules();
        Context.signals.add(this, [global, Event.Shutdown, () => SessionModesWatchdog()]);
    }

    /**
     * @returns {boolean}
     */
    #destroy() {
        const isFinal = this.#isSessionUnlocked;
        try {
            this.#hooks?.destroy();
            this.#modules?.destroy();
            this.#desktop?.destroy();
            this.#monitors?.destroy();
            this.#launcherApi?.destroy(isFinal);
        } finally {
            this.#modules = null;
            this.#launcherApi = null;
            this.#desktop = null;
            this.#hooks = null;
            this.#monitors = null;
        }
        return isFinal;
    }

}
