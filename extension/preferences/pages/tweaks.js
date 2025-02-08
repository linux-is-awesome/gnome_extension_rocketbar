import Page from './base/page.js';
import Context from '../core/context.js';
import { Config, InnerConfig } from '../../shared/utils/config.js';
import { Event, Module, SettingsKey } from '../../shared/core/enums.js';

const PAGE_NAME = 'tweaks';
const CONFIG_KEY_MODULES = 'modules';

const MANAGED_MODULES = [
    Module.TweakMenusClickToOpen,
    Module.TweakOverviewClicks,
    Module.TweakOverviewHideSearch,
    Module.TweakOverviewKillDash,
    Module.TweakPopupsNoDelay,
    Module.TweakPopupsPreventFocus,
    Module.TweakPrimaryInputSource,
    Module.TweakUpperCaseInputSource
];

/** @enum {string} */
const ConfigField = {
    [CONFIG_KEY_MODULES]: SettingsKey.Modules
};

export default class extends Page {

    /** @type {Config} */
    #config = Config(this, ConfigField, settingKey => this.#handleConfig(settingKey));

    constructor() {
        super(PAGE_NAME);
        this.#handleConfig();
    }

    /**
     * @param {string} [settingKey]
     */
    #handleConfig(settingKey) {
        const configModules = InnerConfig(this.#config, CONFIG_KEY_MODULES);
        if (!Array.isArray(configModules)) return;
        const modules = new Set(configModules);
        for (const module of MANAGED_MODULES) {
            const widget = this.getSwitch(module);
            const isModuleActive = modules.has(module);
            if (widget.get_active() !== isModuleActive) widget.set_active(isModuleActive);
            if (settingKey) continue;
            widget.connect(Event.Active, () => this.#toggleModule(module, widget.get_active()));
        }
    }

    /**
     * @param {string} module
     * @param {boolean} isActive
     */
    #toggleModule(module, isActive) {
        const settings = Context.getSettings();
        const configModules = InnerConfig(this.#config, CONFIG_KEY_MODULES);
        if (!settings || !Array.isArray(configModules)) return;
        const modules = new Set(configModules);
        if (isActive) modules.add(module);
        else modules.delete(module);
        settings.set(ConfigField.modules, [...modules]);
    }

}
