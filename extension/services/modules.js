import Context from '../main/context.js';
import { Session } from '../main/shell.js';
import { SessionMode, Event } from '../shared/enums.js';
import { Config } from '../utils/config.js';

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
    Panel: 'ui/panel',
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
        Module.Panel,
        Module.NotificationCounter,
        Module.Taskbar
    ],
    [SessionMode.Locksreen]: [
        Module.TweakPopupsNoDelay,
        Module.TweakPrimaryInputSource,
        Module.TweakUpperCaseInputSource,
        Module.TweakMenusClickToOpen,
        Module.Panel
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
    [Module.Panel]: 'panel'
};

class ModuleService {

    /** @type {Set<ModuleManager>?} */
    #managers = new Set();

    constructor() {
        Context.signals.add(this, [Session, Event.Updated, () => this.#update()]);
    }

    destroy() {
        if (this.#managers?.size) return false;
        Context.signals.removeAll(this);
        this.#managers = null;
        return true;
    }

    /**
     * @param {ModuleManager} manager
     */
    addManager(manager) {
        if (!this.#managers || manager instanceof ModuleManager === false) return;
        this.#managers.add(manager);
    }

    /**
     * @param {ModuleManager} manager
     */
    removeManager(manager) {
        if (!manager || !this.#managers?.has(manager)) return;
        this.#managers.delete(manager);
    }

    #update() {
        if (!this.#managers?.size) return;
        for (const manager of this.#managers) manager.update();
    }

}

export class ModuleManager {

    /** @type {ModuleService?} */
    static #service = null;

    /** @type {Set<Module>?} */
    #managedModules = null;

    /** @type {Map<Module, *>?} */
    #moduleInstances = new Map();

    /** @type {((newModules: Map<Module, string>) => void)?} */
    #callback = null;

    /** @type {Map<Module, *>?} */
    get modules() {
        return this.#moduleInstances;
    }

    /**
     * @param {((newModules: Map<Module, string>) => void)} [callback]
     */
    constructor(callback) {
        this.#callback = callback ?? null;
        ModuleManager.#service ??= new ModuleService();
        ModuleManager.#service.addManager(this);
    }

    destroy() {
        this.#managedModules = null;
        this.#moduleInstances?.forEach((_, module) => this.#destroyModule(module));
        this.#moduleInstances = null;
        this.#callback = null;
        if (!ModuleManager.#service) return;
        ModuleManager.#service.removeManager(this);
        if (!ModuleManager.#service.destroy()) return;
        ModuleManager.#service = null;
    }

    /**
     * @param {Module[]} [modules]
     */
    async update(modules) {
        if (!this.#moduleInstances) return;
        if (Array.isArray(modules)) {
            this.#managedModules = new Set(modules);
        }
        if (!this.#moduleInstances.size && !this.#managedModules?.size) return;
        const sessionMode = Session.currentMode ?? '';
        const sessionModules = new Set(Modules[sessionMode] ?? []);
        const newModules = new Map();
        const scope = new Set([...this.#moduleInstances.keys(), ...this.#managedModules ?? []]);
        for (const module of scope) {
            if (!this.#managedModules?.has(module) || !sessionModules.has(module)) {
                this.#destroyModule(module);
                continue;
            }
            const instance = this.#moduleInstances.get(module);
            if (instance) continue;
            newModules.set(module, this.#constructModule(module));
        }
        if (!newModules.size) return;
        await Promise.all([...newModules.values()]);
        if (typeof this.#callback !== 'function') return;
        for (const name in Module) {
            const module = Module[name];
            if (!newModules.has(module)) continue;
            newModules.set(module, name);
        }
        this.#callback(newModules);
    }

    /**
     * @param {Module} module
     */
    async #constructModule(module) {
        if (!this.#moduleInstances || !module) return;
        try {
            const timestamp = Date.now();
            this.#moduleInstances.set(module, timestamp);
            const path = `${MODULE_ROOT_PATH}${module}${MODULE_FILE_TYPE}`;
            const source = await import(path);
            if (this.#moduleInstances?.get(module) !== timestamp) return;
            const instance = new source.default();
            this.#moduleInstances.set(module, instance);
        } catch (e) {
            Context.logError(`unable to construct module: ${module}.`, e);
        }
    }

    /**
     * @param {Module} module
     */
    #destroyModule(module) {
        if (!this.#moduleInstances?.has(module)) return;
        try {
            const instance = this.#moduleInstances.get(module);
            this.#moduleInstances.delete(module);
            if (typeof instance === 'number') return;
            instance?.destroy();
        } catch (e) {
            Context.logError(`unable to destroy module: ${module}.`, e);
        }
    }

}

export default class DefaultModuleManager extends ModuleManager {

    /** @type {Config?} */
    #config = Config(this, ConfigFields, () => this.#handleConfig());

    constructor() {
        super();
        this.#handleConfig();
    }

    /**
     * @override
     */
    destroy() {
        Context.signals.removeAll(this);
        this.#config = null;
        super.destroy();
    }

    #handleConfig() {
        if (!this.#config) return;
        const managedModules = [];
        for (const module in this.#config) {
            if (!this.#config[module]) continue;
            managedModules.push(module);
        }
        this.update(managedModules);
    }

}
