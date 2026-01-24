/**
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupBaseMenuItem} PopupBaseMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenuItem} PopupMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSeparatorMenuItem} PopupSeparatorMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/boxpointer.js').PopupAnimation} BoxPointer.PopupAnimation
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 * @typedef {import('../base/menu.js').RadioGroup} RadioGroup
 */

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import { PopupMenuSection,
         PopupSeparatorMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Context from '../../core/context.js';
import { SliderMenuItem, CollapsibleGroup, ChildMenu } from '../base/menu.js';
import { Icon } from '../base/icon.js';
import { SharedConfig } from '../../../shared/utils/config.js';
import { FileSelector } from '../../utils/zenity.js';
import { SoundVolumeIcon } from '../../utils/soundVolumeIcon.js';
import { WindowProxy } from '../../utils/taskbar/windowProxy.js';
import { Delay, Event, Alignment } from '../../../shared/enums/general.js';
import { SettingsKey } from '../../../shared/enums/settings.js';
import { Label } from '../../../shared/enums/labels.js';
import { ConfigOptions, ConfigKey,
         PreferredMonitor, AppIconSize, ActivationBehavior,
         AttentionBehavior, NotificationsBehavior } from '../../../shared/enums/taskbar.js';

const UNWANTED_STYLE_CLASS = 'app-menu';
const STYLE_CLASS = 'rocketbar__popup-menu';
const ICON_PATH_SEPARATOR = '/';
const ICON_FILE_TYPE_FILTER = `${Label.Icon} | *.svg *.png`;

/** @type {{favoritesSection: boolean, showSingleWindow: boolean}} */
const DefaultProps = {
    favoritesSection: true,
    showSingleWindow: true
};

/** @type {{[position: string]: number}} */
const MenuPosition = {
    [Alignment.Top]: St.Side.TOP,
    [Alignment.Bottom]: St.Side.BOTTOM
};

/** @type {{[value: string]: string}} */
const ActivateBehaviorRadioGroup = {
    [ActivationBehavior.Default]: Label.Default,
    [ActivationBehavior.FindWindow]: Label.FindWindow,
    [ActivationBehavior.MoveWindows]: Label.MoveWindows
};

/** @type {{[value: string]: string}} */
const AttentionBehaviorRadioGroup = {
    [AttentionBehavior.Default]: Label.Default,
    [AttentionBehavior.FocusActive]: Label.FocusActive,
    [AttentionBehavior.FocusWorkspace]: Label.FocusWorkspace,
    [AttentionBehavior.FocusAll]: Label.FocusAll
};

/** @type {{[value: string]: string}} */
const NotificationsBehaviorRadioGroup = {
    [NotificationsBehavior.Default]: Label.Default,
    [NotificationsBehavior.Disable]: Label.Disable,
    [NotificationsBehavior.Hide]: Label.AlwaysHide,
    [NotificationsBehavior.Show]: Label.AlwaysShow,
    [NotificationsBehavior.Critical]: Label.Critical
};

/** @type {{[value: string]: string}} */
const AttentionNotificationsBehaviorRadioGroup = {
    ...NotificationsBehaviorRadioGroup
};

/** @type {{[value: string]: string}} */
const PreferredMonitorRadioGroup = {
    [PreferredMonitor.Default]: Label.Default,
    [PreferredMonitor.Primary]: Label.PrimaryMonitor,
    [PreferredMonitor.Left]: Label.LeftOfPrimaryMonitor,
    [PreferredMonitor.Right]: Label.RightOfPrimaryMonitor,
    [PreferredMonitor.Above]: Label.AbovePrimaryMonitor,
    [PreferredMonitor.Below]: Label.BelowPrimaryMonitor
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
    isolateWorkspaces: SettingsKey.IsolateWorkspaces,
    showFavorites: SettingsKey.ShowFavorites
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
        super(Label.SoundVolumeControl);
        this.#appButton = appButton;
        this.#inputVolumeSlider = new SliderMenuItem((...args) => this.#setVolume(...args));
        this.#outputVolumeSlider = new SliderMenuItem((...args) => this.#setVolume(...args));
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
     * @param {boolean} isMute
     */
    #setVolume(menuItem, isMute) {
        if (this.#isSyncing) return;
        if (isMute) return this.#toggleMute(menuItem);
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

    /** @type {PopupBaseMenuItem?} */
    #minimizeAllItem = null;

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
        /** @type {*} */
        const params = Label.CurrentWorkspace;
        this.#title = new PopupSeparatorMenuItem(params);
        this.addMenuItem(this.#title);
        this.#minimizeAllItem = this.addAction(Label.MinimizeAll, () => appButton.windows?.minimize());
        this.addAction(Label.RaiseAll, () => appButton.windows?.raise());
        this.addAction(Label.CloseAll, () => appButton.windows?.close(true));
    }

    #destroy() {
        this.#actions?.clear();
        this.#actions = null;
        this.#windows = null;
        this.#title = null;
        this.#minimizeAllItem = null;
        this.#appButton = null;
    }

    #update() {
        if (!this.#appButton || !this.#actions ||
            !this.#minimizeAllItem || !this.#windows) return;
        this.#minimizeAllItem.visible = !!this.#windows.find(window => !window.minimized);
        if (this.#actions.size) {
            const menuItems = this.#actions.values();
            for (const menuItem of menuItems) menuItem?.destroy();
            this.#actions.clear();
        }
        const monitors = Context.monitors;
        if (!monitors.hasMultipleMonitors) return;
        const currentMonitor = monitors.getMonitorIndex(this.#appButton.rect);
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
                          monitors.getMonitorIndex(direction, currentMonitor);
            if (index < 0 || ignoredMonitors.has(index)) continue;
            const actionLabel = `${Label.MoveTo} ${Label[monitor]}`;
            this.#actions.set(index, this.addAction(actionLabel, () => this.#moveToMonitor(index)));
        }
    }

    /**
     * @param {number} monitorIndex
     */
    #moveToMonitor(monitorIndex) {
        if (!this.#windows?.length) return;
        for (const window of this.#windows) window.move_to_monitor(monitorIndex);
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
        /** @type {*} */
        const params = Label.OtherWorkspaces;
        this.addMenuItem(new PopupSeparatorMenuItem(params));
        this.addAction(Label.FindWindow, () => appButton?.activate(ActivationBehavior.FindWindow));
        this.addAction(Label.MoveWindows, () => appButton?.activate(ActivationBehavior.MoveWindows));
    }

}

class CustomizeChildMenu extends ChildMenu {

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {RadioGroup?} */
    #activateBehavior = null;

    /** @type {RadioGroup?} */
    #attentionBehavior = null;

    /** @type {RadioGroup?} */
    #attentionNotificationsBehavior = null;

    /** @type {RadioGroup?} */
    #notificationsBehavior = null;

    /** @type {RadioGroup?} */
    #preferredMonitor = null;

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
        super(Label.Customize, callback);
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
        this.#attentionBehavior = null;
        this.#attentionNotificationsBehavior = null;
        this.#notificationsBehavior = null;
        this.#preferredMonitor = null;
        this.#iconSize = null;
        this.#customIcon = null;
        this.#importIconItem = null;
        this.#resetAllItem = null;
    }

    #createMenuItems() {
        this.#activateBehavior = this.addRadioGroup(
            Label.ActivationBehavior, ActivateBehaviorRadioGroup,
            (...args) => this.#setRadioGroupValue(...args), true);
        this.#attentionBehavior = this.addRadioGroup(
            Label.AttentionBehavior, AttentionBehaviorRadioGroup,
            (...args) => this.#setRadioGroupValue(...args), true);
        this.#attentionNotificationsBehavior = this.addRadioGroup(
            Label.AttentionNotifications, AttentionNotificationsBehaviorRadioGroup,
            (...args) => this.#setRadioGroupValue(...args), true);
        this.#notificationsBehavior = this.addRadioGroup(
            Label.StandardNotifications, NotificationsBehaviorRadioGroup,
            (...args) => this.#setRadioGroupValue(...args), true);
        this.#preferredMonitor = this.addRadioGroup(
            Label.PreferredMonitor, PreferredMonitorRadioGroup,
            (...args) => this.#setRadioGroupValue(...args), true);
        this.#customIcon = this.#addCustomIconGroup();
        this.#iconSize = this.#addIconSizeSlider();
        this.addSeparator();
        this.#resetAllItem = this.menu.addAction(Label.ResetAllToDefault, () => this.#resetAll());
    }

    /**
     * @returns {(iconPath: string?) => void}
     */
    #addCustomIconGroup() {
        const separator = this.addSeparator(Label.CustomIcon);
        const collapsible = this.addCollapsibleGroup(Label.Default);
        const collapsibleMenu = collapsible.menu;
        collapsibleMenu.itemActivated = () => {};
        collapsibleMenu.addAction(Label.SelectIcon, () => this.#selectIcon());
        this.#importIconItem = collapsibleMenu.addAction(Label.IconFromClipboard, () => {
            if (typeof this.#clipboardIconPath !== 'string') return;
            this.#setCustomIcon(this.#clipboardIconPath);
        });
        this.setItemActiveState(this.#importIconItem, false);
        const resetIconItem = collapsibleMenu.addAction(Label.ResetToDefault, () => this.#setCustomIcon());
        return iconPath => {
            const isEmptyIconPath = typeof iconPath !== 'string' || !iconPath.trim();
            collapsible.title = isEmptyIconPath ? Label.Default :
                                iconPath.split(ICON_PATH_SEPARATOR).pop() ?? iconPath;
            this.setChangedIndicator(separator, !isEmptyIconPath);
            this.setItemActiveState(resetIconItem, !isEmptyIconPath);
        };
    }

    /**
     * @returns {(iconSize: number, defaultIconSize: number, isDefault: boolean) => void}
     */
    #addIconSizeSlider() {
        const separator = this.addSeparator(Label.IconSize);
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
        const appId = this.#appButton?.app?.id;
        if (!appId) return;
        this.#appButton?.configProvider?.resetOverride(appId);
        this.#sync();
    }

    #sync() {
        if (!this.isOpen ||
            typeof this.#activateBehavior !== 'function' ||
            typeof this.#attentionBehavior !== 'function' ||
            typeof this.#attentionNotificationsBehavior !== 'function' ||
            typeof this.#notificationsBehavior !== 'function' ||
            typeof this.#preferredMonitor !== 'function' ||
            typeof this.#iconSize !== 'function' ||
            typeof this.#customIcon !== 'function') return;
        const appId = this.#appButton?.app?.id;
        const configProvider = this.#appButton?.configProvider;
        if (!configProvider || !appId) return;
        this.#config ??= configProvider.get(appId);
        if (!this.#config) return;
        this.#isSyncing = true;
        const config = this.#config;
        const defaultConfig = configProvider.defaultConfig;
        const activateBehaviorVisibilityHandler = item => {
            item.visible = config.isolateWorkspaces ?? false;
        };
        const preferredMonitorVisibilityHandler = item => {
            item.visible = config.windowRouting ?? false;
        };
        this.#activateBehavior(config[ConfigKey.ActivationBehavior],
            !configProvider.hasOverride(appId, ConfigKey.ActivationBehavior))
            .forEach(activateBehaviorVisibilityHandler);
        this.#attentionBehavior(config[ConfigKey.AttentionBehavior],
            !configProvider.hasOverride(appId, ConfigKey.AttentionBehavior));
        this.#attentionNotificationsBehavior(config[ConfigKey.AttentionNotificationsBehavior],
            !configProvider.hasOverride(appId, ConfigKey.AttentionNotificationsBehavior));
        this.#notificationsBehavior(config[ConfigKey.NotificationsBehavior],
            !configProvider.hasOverride(appId, ConfigKey.NotificationsBehavior));
        this.#preferredMonitor(config[ConfigKey.PreferredMonitor],
            !configProvider.hasOverride(appId, ConfigKey.PreferredMonitor))
            .forEach(preferredMonitorVisibilityHandler);
        this.#iconSize(config[ConfigKey.IconSize], defaultConfig[ConfigKey.IconSize],
            !configProvider.hasOverride(appId, ConfigKey.IconSizeOffset));
        this.#customIcon(config[ConfigKey.IconPath]);
        this.setItemActiveState(this.#resetAllItem, configProvider.hasOverride(appId));
        this.#scanClipboard();
        this.#isSyncing = false;
    }

    #scanClipboard() {
        if (!this.#config) return;
        St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_, iconPath) => {
            const isValidIcon = !!iconPath && (Icon.isIconFilePath(iconPath) ||
                                               Context.desktop.iconTheme.has_icon(iconPath));
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
        let key = null;
        switch (group) {
            case ActivateBehaviorRadioGroup:
                key = ConfigKey.ActivationBehavior;
                break;
            case AttentionBehaviorRadioGroup:
                key = ConfigKey.AttentionBehavior;
                break;
            case AttentionNotificationsBehaviorRadioGroup:
                key = ConfigKey.AttentionNotificationsBehavior;
                break;
            case NotificationsBehaviorRadioGroup:
                key = ConfigKey.NotificationsBehavior;
                break;
            case PreferredMonitorRadioGroup:
                key = ConfigKey.PreferredMonitor;
                break;
        }
        if (!key || !value) return;
        this.#setConfigOverride(key, value);
    }

    async #selectIcon() {
        if (!this.#config) return;
        this.parentMenu?.toggle();
        const iconPath = await FileSelector(Label.SelectIcon, ICON_FILE_TYPE_FILTER, this.#config[ConfigKey.IconPath]);
        if (typeof iconPath !== 'string') return;
        this.#setCustomIcon(iconPath);
    }

    /**
     * @param {string?} iconPath
     */
    #setCustomIcon(iconPath = null) {
        this.#setConfigOverride(ConfigKey.IconPath, iconPath ?? null);
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
        Context.jobs.removeAll(this).new(this, Delay.Sleep).destroy(() =>
            this.#setConfigOverride(ConfigKey.IconSize, iconSize));
    }

    /**
     * @param {string} key
     * @param {string|number|boolean|null} value
     */
    #setConfigOverride(key, value) {
        const appId = this.#appButton?.app?.id;
        const configProvider = this.#appButton?.configProvider;
        if (!appId || !configProvider) return;
        configProvider.setOverride(appId, key, value);
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

    /** @type {WindowProxy[]?} */
    #windows = null;

    /** @type {Config?} */
    #config = this.#configProvider.get(this, settingsKey => this.#handleConfig(settingsKey));

    /** @type {SharedConfig} */
    get #configProvider() {
        Menu.#sharedConfig ??= new SharedConfig(ConfigField, ConfigOptions);
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
        this.#destroySeparator(this._detailsItem);
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
        const [_, y] = Context.monitors.getAlignment(this.#appButton.rect);
        this.actor._arrowSide = MenuPosition[y];
        this.rerender();
        super.open(animation);
    }

    /**
     * @override
     * @param {BoxPointer.PopupAnimation} [animation]
     */
    close(animation) {
        super.close(animation);
        this.#clearWindows();
    }

    rerender() {
        if (!this._app) return;
        if (this.#customizeChildMenu?.isOpen) {
            this.#isRerenderQueued = true;
            return;
        }
        this.#isRerenderQueued = false;
        this.#soundVolumeControlGroup?.update();
        this.#handleWindows();
        this.#updateSeparators();
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

    /**
     * @param {PopupBaseMenuItem} menuItem
     */
    #destroySeparator(menuItem) {
        const menuItems = this.box.get_children();
        const itemIndex = menuItems.indexOf(menuItem?.actor);
        if (itemIndex < 0) return;
        const detailsSeparator = menuItems[itemIndex - 1];
        if (detailsSeparator instanceof PopupSeparatorMenuItem === false) return;
        detailsSeparator.destroy();
    }

    #updateSeparators() {
        if (!this.isOpen) return;
        this.emit(Event.OpenStateChanged, true);
    }

    #handleWindows() {
        if (!this._app || !this.#appButton ||
            !this.#config || !this._windowSection) return;
        this.#clearWindows();
        this._windowSection.removeAll();
        const { isolateWorkspaces } = this.#config;
        const appName = this._app.get_name();
        const appWindows = this._app.get_windows();
        const currentWorkspace = global.workspace_manager.get_active_workspace();
        const taskbarWindows = this.#appButton.windows?.list;
        const workspaceWindows = [];
        for (const window of appWindows) {
            if (window.get_workspace() === currentWorkspace) workspaceWindows.push(window);
            if (!taskbarWindows?.has(window)) continue;
            const proxy = new WindowProxy(window, appName);
            this.#windows ??= [];
            this.#windows.push(proxy);
            const menuItem = this._windowSection.addAction(proxy.title, () => proxy.activate());
            proxy.connect(Event.TitleChanged, () => menuItem.label?.set_text(proxy.title));
        }
        this._openWindowsHeader.visible = !!this.#windows?.length;
        if (this.#currentWorkspaceSection) {
            this.#currentWorkspaceSection.isTitleVisible = !isolateWorkspaces;
            this.#currentWorkspaceSection.windows = workspaceWindows;
        }
        if (this.#otherWorkspacesSection) {
            const isSectionVisible = isolateWorkspaces && !!appWindows.length && !workspaceWindows.length;
            this.#otherWorkspacesSection.isVisible = isSectionVisible;
        }
    }

    #clearWindows() {
        if (!this.#windows?.length) return;
        for (const window of this.#windows) window.destroy();
        this.#windows = null;
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            case ConfigField.showFavorites:
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
        this._toggleFavoriteItem?.label?.set_text(Label.Pin);
    }

    /**
     * Note: Replaced by `#handleWindows` function.
     *
     * @override
     */
    _queueUpdateWindowsSection() {}

    /**
     * Note: Replaced by `#handleWindows` function.
     *
     * @override
     */
    _updateWindowsSection() {}

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
        if (!this._app || !this._detailsItem) return;
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
