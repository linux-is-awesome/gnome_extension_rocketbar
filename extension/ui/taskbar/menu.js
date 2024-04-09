/**
 * JSDoc types
 *
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupBaseMenuItem} PopupBaseMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenuItem} PopupMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSeparatorMenuItem} PopupSeparatorMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/boxpointer.js').PopupAnimation} BoxPointer.PopupAnimation
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../utils/config.js').Config} Config
 */

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import { PopupMenuSection, PopupSeparatorMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Context from '../../core/context.js';
import { Delay, Event } from '../../core/enums.js';
import { ComponentLocation } from '../base/component.js';
import { SliderMenuItem, CollapsibleGroup, ChildMenu } from '../base/menu.js';
import { Icon } from '../base/icon.js';
import { SharedConfig } from '../../utils/config.js';
import { FileSelector } from '../../utils/zenity.js';
import { ActivateBehavior, DemandsAttentionBehavior, AppIconSize } from '../../utils/taskbar/appConfig.js';
import { SoundVolumeIcon } from '../../utils/soundVolumeIcon.js';
import { Labels } from '../../core/labels.js';

const CONFIG_PATH = 'taskbar';
const UNWANTED_STYLE_CLASS = 'app-menu';
const STYLE_CLASS = 'rocketbar__popup-menu';
const ICON_PATH_SEPARATOR = '/';
const ICON_FILE_TYPE_FILTER = `${Labels.Icon} | *.svg *.png`;

/** @type {{[prop: string]: boolean}} */
const DefaultProps = {
    favoritesSection: true,
    showSingleWindows: true
};

/** @type {{[position: string]: number}} */
const MenuPosition = {
    [ComponentLocation.Top]: St.Side.TOP,
    [ComponentLocation.Bottom]: St.Side.BOTTOM
};

/** @type {{[value: string]: string}} */
const ActivateBehaviorRadioGroup = {
    [ActivateBehavior.NewWindow]: Labels.NewWindow,
    [ActivateBehavior.FindWindow]: Labels.FindWindow,
    [ActivateBehavior.MoveWindows]: Labels.MoveWindows
};

/** @type {{[value: string]: string}} */
const DemandsAttentionBehaviorRadioGroup = {
    [DemandsAttentionBehavior.Default]: Labels.AppDefault,
    [DemandsAttentionBehavior.FocusActive]: Labels.FocusActive,
    [DemandsAttentionBehavior.FocusAll]: Labels.FocusAll
};

/** @enum {number} */
const MonitorDirection = {
    CurrentMonitor: -1,
    MonitorLeft: Meta.DisplayDirection.LEFT,
    MonitorRight: Meta.DisplayDirection.RIGHT,
    MonitorAbove: Meta.DisplayDirection.UP,
    MonitorBelow: Meta.DisplayDirection.DOWN
};

/** @enum {string} */
const ConfigField = {
    IconSize: 'iconSize',
    IconPath: 'iconPath',
    IconSizeOffset: 'iconSizeOffset',
    ActivateBehavior: 'activateBehavior',
    DemandsAttentionBehavior: 'demandsAttentionBehavior'
};

/** @enum {string} */
const ConfigFields = {
    isolateWorkspaces: 'taskbar-isolate-workspaces',
    showFavorites: 'taskbar-show-favorites'
};

class SoundVolumeControlGroup extends CollapsibleGroup {

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {SliderMenuItem?} */
    #inputVolumeSlider = null;

    /** @type {SliderMenuItem?} */
    #outputVolumeSlider = null;

    /** @type {boolean} */
    #isSyncing = false;

    /**
     * @param {AppButton?} appButton
     */
    constructor(appButton) {
        super(Labels.SoundVolumeControl);
        this.#appButton = appButton;
        this.#inputVolumeSlider = new SliderMenuItem((menuItem, event) => this.#setVolume(menuItem, event));
        this.#outputVolumeSlider = new SliderMenuItem((menuItem, event) => this.#setVolume(menuItem, event));
        const menu = this.menu;
        menu.addMenuItem(this.#inputVolumeSlider.actor);
        menu.addMenuItem(this.#outputVolumeSlider.actor);
        menu.connect(Event.OpenStateChanged, () => this.#syncVolume());
        this.actor.connect(Event.Destroy, () => this.#destroy());
    }

    update() {
        const actor = this.actor;
        if (!actor || !this.#inputVolumeSlider || !this.#outputVolumeSlider) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl?.hasInput && !soundVolumeControl?.hasOutput) {
            actor.menu?.close();
            actor.hide();
            return;
        }
        this.#inputVolumeSlider.actor.visible = soundVolumeControl.hasInput;
        this.#outputVolumeSlider.actor.visible = soundVolumeControl.hasOutput;
        actor.show();
    }

    /**
     * @param {SliderMenuItem} menuItem
     * @param {Clutter.Event} [event] click event
     */
    #setVolume(menuItem, event) {
        if (this.#isSyncing) return;
        if (event) return this.#toggleMute(menuItem);
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const slider = menuItem?.slider;
        if (!slider) return;
        const sliderValue = slider.value;
        const isInput = menuItem === this.#inputVolumeSlider;
        if (isInput) {
            soundVolumeControl.inputVolume = sliderValue;
        } else {
            soundVolumeControl.outputVolume = sliderValue;
        }
        menuItem.icon = SoundVolumeIcon(sliderValue, isInput);
    }

    /**
     * @param {SliderMenuItem} menuItem
     */
    #toggleMute(menuItem) {
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const isInput = menuItem === this.#inputVolumeSlider;
        if (isInput) soundVolumeControl.toggleInputMute(() => this.#syncVolume());
        else soundVolumeControl.toggleOutputMute(() => this.#syncVolume());
    }

    #syncVolume() {
        if (!this.isOpen || !this.#inputVolumeSlider || !this.#outputVolumeSlider) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const inputVolume = soundVolumeControl.inputVolume;
        const outputVolume = soundVolumeControl.outputVolume;
        this.#isSyncing = true;
        this.#inputVolumeSlider.slider.value = inputVolume;
        this.#outputVolumeSlider.slider.value = outputVolume;
        this.#inputVolumeSlider.icon = SoundVolumeIcon(inputVolume, true);
        this.#outputVolumeSlider.icon = SoundVolumeIcon(outputVolume);
        this.#isSyncing = false;
    }

    #destroy() {
        this.#appButton = null;
        this.#inputVolumeSlider = null;
        this.#outputVolumeSlider = null;
    }

}

class CurrentWorkspaceSection extends PopupMenuSection {

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {Meta.Window[]?} */
    #windows = null;

    /** @type {PopupSeparatorMenuItem?} */
    #title = null;

    /** @type {Map<number, PopupMenuItem?>?} */
    #actions = new Map();

    /** @param {Meta.Window[]} windows */
    set windows(windows) {
        if (!this.actor) return;
        this.#windows = windows?.length ? windows : null;
        this.actor.visible = !!this.#windows;
        if (this.#windows) this.#update();
    }

    /** @param {boolean} value */
    set isTitleVisible(value) {
        if (!this.#title?.label || typeof value !== 'boolean') return;
        this.#title.label.visible = value;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super();
        this.#appButton = appButton;
        this.actor.hide();
        this.actor.connect(Event.Destroy, () => this.#destroy());
        this.#title = new PopupSeparatorMenuItem(Labels.CurrentWorkspace);
        this.addMenuItem(this.#title);
        this.addAction(Labels.CloseAll, () => this.#closeAll());
    }

    #destroy() {
        this.#actions?.clear();
        this.#actions = null;
        this.#windows = null;
        this.#title = null;
        this.#appButton = null;
    }

    #update() {
        if (!this.#appButton || !this.#actions || !this.#windows) return;
        if (this.#actions.size) {
            const menuItems = this.#actions.values();
            for (const menuItem of menuItems) menuItem?.destroy();
            this.#actions.clear();
        }
        const display = global.display;
        if (display.get_n_monitors() <= 1) return;
        const currentMonitor = this.#appButton.monitorIndex;
        const ignoredMonitors = new Set();
        for (const window of this.#windows) {
            const windowMonitor = window.get_monitor();
            if (windowMonitor < 0) continue;
            ignoredMonitors.add(windowMonitor);
        }
        if (ignoredMonitors.size > 1) ignoredMonitors.clear();
        for (const monitor in MonitorDirection) {
            const direction = MonitorDirection[monitor];
            const index = direction === MonitorDirection.CurrentMonitor ? currentMonitor :
                          display.get_monitor_neighbor_index(currentMonitor, direction);
            if (index < 0 || ignoredMonitors.has(index)) continue;;
            const actionLabel = `${Labels.MoveTo} ${Labels[monitor]}`;
            this.#actions.set(index, this.addAction(actionLabel, () => this.#moveToMonitor(index)));
        }
    }

    #closeAll() {
        if (!this.#windows) return;
        const timestamp = global.get_current_time();
        for (let i = 0, l = this.#windows.length; i < l; ++i) {
            this.#windows[i].delete(timestamp + i);
        }
    }

    /**
     * @param {number} monitorIndex
     */
    #moveToMonitor(monitorIndex) {
        if (!this.#windows?.length) return;
        for (const window of this.#windows) window.move_to_monitor(monitorIndex) 
    }

}

class OtherWorkspacesSection extends PopupMenuSection {

    /** @param {boolean} value */
    set isVisible(value) {
        if (!this.actor) return;
        this.actor.visible = value;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super();
        this.actor.hide();
        this.addMenuItem(new PopupSeparatorMenuItem(Labels.OtherWorkspaces));
        this.addAction(Labels.FindWindow, () => appButton?.activate(ActivateBehavior.FindWindow));
        this.addAction(Labels.MoveWindows, () => appButton?.activate(ActivateBehavior.MoveWindows));
    }

}

class CustomizeChildMenu extends ChildMenu {

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {((value: string, isDefault: boolean) => (PopupBaseMenuItem|CollapsibleGroup)[])?} */
    #activateBehavior = null;

    /** @type {((value: string, isDefault: boolean) => (PopupBaseMenuItem|CollapsibleGroup)[])?} */
    #demandsAttentionBehavior = null;

    /** @type {((iconSize: number, defaultIconSize: number, isDefault: boolean) => void)?} */
    #iconSize = null;

    /** @type {((iconPath: string?) => void)?} */
    #customIcon = null;

    /** @type {PopupMenuItem?} */
    #importIconItem = null;

    /** @type {PopupMenuItem?} */
    #resetAllItem = null;

    /** @type {boolean} */
    #isSyncing = false;

    /** @type {Config?} */
    #config = null;

    /** @type {string?} */
    #clipboardIconPath = null;

    /**
     * @param {AppButton?} appButton
     * @param {() => void} [callback]
     */
    constructor(appButton, callback) {
        super(Labels.Customize, callback);
        this.#appButton = appButton;
        this.actor.connect(Event.Destroy, () => this.#destroy());
        this.menu.connect(Event.OpenStateChanged, () => this.#sync());
        this.menu.itemActivated = () => {};
    }

    /**
     * @override
     */
    toggle() {
        if (!this.#resetAllItem) this.#createMenuItems();
        super.toggle();
    }

    #destroy() {
        Context.jobs.removeAll(this);
        this.#appButton = null;
        this.#activateBehavior = null;
        this.#demandsAttentionBehavior = null;
        this.#iconSize = null;
        this.#customIcon = null;
        this.#importIconItem = null;
        this.#resetAllItem = null;
    }

    #createMenuItems() {
        this.#activateBehavior = this.addRadioGroup(
            Labels.ActivateBehavior, ActivateBehaviorRadioGroup,
            (...args) => this.#setRadioGroupValue(...args), true);
        this.#demandsAttentionBehavior = this.addRadioGroup(
            Labels.DemandsAttentionBehavior, DemandsAttentionBehaviorRadioGroup,
            (...args) => this.#setRadioGroupValue(...args), true);
        this.#customIcon = this.#addCustomIconGroup();
        this.#iconSize = this.#addIconSizeSlider();
        this.addSeparator();
        this.#resetAllItem = this.menu.addAction(Labels.ResetAllToDefault, () => this.#resetAll());
    }

    /**
     * @returns {(iconPath: string?) => void}
     */
    #addCustomIconGroup() {
        const separator = this.addSeparator(Labels.CustomIcon);
        const collapsible = this.addCollapsibleGroup(Labels.AppDefault);
        const collapsibleMenu = collapsible.menu;
        collapsibleMenu.itemActivated = () => {};
        collapsibleMenu.addAction(Labels.SelectIcon, () => this.#selectIcon());
        this.#importIconItem = collapsibleMenu.addAction(Labels.IconFromClipboard, () => {
            if (typeof this.#clipboardIconPath !== 'string') return;
            this.#setCustomIcon(this.#clipboardIconPath);
        });
        this.setItemActiveState(this.#importIconItem, false);
        const resetIconItem = collapsibleMenu.addAction(Labels.ResetToDefault, () => this.#setCustomIcon());
        return iconPath => {
            const isEmptyIconPath = typeof iconPath !== 'string' || !iconPath.trim();
            collapsible.title = isEmptyIconPath ? Labels.AppDefault : iconPath.split(ICON_PATH_SEPARATOR).pop();
            this.setChangedIndicator(separator, !isEmptyIconPath);
            this.setItemActiveState(resetIconItem, !isEmptyIconPath);
        };
    }

    /**
     * @returns {(iconSize: number, defaultIconSize: number, isDefault: boolean) => void}
     */
    #addIconSizeSlider() {
        const separator = this.addSeparator(Labels.IconSize);
        const iconSizeSlider = new SliderMenuItem(
            menuItem => (this.#setIconSize(menuItem), this.setChangedIndicator(separator)),
            null, AppIconSize.Min);
        this.menu.addMenuItem(iconSizeSlider.actor);
        return (iconSize, defaultIconSize, isDefault) => {
            if (typeof iconSize !== 'number' || typeof defaultIconSize !== 'number') return;
            const slider = iconSizeSlider.slider;
            const offset = AppIconSize.Max - AppIconSize.Min;
            slider.overdriveStart = (defaultIconSize - AppIconSize.Min) / offset;
            slider.value = (iconSize - AppIconSize.Min) / offset;
            this.setChangedIndicator(separator, !isDefault);
        };
    }

    #resetAll() {
        const app = this.#appButton?.app;
        if (!app) return;
        this.#appButton?.configProvider?.resetConfigOverride(app);
        this.#sync();
    }

    #sync() {
        if (!this.isOpen ||
            typeof this.#activateBehavior !== 'function' ||
            typeof this.#demandsAttentionBehavior !== 'function' ||
            typeof this.#iconSize !== 'function' ||
            typeof this.#customIcon !== 'function') return;
        const app = this.#appButton?.app;
        const configProvider = this.#appButton?.configProvider;
        if (!configProvider || !app) return;
        this.#config ??= configProvider.getConfig(app);
        if (!this.#config) return;
        this.#isSyncing = true;
        const config = this.#config;
        const defaultConfig = configProvider.defaultConfig;
        this.#activateBehavior(config[ConfigField.ActivateBehavior],
                              !configProvider.hasConfigOverride(app, ConfigField.ActivateBehavior))
                              .forEach(item => { item.visible = config.isolateWorkspaces; });
        this.#demandsAttentionBehavior(config[ConfigField.DemandsAttentionBehavior],
                                       !configProvider.hasConfigOverride(app, ConfigField.DemandsAttentionBehavior));
        this.#iconSize(config[ConfigField.IconSize], defaultConfig[ConfigField.IconSize],
                       !configProvider.hasConfigOverride(app, ConfigField.IconSizeOffset));
        this.#customIcon(config[ConfigField.IconPath]);
        this.setItemActiveState(this.#resetAllItem, configProvider.hasConfigOverride(app));
        this.#scanClipboard();
        this.#isSyncing = false;
    }

    #scanClipboard() {
        if (!this.#config) return;
        St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_, iconPath) => {
            const isValidIcon = !!iconPath && (Icon.isIconFilePath(iconPath) ||
                                               Context.iconTheme.has_icon(iconPath));
            this.#clipboardIconPath = isValidIcon ? iconPath : null;
            this.setItemActiveState(this.#importIconItem, isValidIcon);
        });
    }

    /**
     * @param {string} value
     * @param {{[value: string]: string}} group
     */
    #setRadioGroupValue(value, group) {
        if (this.#isSyncing || !this.#appButton) return;
        let field = null;
        switch (group) {
            case ActivateBehaviorRadioGroup:
                field = ConfigField.ActivateBehavior;
                break;
            case DemandsAttentionBehaviorRadioGroup:
                field = ConfigField.DemandsAttentionBehavior;
                break;
        }
        if (!field || !value) return;
        this.#setConfigOverride(field, value);
    }

    async #selectIcon() {
        if (!this.#config) return;
        this.parentMenu?.toggle();
        const iconPath = await FileSelector(Labels.SelectIcon, ICON_FILE_TYPE_FILTER, this.#config[ConfigField.IconPath]);
        if (typeof iconPath !== 'string') return;
        this.#setCustomIcon(iconPath);
    }

    /**
     * @param {string|null} iconPath
     */
    #setCustomIcon(iconPath = null) {
        this.#setConfigOverride(ConfigField.IconPath, iconPath ?? null);
        if (typeof this.#customIcon !== 'function') return;
        this.#customIcon(iconPath);
    }

    /**
     * @param {SliderMenuItem} menuItem
     */
    #setIconSize(menuItem) {
        const slider = menuItem.slider;
        const iconSize = Math.round((AppIconSize.Max - AppIconSize.Min) * slider.value) + AppIconSize.Min;
        menuItem.value = iconSize;
        if (this.#isSyncing || !this.#appButton) return;
        const job = Context.jobs.removeAll(this).new(this, Delay.Sleep);
        job.destroy(() => this.#setConfigOverride(ConfigField.IconSize, iconSize));
    }

    /**
     * @param {string} field
     * @param {string|number|boolean|null} value
     */
    #setConfigOverride(field, value) {
        const app = this.#appButton?.app;
        const configProvider = this.#appButton?.configProvider;
        if (!app || !configProvider) return;
        configProvider.setConfigOverride(app, field, value);
        this.setItemActiveState(this.#resetAllItem);
    }

}

export class Menu extends AppMenu {

    /** @type {SharedConfig?} */
    static #sharedConfig = null;

    /** @type {boolean} */
    #isRerenderQueued = false;

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {boolean} */
    #hasValidAppId = true;

    /** @type {CurrentWorkspaceSection?} */
    #currentWorkspaceSection = null;

    /** @type {OtherWorkspacesSection?} */
    #otherWorkspacesSection = null;

    /** @type {SoundVolumeControlGroup?} */
    #soundVolumeControlGroup = null;

    /** @type {CustomizeChildMenu?} */
    #customizeChildMenu = null;

    /** @type {Config?} */
    #config = this.#configProvider.getConfig(this, settingsKey => this.#handleConfig(settingsKey));

    /** @type {SharedConfig} */
    get #configProvider() {
        Menu.#sharedConfig ??= new SharedConfig(ConfigFields, { path: CONFIG_PATH });
        return Menu.#sharedConfig;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(appButton.actor, St.Side.TOP, DefaultProps);
        this.#appButton = appButton;
        this.actor.remove_style_class_name(UNWANTED_STYLE_CLASS);
        this.actor.add_style_class_name(STYLE_CLASS);
        const app = appButton?.app;
        this.#hasValidAppId = app?.id ? !!this._appSystem?.lookup_app(app.id) : false;
        this.#createMenuItems();
        if (app) this.setApp(app);
        this._app?.disconnectObject(this);
        this._updateDetailsVisibility();
        const monitorManager = global.backend.get_monitor_manager();
        Context.signals.add(this, [monitorManager, Event.MonitorsChanged, () => this.close()]);
    }

    /**
     * Note: There is a bug in the AppMenu that leads to exceptions while destroying the menu.
     *       Set this._app as null to avoid the exceptions.
     *
     * @override
     */
    destroy() {
        Context.signals.removeAll(this);
        this.close();
        this._app = null;
        this.#appButton = null;
        this.#currentWorkspaceSection = null;
        this.#otherWorkspacesSection = null;
        this.#soundVolumeControlGroup = null;
        this.#customizeChildMenu = null;
        this.#config = null;
        super.destroy();
        if (!Menu.#sharedConfig?.destroy(this)) return;
        Menu.#sharedConfig = null;
    }

    /**
     * @override
     * @param {BoxPointer.PopupAnimation} animation
     */
    open(animation) {
        if (!this.#appButton || !this.#config) return;
        this.actor._arrowSide = MenuPosition[this.#appButton.location];
        this.rerender();
        super.open(animation);
    }

    rerender() {
        if (!this._app) return;
        if (this.#customizeChildMenu?.isOpen) {
            this.#isRerenderQueued = true;
            return; 
        }
        this.#isRerenderQueued = false;
        this._queueUpdateWindowsSection();
        this.#soundVolumeControlGroup?.update();
    }

    #createMenuItems() {
        this.#soundVolumeControlGroup = new SoundVolumeControlGroup(this.#appButton);
        this.addMenuItem(this.#soundVolumeControlGroup.actor);
        if (this.#hasValidAppId) {
            this.#customizeChildMenu = new CustomizeChildMenu(this.#appButton, () => {
                if (this.#isRerenderQueued) this.rerender();
                else this.#updateSeparators();
            });
            this.addMenuItem(this.#customizeChildMenu);
        }
        this.addMenuItem(new PopupSeparatorMenuItem());
        this.moveMenuItem(this._quitItem, this.numMenuItems);
        if (!this.#appButton) return;
        this.#currentWorkspaceSection = new CurrentWorkspaceSection(this.#appButton);
        this.#addSection(this.#currentWorkspaceSection, this._windowSection);
        if (!this.#hasValidAppId) return;
        this.#otherWorkspacesSection = new OtherWorkspacesSection(this.#appButton);
        this.#addSection(this.#otherWorkspacesSection, this._actionSection);
    }

    /**
     * @param {PopupMenuSection} section
     * @param {PopupMenuSection} [sibling] 
     */
    #addSection(section, sibling) {
        if (!section) return;
        this.addMenuItem(section);
        if (!sibling) return;
        this.box.set_child_above_sibling(section.actor, sibling.actor);
    }

    #updateSeparators() {
        if (!this.isOpen) return;
        this.emit(Event.OpenStateChanged, true);
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            case ConfigFields.isolateWorkspaces:
                this._updateWindowsSection();
                break;
            case ConfigFields.showFavorites:
                this._updateFavoriteItem();
                break;
        }
    }

    /**
     * @override
     * @param {*} actor
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    _onKeyPress(actor, event) {
        const key = event?.get_key_symbol();
        if (key === Clutter.KEY_space ||
            key === Clutter.KEY_Return) return Clutter.EVENT_PROPAGATE;
        return super._onKeyPress(actor, event);
    }

    /**
     * @override
     */
    _updateFavoriteItem() {
        super._updateFavoriteItem();
        if (!this._toggleFavoriteItem?.visible) return;
        if (!this.#config?.showFavorites) return this._toggleFavoriteItem.hide();
        const isFavorite = this._appFavorites?.isFavorite(this._app?.id);
        if (isFavorite) return;
        this._toggleFavoriteItem?.label?.set_text(Labels.Pin);
    }

    /**
     * @override
     */
    _updateWindowsSection() {
        if (!this._app || !this.isOpen ||
            !this.#appButton || this.#customizeChildMenu?.isOpen) return;
        const appWindows = this._app.get_windows();
        const taskbarWindows = this.#appButton.windows;
        const currentWorkspace = global.workspace_manager.get_active_workspace();
        const validWindows = [];
        const workspaceWindows = [];
        if (taskbarWindows?.size && appWindows?.length) {
            for (const window of appWindows) {
                if (taskbarWindows.has(window)) validWindows.push(window);
                if (window.get_workspace() === currentWorkspace) workspaceWindows.push(window);
            }
        }
        validWindows.filter = () => validWindows;
        const app = this._app;
        this._app = {
            get_windows: () => validWindows,
            get_name: () => app.get_name()
        };
        super._updateWindowsSection();
        this._app = app;
        if (!this.#config) return;
        const { isolateWorkspaces } = this.#config;
        if (this.#currentWorkspaceSection) {
            this.#currentWorkspaceSection.isTitleVisible = !isolateWorkspaces;
            this.#currentWorkspaceSection.windows = workspaceWindows;
        }
        if (this.#otherWorkspacesSection && this.#config) {
            const isSectionVisible = isolateWorkspaces && !!appWindows.length && !workspaceWindows.length;
            this.#otherWorkspacesSection.isVisible = isSectionVisible;
        }
        this.#updateSeparators();
    }

    /**
     * @override
     */
    _updateNewWindowItem() {
        super._updateNewWindowItem();
        this.#updateSeparators();
    }

    /**
     * @override
     */
    _updateDetailsVisibility() {
        if (!this._app) return;
        const appInfo = this._app.get_app_info();
        const isValidApp = this.#hasValidAppId && appInfo && !appInfo.get_nodisplay();
        if (isValidApp) super._updateDetailsVisibility();
        else this._detailsItem.hide();
    }

    /**
     * @override
     */
    _animateLaunch() {
        this.#appButton?.animateLaunch();
    }

    /**
     * @override
     * @param {PopupBaseMenuItem} menuItem
     */
    _updateSeparatorVisibility(menuItem) {
        if (!this._app || !this.isOpen || this.#customizeChildMenu?.isOpen) return;
        super._updateSeparatorVisibility(menuItem);
    }

}
