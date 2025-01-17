/**
 * @typedef {import('resource:///org/gnome/shell/extensions/extension.js').Extension} Extension
 */

import SharedContext from '../../shared/core/context.js';
import Desktop from './context/desktop.js';
import Modules from '../services/modules.js';
import LauncherApi from '../services/launcherApi.js';

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

    /** @type {LauncherApi?} */
    static get launcherApi() {
        return this.instance.#launcherApi;
    }

    /** @type {Modules?} */
    #modules = null;

    /** @type {LauncherApi?} */
    #launcherApi = null;

    /** @type {Desktop?} */
    #desktop = null;

    /**
     * @param {Extension} extension
     */
    constructor(extension) {
        super(extension, () => this.#destroy());
        Context.#instance = this;
        if (!Context.desktop.isLocked) this.#initialize();
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
    }

    /**
     * @returns {boolean}
     */
    #destroy() {
        const result = !Context.desktop.isLocked;
        try {
            this.#modules?.destroy();
            this.#desktop?.destroy();
            this.#launcherApi?.destroy();
        } finally {
            this.#modules = null;
            this.#launcherApi = null;
            this.#desktop = null;
        }
        return result;
    }

}
