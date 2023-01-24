/* exported Modules */

import { Context } from '../context.js';
import { Config } from '../../utils/config.js';
import { Type } from '../enums.js';
import { NotificationCounter } from '../../ui/notificationCounter.js';

/** @enum {string} */
const ConfigFields = {
    Taskbar: 'taskbar-enabled',
    NotificationCounter: 'notification-counter-enabled'
};

export class Modules {

    /** @type {Object.<string, *>} */
    #modules = {
        /** @type {NotificationCounter} */
        NotificationCounter: null
    };

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, () => this.#update());

    constructor() {
        this.#update();
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#config = null;
        if (!this.#modules) return;
        for (const moduleName in this.#modules) this.#modules[moduleName]?.destroy();
        this.#modules = null;
    }

    #update() {
        if (!this.#modules) return;
        for (const moduleName in this.#modules) {
            const configValue = this.#config[moduleName];
            if (typeof configValue !== Type.Boolean) continue;
            const module = this.#modules[moduleName];
            if (module && configValue) continue;
            if (!module && configValue) {
                this.#modules[moduleName] = this.#constructModule(eval(moduleName));
                continue;
            }
            module.destroy();
            this.#modules[moduleName] = null;
        }
    }

    /**
     * @param {Object} module
     * @returns {Object|null} new module instance or null
     */
    #constructModule(module) {
        try {
            return new module();
        } catch (e) {
            console.error(`${Context.metadata.name} unable to construct module ${module?.name}.`, e);
        }
        return null;
    }

}