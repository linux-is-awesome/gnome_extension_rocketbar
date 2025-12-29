/**
 * @typedef {import('gi://Gtk').Switch} Gtk.Switch
 * @typedef {import('gi://Adw').ActionRow} Adw.ActionRow
 * @typedef {import('gi://Adw').ComboRow} Adw.ComboRow
 * @typedef {import('gi://Adw').SpinRow} Adw.SpinRow
 * @typedef {[alignment: Alignment, position: number]} ItemConfig
 * @typedef {{customizePage?: PreferencesPage?, isMovable: boolean, defaultConfig: ItemConfig?}} ItemOptions
 */

import SettingsPage from './base/settingsPage.js';
import Context from '../core/context.js';
import { Config, InnerConfig } from '../../shared/utils/config.js';
import { Event, Module, Alignment, PreferencesPage } from '../../shared/enums/general.js';
import { SettingsKey } from '../../shared/enums/settings.js';
import { ConfigOptions, ConfigKey, ConfigField } from '../../shared/enums/panel.js';

const ROOT_MODULE = Module.Panel;
const PAGE_GROUP_ACTIONS = 'actions';
const CONFIG_KEY_MODULES = 'modules';

const MANAGED_MODULES = [
    Module.Taskbar,
    Module.NotificationCounter
];

const PAGE_GROUPS = [
    PAGE_GROUP_ACTIONS,
    ...MANAGED_MODULES
];

const ALIGNMENT_OPTIONS = [
    Alignment.Left,
    Alignment.Center,
    Alignment.Right
];

/** @enum {string} */
const ItemControl = {
    State: '-state',
    Alignment: '-alignment',
    Position: '-position',
    Customize: '-customize'
};

/**
 * @param {PreferencesPage?} [customizePage]
 * @param {boolean} [isMovable]
 * @param {ItemConfig?} [defaultConfig]
 * @returns {ItemOptions}
 */
const ItemOptions = (customizePage = null, isMovable = false, defaultConfig = null) => ({
    customizePage,
    isMovable,
    defaultConfig
});

/** @type {{[item: string]: ItemOptions}} */
const ManagedItems = {
    [Module.Taskbar]: ItemOptions(PreferencesPage.Taskbar, true, [Alignment.Left, 1]),
    [Module.NotificationCounter]: ItemOptions(PreferencesPage.NotificationCounter)
};

/** @enum {string} */
const RootConfigField = {
    [CONFIG_KEY_MODULES]: SettingsKey.Modules
};

export default class extends SettingsPage {

