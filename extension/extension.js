import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const DEFAULT_RUNTIME_PATH = '/core/context.js';

export default class extends Extension {

    /**
     * @typedef {import('./core/context.js').default} Context
     * @type {Context}
     */
    #runtime = null;

    /** @type {boolean} */
    #isEnabled = false;

    /** @type {string} Allows to override the path for development needs */
    get runtimePath() {
        return DEFAULT_RUNTIME_PATH;
    }

    enable() {
        this.#isEnabled = true;
        if (this.#runtime) return;
        this.#initialize();
    }

    /**
     * Note: Let the `runtime` decide if it can be destroyed or not.
     *       Please note that by default destroy() function will return True.
     *       But the user can change this behavior via the extension settings.
     */
    disable() {
        this.#isEnabled = false;
        if (!this.#runtime?.destroy()) return;
        this.#runtime = null;
    }

    /**
     * Note: Using dynamic loading of the `runtime` module to reduce RAM/CPU consumption when the extension is not enabled.
     *       This also allows to handle many unexpected behaviors and log error messages for troubleshooting.
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
