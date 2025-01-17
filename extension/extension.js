/**
 * @typedef {import('./main/core/context.js').default} Context
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const DEFAULT_RUNTIME_PATH = '/main/core/context.js';

export default class extends Extension {

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
        } catch (e) {
            console.error(`${this.metadata.name} runtime destroy failed.`, e);
        } finally {
            this.#runtime = null;
        }
    }

    async #initialize() {
        try {
            const runtimeModule = await import(`.${this.runtimePath}`);
            if (!this.#isEnabled || this.#runtime) return;
            this.#runtime = new runtimeModule.default(this);
        } catch (e) {
            console.error(`${this.metadata.name} runtime initialization failed.`, e);
        }
    }

}
