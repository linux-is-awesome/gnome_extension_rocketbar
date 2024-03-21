import Context from '../core/context.js';
import { Config } from '../utils/config.js';

const MODULE_INSTANCE_PLACEHOLDER = true;

/** @type {{[field: string]: string}} */
const Modules = {
    TweakOverviewKillDash: '../tweaks/overviewKillDash.js',
    TweakOverviewClicks: '../tweaks/overviewClicks.js',
    TweakPopupsPreventFocus: '../tweaks/popupsPreventFocus.js',
    Taskbar: '../ui/taskbar.js',
    NotificationCounter: '../ui/notificationCounter.js'
};

/** @type {{[field: string]: string}} */
const ConfigFields = {
    TweakOverviewKillDash: 'overview-kill-dash',
    TweakOverviewClicks: 'overview-empty-space-clicks',
    TweakPopupsPreventFocus: 'popups-prevent-focus',
    Taskbar: 'taskbar-enabled',
    NotificationCounter: 'notification-counter-enabled'
};

export default class ModulesService {

    /** @type {Map<string, *>?} */
    #modules = new Map();

    /** @type {Config} */
    #config = Config(this, ConfigFields, () => this.#update());

    constructor() {
        this.#update();
    }

    destroy() {
        if (!this.#modules) return;
        Context.signals.removeAll(this);
        const moduleNames = this.#modules.keys();
        for (const moduleName of moduleNames) this.#destroyModule(moduleName);
        this.#modules = null;
    }

    #update() {
        if (!this.#modules) return;
        for (const moduleName in Modules) {
            const configValue = this.#config[moduleName];
            if (typeof configValue !== 'boolean') continue;
            const module = this.#modules.get(moduleName);
            if (module && configValue) continue;
            if (!module && configValue) {
                this.#constructModule(moduleName);
                continue;
            }
            this.#destroyModule(moduleName);
        }
    }

    /**
     * @param {string} moduleName
     */
    async #constructModule(moduleName) {
        if (!this.#modules) return;
        try {
            this.#modules.set(moduleName, MODULE_INSTANCE_PLACEHOLDER);
            const module = await import(Modules[moduleName]);
            if (!this.#modules?.has(moduleName)) return;
            this.#modules.set(moduleName, new module.default());
        } catch (e) {
            Context.logError(`unable to construct module: ${moduleName}.`, e);
        }
    }

    /**
     * @param {string} moduleName
     */
    #destroyModule(moduleName) {
        if (!this.#modules?.has(moduleName)) return;
        try {
            const module = this.#modules.get(moduleName);
            this.#modules.delete(moduleName);
            if (module === MODULE_INSTANCE_PLACEHOLDER) return;
            module?.destroy();
        } catch (e) {
            Context.logError(`unable to destroy module: ${moduleName}.`, e);
        }
    }

}
