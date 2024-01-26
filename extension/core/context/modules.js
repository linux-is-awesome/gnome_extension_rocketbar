import Context from '../context.js';
import { Config } from '../../utils/config.js';

/** @type {{[field: string]: string}} */
const Modules = {
    Taskbar: '../../ui/taskbar.js',
    NotificationCounter: '../../ui/notificationCounter.js'
};

/** @type {{[field: string]: string}} */
const ConfigFields = {
    Taskbar: 'taskbar-enabled',
    NotificationCounter: 'notification-counter-enabled'
};

export default class ModulesManager {

    /** @type {{[field: string]: *}?} */
    #modules = {};

    /** @type {Config} */
    #config = Config(this, ConfigFields, () => this.#update());

    constructor() {
        this.#update();
    }

    destroy() {
        Context.signals.removeAll(this);
        if (!this.#modules) return;
        for (const moduleName in this.#modules) this.#destroyModule(moduleName);
        this.#modules = null;
    }

    #update() {
        if (!this.#modules) return;
        for (const moduleName in Modules) {
            const configValue = this.#config[moduleName];
            if (typeof configValue !== 'boolean') continue;
            const module = this.#modules[moduleName];
            if (module && configValue) continue;
            if (!module && configValue) {
                this.#constructModule(moduleName);
                continue;
            }
            this.#destroyModule(moduleName);
            delete this.#modules[moduleName];
        }
    }

    /**
     * @param {string} moduleName
     */
    async #constructModule(moduleName) {
        if (!this.#modules) return;
        try {
            this.#modules[moduleName] = import(Modules[moduleName]);
            const module = await this.#modules[moduleName];
            if (!this.#modules?.[moduleName]) return;
            this.#modules[moduleName] = new module.default();
        } catch (e) {
            Context.logError(`unable to construct module: ${moduleName}.`, e);
        }
    }

    /**
     * @param {string} moduleName
     */
    #destroyModule(moduleName) {
        if (!this.#modules) return;
        try {
            const module = this.#modules[moduleName];
            if (!module) return;
            this.#modules[moduleName] = null;
            if (typeof module?.destroy === 'function') module.destroy();
        } catch (e) {
            Context.logError(`unable to destroy module: ${moduleName}.`, e);
        }
    }

}
