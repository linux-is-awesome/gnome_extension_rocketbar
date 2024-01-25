/**
 * JSDoc types
 *
 * @typedef {*} Module
 * @typedef {{ constructor: { name: string }, destroy: () => void }} ModuleInstance
 */

import Context from '../context.js';
import { Config } from '../../utils/config.js';
import Taskbar from '../../ui/taskbar.js';
import NotificationCounter from '../../ui/notificationCounter.js';

/** @type {{[field: string]: string}} */
const ConfigFields = {
    Taskbar: 'taskbar-enabled',
    NotificationCounter: 'notification-counter-enabled'
};

export default class Modules {

    /** @type {{[field: string]: ModuleInstance?}?} */
    #modules = {
        /** @type {Taskbar?} */
        Taskbar: null,
        /** @type {NotificationCounter?} */
        NotificationCounter: null
    };

    /** @type {Config} */
    #config = Config(this, ConfigFields, () => this.#update());

    constructor() {
        this.#update();
    }

    destroy() {
        Context.signals.removeAll(this);
        if (!this.#modules) return;
        for (const moduleName in this.#modules) this.#destroyModule(this.#modules[moduleName]);
        this.#modules = null;
    }

    #update() {
        if (!this.#modules) return;
        for (const moduleName in this.#modules) {
            const configValue = this.#config[moduleName];
            if (typeof configValue !== 'boolean') continue;
            const module = this.#modules[moduleName];
            if (module && configValue) continue;
            if (!module && configValue) {
                this.#modules[moduleName] = this.#constructModule(eval(moduleName));
                continue;
            }
            module?.destroy();
            this.#modules[moduleName] = null;
        }
    }

    /**
     * @param {Module} module
     * @returns {ModuleInstance?} new module instance or null
     */
    #constructModule(module) {
        try {
            return new module();
        } catch (e) {
            Context.logError(`unable to construct module ${module?.name}.`, e);
        }
        return null;
    }

    /**
     * @param {ModuleInstance?} module
     */
    #destroyModule(module) {
        try {
            module?.destroy();
        } catch (e) {
            Context.logError(`unable to destroy module ${module?.constructor?.name}.`, e);
        }
    }

}
