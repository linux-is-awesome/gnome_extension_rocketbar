import Page from './base/page.js';
import Context from '../core/context.js';
import { Config, InnerConfig } from '../../shared/utils/config.js';
import { PreferencesPage, Event, Module } from '../../shared/enums/general.js';
import { SettingsKey } from '../../shared/enums/settings.js';

const CONFIG_KEY_MODULES = 'modules';

const MANAGED_MODULES = [
    Module.TweakMenusClickToOpen,
    Module.TweakOverviewClicks,
    Module.TweakOverviewHideSearch,
    Module.TweakOverviewKillDash,
    Module.TweakPopupsNoDelay,
    Module.TweakPopupsPreventFocus,
    Module.TweakPrimaryInputSource,
    Module.TweakUpperCaseInputSource,
    Module.TweakDndSystemNotifications
];

/** @enum {string} */
const ConfigField = {
    [CONFIG_KEY_MODULES]: SettingsKey.Modules
};

export default class extends Page {

    /** @type {Config} */
    #config = Config(this, ConfigField, settingKey => this.#handleConfig(settingKey));

    /** @type {Set<Module>?} */
    get #modules() {
        const modules = InnerConfig(this.#config, CONFIG_KEY_MODULES);
        if (!Array.isArray(modules)) return null;
        return new Set(modules);
    }

    constructor() {
        super(PreferencesPage.Tweaks, () => this.#handleConfig());
    }

    /**
     * @param {string} [settingKey]
     */
    #handleConfig(settingKey) {
        const modules = this.#modules;
        for (const module of MANAGED_MODULES) {
            const widget = this.getSwitchRow(module);
            const isModuleActive = !!modules?.has(module);
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
        const modules = this.#modules;
        const settings = Context.getSettings();
        if (!modules || !settings) return;
        if (isActive) modules.add(module);
        else modules.delete(module);
        settings.set(ConfigField.modules, [...modules]);
    }

}
