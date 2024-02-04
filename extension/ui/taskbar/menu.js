/**
 * JSDoc types
 *
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupBaseMenuItem} PopupBaseMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenuItem} PopupMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/boxpointer.js').PopupAnimation} BoxPointer.PopupAnimation
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import { PopupMenuSection, PopupSeparatorMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Context from '../../core/context.js';
import { SliderMenuItem, CollapsibleGroup, ChildMenu } from '../base/menu.js';
import { Delay, Event } from '../../core/enums.js';
import { ComponentLocation } from '../base/component.js';
import { Config } from '../../utils/config.js';
import { FileSelector } from '../../utils/zenity.js';
import { ActivateBehavior, DemandsAttentionBehavior, AppIconSize } from '../../utils/taskbar/appConfig.js';
import { Labels } from '../../core/labels.js';

const CONFIG_PATH = 'taskbar';
const UNWANTED_STYLE_CLASS = 'app-menu';
const STYLE_CLASS = 'rocketbar__popup-menu';
const ICON_PATH_REGEXP_STRING = /^\/(.)*(\.(svg|png))$/;
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
    [DemandsAttentionBehavior.FocusActive]: Labels.FocusActive,
    [DemandsAttentionBehavior.FocusAll]: Labels.FocusAll
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

/** @enum {string} */
const SoundVolumeIcon = {
    Output: 'audio-speakers-symbolic',
    Input: 'audio-input-microphone-symbolic'
};

class SoundVolumeControlGroup extends CollapsibleGroup {

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {SliderMenuItem?} */
    #inputVolumeSlider = new SliderMenuItem(menuItem => this.#setVolume(menuItem), SoundVolumeIcon.Input);

    /** @type {SliderMenuItem?} */
    #outputVolumeSlider = new SliderMenuItem(menuItem => this.#setVolume(menuItem), SoundVolumeIcon.Output);

    /** @type {boolean} */
    #isSyncing = false;

