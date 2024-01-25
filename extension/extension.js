/**
 * JSDoc types
 *
 * @typedef {import('./core/context.js').default} Context
 */

import { Extension as ShellExtension } from 'resource:///org/gnome/shell/extensions/extension.js';

const DEFAULT_RUNTIME_PATH = '/core/context.js';

export default class Extension extends ShellExtension {

    /** @type {Context?} */
    #runtime = null;

    /** @type {boolean} */
    #isEnabled = false;

    /** @type {string} allows to override the path for development needs */
    get runtimePath() {
        return DEFAULT_RUNTIME_PATH;
    }

    /**
     * @override
     */
    enable() {
        this.#isEnabled = true;
        if (this.#runtime) return;
        this.#initialize();
    }

    /**
     * @override
     */
    disable() {
        this.#isEnabled = false;
        try {
            this.#runtime?.destroy();
            this.#runtime = null;
        } catch (e) {
            console.error(`${this.metadata.name} runtime destroy call failed.`, e);
        }
    }

    /**
     * Note: Lazy loading of the `runtime` module to reduce resource consumption while the extension is not enabled.
     *       Also allows to handle unexpected behaviors and log error messages for troubleshooting.
     */
    async #initialize() {
        try {
            const runtimeModule = await import(`.${this.runtimePath}`);
            if (!this.#isEnabled || this.#runtime) return;
            this.#runtime = new runtimeModule.default(this);
        } catch (e) {
            console.error(`${this.metadata.name} initialization failed.`, e);
        }
    }

}
