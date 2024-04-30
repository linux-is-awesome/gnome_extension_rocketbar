import Context from '../core/context.js';
import { Session } from '../core/shell.js';
import { SessionMode, Event } from '../core/enums.js';
import { Config } from '../utils/config.js';

const MODULE_INSTANCE_PLACEHOLDER = '*';
const MODULE_ROOT_PATH = '../';
const MODULE_FILE_TYPE = '.js';

/** @enum {string} */
export const Module = {
    TweakOverviewKillDash: 'tweaks/overviewKillDash',
    TweakOverviewHideSearch: 'tweaks/overviewHideSearch',
    TweakOverviewClicks: 'tweaks/overviewClicks',
    TweakPopupsPreventFocus: 'tweaks/popupsPreventFocus',
    TweakPopupsNoDelay: 'tweaks/popupsNoDelay',
    TweakPrimaryInputSource: 'tweaks/primaryInputSource',
    TweakUpperCaseInputSource: 'tweaks/upperCaseInputSource',
    TweakMenusClickToOpen: 'tweaks/menusClickToOpen',
    NotificationCounter: 'ui/notificationCounter',
    Taskbar: 'ui/taskbar'
};

/** @type {{[sessionMode: SessionMode]: Module[]}} */
const Modules = {
    [SessionMode.Desktop]: [
        Module.TweakOverviewKillDash,
        Module.TweakOverviewHideSearch,
        Module.TweakOverviewClicks,
        Module.TweakPopupsPreventFocus,
        Module.TweakPopupsNoDelay,
        Module.TweakPrimaryInputSource,
        Module.TweakUpperCaseInputSource,
        Module.TweakMenusClickToOpen,
        Module.NotificationCounter,
        Module.Taskbar
    ],
    [SessionMode.Locksreen]: [
        Module.TweakPopupsNoDelay,
        Module.TweakPrimaryInputSource,
        Module.TweakUpperCaseInputSource,
        Module.TweakMenusClickToOpen
    ]
};

/** @type {{[field: Module]: string}} */
const ConfigFields = {
    [Module.TweakOverviewKillDash]: 'overview-kill-dash',
    [Module.TweakOverviewHideSearch]: 'overview-hide-search',
    [Module.TweakOverviewClicks]: 'overview-empty-space-clicks',
    [Module.TweakPopupsPreventFocus]: 'popups-prevent-focus',
    [Module.TweakPopupsNoDelay]: 'popups-no-delay',
    [Module.TweakPrimaryInputSource]: 'primary-input-source',
    [Module.TweakUpperCaseInputSource]: 'upper-case-input-source',
    [Module.TweakMenusClickToOpen]: 'menus-click-to-open',
    [Module.NotificationCounter]: 'notification-counter-enabled',
    [Module.Taskbar]: 'taskbar-enabled'
};

export default class ModulesService {

    /** @type {Map<Module, *>?} */
    #modules = new Map();

    /** @type {Config?} */
    #config = Config(this, ConfigFields, () => this.#update());

    constructor() {
        Context.signals.add(this, [Session, Event.SessionUpdated, () => this.#update()]);
        this.#update();
    }

    destroy() {
        if (!this.#modules) return;
        Context.signals.removeAll(this);
        const modules = this.#modules.keys();
        for (const module of modules) this.#destroyModule(module);
        this.#modules = null;
        this.#config = null;
    }

    #update() {
        if (!this.#modules || !this.#config) return;
        const sessionMode = Session.currentMode;
        const modules = sessionMode ? Modules[sessionMode] ?? [] : [];
        const oldModules = this.#modules.keys();
        for (const module of oldModules) {
            const configValue = this.#config[module];
            if (!configValue || !modules.includes(module)) this.#destroyModule(module);
        }
        for (const module of modules) {
            const configValue = this.#config[module];
            if (typeof configValue !== 'boolean') continue;
            const instance = this.#modules.get(module);
            if (instance && configValue) continue;
            if (!instance && configValue) this.#constructModule(module);
        }
    }

    /**
     * @param {Module} module
     */
    async #constructModule(module) {
        if (!this.#modules || !module) return;
        try {
            this.#modules.set(module, MODULE_INSTANCE_PLACEHOLDER);
            const path = `${MODULE_ROOT_PATH}${module}${MODULE_FILE_TYPE}`;
            const source = await import(path);
            if (!this.#modules?.has(module)) return;
            this.#modules.set(module, new source.default());
        } catch (e) {
            Context.logError(`unable to construct module: ${module}.`, e);
        }
    }

    /**
     * @param {Module} module
     */
    #destroyModule(module) {
        if (!this.#modules?.has(module)) return;
        try {
            const instance = this.#modules.get(module);
            this.#modules.delete(module);
            if (instance === MODULE_INSTANCE_PLACEHOLDER) return;
            instance?.destroy();
        } catch (e) {
            Context.logError(`unable to destroy module: ${module}.`, e);
        }
    }

}