    /**
     * @param {AppButton?} appButton
     */
    constructor(appButton) {
        super(Labels.SoundVolumeControl);
        this.#appButton = appButton;
        this.actor.connect(Event.Destroy, () => this.#destroy());
        this.menu.addMenuItem(this.#inputVolumeSlider?.actor);
        this.menu.addMenuItem(this.#outputVolumeSlider?.actor);
        this.menu.connect(Event.OpenStateChanged, () => this.#syncVolume());
    }

    update() {
        if (!this.actor || !this.#inputVolumeSlider || !this.#outputVolumeSlider) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl?.hasInput &&
            !soundVolumeControl?.hasOutput) return this.actor.hide();
        else this.actor.show();
        this.#inputVolumeSlider.actor.visible = soundVolumeControl.hasInput;
        this.#outputVolumeSlider.actor.visible = soundVolumeControl.hasOutput;
    }

    /**
     * @param {SliderMenuItem} menuItem
     */
    #setVolume(menuItem) {
        if (this.#isSyncing) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const slider = menuItem?.slider;
        if (!slider) return;
        if (menuItem === this.#inputVolumeSlider) {
            soundVolumeControl.inputVolume = slider.value;
        } else if (menuItem === this.#outputVolumeSlider) {
            soundVolumeControl.outputVolume = slider.value;
        }
    }

    #syncVolume() {
        if (!this.isOpen || !this.#inputVolumeSlider || !this.#outputVolumeSlider) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        this.#isSyncing = true;
        this.#inputVolumeSlider.slider.value = soundVolumeControl.inputVolume;
        this.#outputVolumeSlider.slider.value = soundVolumeControl.outputVolume;
        this.#isSyncing = false;
    }

    #destroy() {
        this.#appButton = null;
        this.#inputVolumeSlider = null;
        this.#outputVolumeSlider = null;
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
     */
    constructor(appButton) {
        super(Labels.Customize);
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
        const collapsible = this.addCollapsibleGroup(Labels.NotSelected);
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
            collapsible.title = isEmptyIconPath ? Labels.NotSelected : iconPath.split(ICON_PATH_SEPARATOR).pop();
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
                              .forEach(item => (item.visible = config.isolateWorkspaces));
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
            const isValidIcon = ICON_PATH_REGEXP_STRING.test(iconPath ?? null);
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

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {boolean} */
    #hasValidAppId = true;

    /** @type {boolean} */
    #isWindowsSectionUpdateQueued = false;

    /** @type {SoundVolumeControlGroup?} */
    #soundVolumeControlGroup = null;

    /** @type {PopupMenuSection?} */
    #moreActionsSection = null;

    /** @type {Config} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey), { path: CONFIG_PATH });

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
        this._updateDetailsVisibility();
    }

    /**
     * Note: There is a bug in the AppMenu that leads to exceptions while destroying the menu.
     *       Set this._app as null to avoid the exceptions.
     *
     * @override
     */
    destroy() {
        Context.signals.removeAll(this);
        this.close(false);
        this._app?.disconnectObject(this);
        this._app = null;
        this.#appButton  = null;
        this.#soundVolumeControlGroup = null;
        this.#moreActionsSection = null;
        super.destroy();
    }

    /**
     * @override
     * @param {BoxPointer.PopupAnimation} animation
     */
    open(animation) {
        this.actor._arrowSide = MenuPosition[this.#appButton?.location ?? ComponentLocation.Top];
        if (this.#isWindowsSectionUpdateQueued ||
            this.#config.isolateWorkspaces) this._updateWindowsSection();
        this.#soundVolumeControlGroup?.update();
        super.open(animation);
    }

    #createMenuItems() {
        this.#soundVolumeControlGroup = new SoundVolumeControlGroup(this.#appButton);
        this.addMenuItem(this.#soundVolumeControlGroup.actor);
        if (this.#hasValidAppId) this.addMenuItem(new CustomizeChildMenu(this.#appButton));
        this.addMenuItem(new PopupSeparatorMenuItem());
        this.moveMenuItem(this._quitItem, this.numMenuItems);
        if (this.#hasValidAppId) this.#createMoreActionsSection();
    }

    #createMoreActionsSection() {
        const menuItemAbove = this._actionSection?.actor ?? null;
        this.#moreActionsSection = new PopupMenuSection();
        this.#moreActionsSection._updateSeparatorVisibility = () => {};
        this.#moreActionsSection.addMenuItem(new PopupSeparatorMenuItem());
        this.#moreActionsSection.addAction(Labels.FindWindow, () =>
            this.#appButton?.activate(ActivateBehavior.FindWindow));
        this.#moreActionsSection.addAction(Labels.MoveWindows, () =>
            this.#appButton?.activate(ActivateBehavior.MoveWindows));
        this.addMenuItem(this.#moreActionsSection);
        this.box.set_child_above_sibling(this.#moreActionsSection.actor, menuItemAbove);
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
        if (!this.#config.showFavorites) return this._toggleFavoriteItem.hide();
        const isFavorite = this._appFavorites?.isFavorite(this._app?.id);
        if (isFavorite) return;
        this._toggleFavoriteItem.label?.set_text(Labels.Pin);
    }

    /**
     * @override
     */
    _queueUpdateWindowsSection() {
        if (this.isOpen) super._queueUpdateWindowsSection();
        this.#isWindowsSectionUpdateQueued = !this.isOpen;
    }

    /**
     * @override
     */
    _updateWindowsSection() {
        this.#isWindowsSectionUpdateQueued = false;
        if (!this._app) return;
        if (!this.#config.isolateWorkspaces) {
            this.#moreActionsSection?.actor?.hide();
            super._updateWindowsSection();
            return;
        }
        const workspace = global.workspace_manager.get_active_workspace();
        const appWindows = this._app.get_windows() ?? [];
        const workspaceWindows = appWindows.filter(window => window.get_workspace() === workspace);
        const origin = this._app;
        this._app = {
            get_windows: () => workspaceWindows,
            get_name: () => origin.get_name()
        };
        super._updateWindowsSection();
        this._app = origin;
        if (!this.#moreActionsSection?.actor) return;
        const canShowMoreActions = !!appWindows.length && !workspaceWindows.length;
        this.#moreActionsSection.actor.visible = canShowMoreActions;
    }

    /**
     * @override
     */
    _updateDetailsVisibility() {
        if (this._app && this.#hasValidAppId) super._updateDetailsVisibility();
        else this._detailsItem.hide();
    }

    /**
     * @override
     */
    _animateLaunch() {
        this.#appButton?.animateLaunch();
    }

}