    /** @type {Config} */
    #rootConfig = Config(this, RootConfigField, () => this.#handleRootConfig());

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value), ConfigOptions);

    /** @type {Map<string, string>} */
    #moduleNames = new Map();

    /** @type {Map<string, ItemConfig?>} */
    #items = new Map();

    /** @type {Set<Module>?} */
    get #rootModules() {
        const modules = InnerConfig(this.#rootConfig, CONFIG_KEY_MODULES);
        if (!Array.isArray(modules)) return null;
        return new Set(modules);
    }

    constructor() {
        super(PreferencesPage.Panel, () => this.#initialize(), ConfigOptions.path);
    }

    #initialize() {
        for (const key in ConfigField) {
            if (key === ConfigKey.Items) continue;
            const settingsKey = ConfigField[key];
            this.#handleConfig(settingsKey, this.#config[key]);
        }
        const managedModules = new Set(MANAGED_MODULES);
        for (const name in Module) {
            const module = Module[name];
            if (!managedModules.has(module)) continue;
            this.#moduleNames.set(module, name);
        }
        this.#handleRootConfig(true);
        this.#handleItems(true);
    }

    /**
     * @param {boolean} [isInitial]
     */
    #handleRootConfig(isInitial = false) {
        const modules = this.#rootModules;
        const isActive = !!modules?.has(ROOT_MODULE);
        for (const groupId of PAGE_GROUPS) {
            const group = this.getGroup(groupId);
            if (!group) continue;
            group.set_sensitive(isActive);
        }
        const rootSwitch = this.getSwitchRow(ROOT_MODULE);
        if (rootSwitch.get_active() !== isActive) rootSwitch.set_active(isActive);
        if (!isInitial) return;
        rootSwitch.connect(Event.ActiveChanged, () => this.#setRootModuleState(rootSwitch.get_active()));
    }

    /**
     * @param {boolean} isActive
     */
    #setRootModuleState(isActive) {
        const modules = this.#rootModules;
        const settings = Context.getSettings();
        if (!modules || !settings) return;
        if (isActive) modules.add(ROOT_MODULE);
        else modules.delete(ROOT_MODULE);
        settings.set(RootConfigField.modules, [...modules]);
    }

    /**
     * @param {string} settingsKey
     * @param {*} value
     */
    #handleConfig(settingsKey, value) {
        switch (settingsKey) {
            case ConfigField.items:
                this.#handleItems();
                break;
            default:
                if (typeof value !== 'boolean') return;
                this.setBoolean(settingsKey, value);
        }
    }

    /**
     * Note: Currently, only one instance of each item is supported.
     *       This may be changed later as the configuration structure allows multiple instances.
     *
     * @param {boolean} [isInitial]
     */
    #handleItems(isInitial = false) {
        this.#items.clear();
        const configItems = InnerConfig(this.#config, ConfigKey.Items);
        if (Array.isArray(configItems)) return;
        for (const index in configItems) {
            const item = configItems[index];
            if (!Array.isArray(item)) continue;
            const [itemName, alignment, position] = item;
            const itemKey = Module[itemName] ?? itemName;
            const itemOptions = ManagedItems[itemKey];
            if (!itemOptions) continue;
            const { isMovable } = itemOptions;
            this.#items.set(itemName, isMovable ? [alignment, position] : null);
        }
        for (const item in ManagedItems) this.#handleItem(item, isInitial);
    }

    /**
     * @param {string} item
     * @param {boolean} isInitial
     */
    #handleItem(item, isInitial) {
        const itemInfo = this.#getItemInfo(item);
        if (!itemInfo) return;
        const [_, isActive, itemOptions, itemConfig] = itemInfo;
        const [stateControl,
               alignmentControl,
               positionControl,
               customizeControl] = this.#getItemControls(item, itemOptions);
        customizeControl?.set_sensitive(isActive);
        if (stateControl.get_active() !== isActive) stateControl.set_active(isActive);
        if (alignmentControl && positionControl) {
            const [alignment, position] = itemConfig ?? [];
            const alignmentIndex = ALIGNMENT_OPTIONS.findIndex(option => option === alignment);
            alignmentControl.set_visible(isActive);
            positionControl.set_visible(isActive);
            if (alignmentIndex >= 0 &&
                alignmentControl.get_selected() !== alignmentIndex) alignmentControl.set_selected(alignmentIndex);
            if (typeof position === 'number' &&
                positionControl.get_value() !== position) positionControl.set_value(position);
        }
        if (!isInitial) return;
        stateControl.connect(Event.ActiveChanged, () => this.#setItemState(item, stateControl.get_active()));
        alignmentControl?.connect(Event.SelectedItemChanged, () => this.#setItemAlignment(item, alignmentControl.get_selected()));
        positionControl?.connect(Event.ValueChanged, () => this.#setItemPosition(item, positionControl.get_value()));
        const { customizePage } = itemOptions;
        if (!customizePage) return;
        customizeControl?.connect(Event.Activated, () => Context.navigateToPage(customizePage));
    }

    /**
     * @param {string} item
     * @param {ItemOptions} itemOptions
     * @returns {[Gtk.Switch, ?Adw.ComboRow, ?Adw.SpinRow, ?Adw.ActionRow]}
     */
    #getItemControls(item, itemOptions) {
        const { customizePage, isMovable } = itemOptions;
        const stateControl = this.getSwitch(`${item}${ItemControl.State}`);
        const alignmentControl = isMovable ? this.getComboRow(`${item}${ItemControl.Alignment}`) : null;
        const positionControl = isMovable ? this.getSpinRow(`${item}${ItemControl.Position}`) : null;
        const customizeControl = customizePage ? this.getActionRow(`${item}${ItemControl.Customize}`) : null;
        return [stateControl, alignmentControl, positionControl, customizeControl];
    }

    /**
     * @param {string} item
     * @param {boolean} isActive
     */
    #setItemState(item, isActive) {
        const itemInfo = this.#getItemInfo(item);
        if (!itemInfo) return;
        const [itemName, isItemActive, itemOptions] = itemInfo;
        if (isActive === isItemActive) return;
        if (isActive) this.#items.set(itemName, itemOptions.defaultConfig);
        else this.#items.delete(itemName);
        this.#saveItems();
    }

    /**
     * @param {string} item
     * @param {number} alignmentIndex
     */
    #setItemAlignment(item, alignmentIndex) {
        if (typeof alignmentIndex !== 'number' ||
            alignmentIndex < 0 ||
            alignmentIndex >= ALIGNMENT_OPTIONS.length) return;
        const itemInfo = this.#getItemInfo(item);
        if (!itemInfo) return;
        const [itemName, isActive, { isMovable }, itemConfig] = itemInfo;
        if (!isActive || !isMovable) return;
        const alignment = ALIGNMENT_OPTIONS[alignmentIndex];
        const [_, position = 0] = itemConfig ?? [];
        this.#items.set(itemName, [alignment, position]);
        this.#saveItems();
    }

    /**
     * @param {string} item
     * @param {number} position
     */
    #setItemPosition(item, position) {
        if (typeof position !== 'number') return;
        const itemInfo = this.#getItemInfo(item);
        if (!itemInfo) return;
        const [itemName, isActive, { isMovable }, itemConfig] = itemInfo;
        if (!isActive || !isMovable) return;
        const [alignment = Alignment.Left] = itemConfig ?? [];
        this.#items.set(itemName, [alignment, position]);
        this.#saveItems();
    }

    /**
     * @param {string} item
     * @returns {[itemName: string, isActive: boolean, itemOptions: ItemOptions, itemConfig: ?ItemConfig]?}
     */
    #getItemInfo(item) {
        const itemOptions = ManagedItems[item];
        if (!itemOptions) return null;
        const itemName = this.#moduleNames.get(item) ?? item;
        const isActive = this.#items.has(itemName);
        const itemConfig = this.#items.get(itemName) ?? null;
        return [itemName, isActive, itemOptions, itemConfig];
    }

    #saveItems() {
        const items = {};
        let id = 0;
        for (const [itemName, itemConfig] of this.#items) {
            items[id] = [itemName, ...itemConfig ?? []];
            id++;
        }
        this.settings.set(ConfigField.items, items);
    }

}
