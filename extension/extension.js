import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const INIT_MODULE_PATH = '/core/init.js';

export default class extends Extension {

    /**
     * @typedef {import('./core/unit.js').default} Unit
     * @type {Unit}
     */
    #runtime = null;

    /** @type {boolean} */
    #isEnabled = false;

    /** @type {string} allows to override the path for development needs */
    get runtimePath() {
        return INIT_MODULE_PATH;
    }

    enable() {
        this.#isEnabled = true;
        if (this.#runtime) return;
        this.#initialize();
    }

    /**
     * Note: `unlock-dialog` session mode is explicitly defined in the metadata.json file,
     *       because the following modules of this extension have to be running on the lock screen (unless disabled via settings):
     *       - Launcher API Service
     *       - Notification Counter
     *       - ...
     *       The extension will not be running on the locksreen if none of these are enabled.
     * 
     *       Also, this method performs a check to prevent the extension from being disabled, and there is a reason for this check.
     *       After starting user session and locking screen for the first time,
     *       Gnome Shell turns the extension off and on for no reason 5-6 times.
     *       This ONLY happens the first time the screen gets locked.
     *       This behavior leads to performance issues and I want to avoid them as much as possible.
     *       So, I let the `runtime` decide if it can be destroyed. The behavior is explained in code of the `runtime` itself.
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
