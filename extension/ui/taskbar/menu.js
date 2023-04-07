/* exported Menu */

/** @typedef {import('./appButton.js').AppButton} AppButton */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { AppMenu, Slider, Ornament, ArrowIcon } from '../../core/legacy.js';
import { PopupSubMenuMenuItem, PopupSeparatorMenuItem, PopupBaseMenuItem, PopupMenuSection } from '../../core/legacy.js';
import { Context } from '../../core/context.js';
import { Delay, Event, Type } from '../../core/enums.js';
import { ComponentLocation } from '../base/component.js';
import { Config } from '../../utils/config.js';
import { ActivateBehavior, DemandsAttentionBehavior, AppIconSize } from '../../utils/taskbar/appConfig.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { Labels } from '../../core/labels.js';

const UNWANTED_STYLE_CLASS = 'app-menu';
const DEFAULT_STYLE_CLASS = 'rocketbar__popup-menu';
const SECTION_TITLE_STYLE_CLASS = 'rocketbar__popup-menu_section-title';
const OPTIONS_GROUP_STYLE_CLASS = 'rocketbar__popup-menu_options-group';
const SLIDER_ICON_STYLE_CLASS = 'popup-menu-icon';
const EXPANDER_STYLE_CLASS = 'popup-menu-item-expander';
const INACTIVE_MENU_ITEM_STYLE_PSEUDO_CLASS = 'insensitive';
const ICON_PATH_REGEXP_STRING = /^\/(.)*(\.(svg|png))$/;
const ICON_PATH_SEPARATOR = '/';

const ICON_SIZE_CONFIG_FIELD = 'iconSize';
const ICON_PATH_CONFIG_FIELD = 'iconPath';
const ACTIVATE_BEHAVIOR_CONFIG_FIELD = 'activateBehavior';
const DEMANDS_ATTENTION_BEHAVIOR_CONFIG_FIELD = 'demandsAttentionBehavior';

/** @type {Object.<string, boolean>} */
const DefaultProps = {
    favoritesSection: true,
    showSingleWindows: true
};

/** @type {Object.<string, boolean>} */
const SliderMenuItemProps = {
    activate: false
};

/** @type {Object.<string, string>} */
const SliderIconProps = {
    style_class: SLIDER_ICON_STYLE_CLASS
};

/** @type {Object.<string, boolean|number>} */
const SliderValueProps = {
    y_expand: true,
    y_align: Clutter.ActorAlign.CENTER
};

/** @type {Object.<string, boolean|string>} */
const MenuItemExpanderProps = {
    style_class: EXPANDER_STYLE_CLASS,
    x_expand: true
};

/** @type {Object.<number, number>} */
const MenuPosition = {
    [ComponentLocation.Top]: St.Side.TOP,
    [ComponentLocation.Bottom]: St.Side.BOTTOM
};

/** @type {Object.<string, string>} */
const ActivateBehaviorCheckboxGroup = {
    [ActivateBehavior.NewWindow]: Labels.NewWindow,
    [ActivateBehavior.MoveWindows]: Labels.MoveWindows
};

/** @type {Object.<string, string>} */
const DemandsAttentionBehaviorCheckboxGroup = {
    [DemandsAttentionBehavior.FocusActive]: Labels.FocusActive,
    [DemandsAttentionBehavior.FocusAll]: Labels.FocusAll
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

class SliderMenuItem {

    /** @type {PopupBaseMenuItem} */
    #actor = new PopupBaseMenuItem(SliderMenuItemProps);

    /** @type {Slider} */
    #slider = new Slider(0);

    /** @type {St.Icon} */
    #icon = new St.Icon(SliderIconProps);

    /** @type {St.Label} */
    #value = new St.Label(SliderValueProps);

    /** @type {PopupBaseMenuItem} */
    get actor() {
        return this.#actor;
    }

    /** @type {Slider} */
    get slider() {
        return this.#slider;
    }

    /** @param {string} value */
    set icon(value) {
        if (typeof value !== Type.String) this.#icon.set_icon_name(null);
        else this.#icon.set_icon_name(value);
    }

    /** @param {number} value */
    set value(value) {
        if (typeof value !== Type.Number) this.#value.set_text(null);
        else this.#value.set_text(Math.round(value).toString());
    }

    /**
     * @param {(menuItem: SliderMenuItem) => void} callback
     * @param {string} [icon]
     * @param {number} [value]
     */
    constructor(callback, icon, value) {
        this.#actor.setOrnament(Ornament.HIDDEN);
        this.#actor.add_child(this.#icon);
        this.#actor.add_child(this.#slider);
        this.#actor.add_child(this.#value);
        this.icon = icon;
        this.value = value;
        this.#actor.connect(Event.KeyPress, (_, event) => this.#slider.emit(Event.KeyPress, event));
        if (typeof callback !== Type.Function) return;
        this.#slider.connect(Event.ValueChanged, () => callback(this));
    }

}

class MenuSection {

    /** @type {PopupSubMenuMenuItem} */
    #actor = null;

    /** @type {PopupSubMenuMenuItem} */
    get actor() {
        return this.#actor;
    }

    /** @type {PopupSubMenu} */
    get menu() {
        return this.#actor?.menu;
    }

    /** @type {boolean} */
    get isOpen() {
        return this.#actor?.menu?.isOpen;
    }

    /**
     * @param {string} [title]
     */
    constructor(title) {
        this.#actor = new PopupSubMenuMenuItem(title);
        this.#actor.connect(Event.Destroy, () => { this.#actor = null; });
    }

}

class ChildMenu extends PopupMenuSection {

    /** @type {Set<PopupBaseMenuItem>} */
    #hiddenMenuItems = new Set();

    /** @type {PopupBaseMenuItem} */
    #titleMenuItem = null;

    /** @type {St.Icon} */
    #arrowLeft = ArrowIcon(St.Side.LEFT);

    /** @type {St.Icon} */
    #arrowRight = ArrowIcon(St.Side.RIGHT);

    /** @type {PopupMenuSection} */
    #menu = new PopupMenuSection();

    /** @type {PopupMenuSection} */
    get menu() {
        return this.#menu;
    }

    /**
     * @param {string} title
     */
    constructor(title) {
        super();
        this.isOpen = false;
        this.#menu.actor.hide();
        this.#arrowLeft.hide();
        this.#titleMenuItem = this.addAction(title, () => this.toggle());
        this.#titleMenuItem.add_child(new St.Bin(MenuItemExpanderProps));
        this.#titleMenuItem.insert_child_at_index(this.#arrowLeft, 0);
        this.#titleMenuItem.add_child(this.#arrowRight);
        this.addMenuItem(this.#menu);
    }

    destroy() {
        super.destroy();
        this.#menu = null;
        this.#titleMenuItem = null;
        this.#arrowLeft = null;
        this.#arrowRight = null;
        Context.signals.removeAll(this);
    }

    /**
     * Note: Prevent undesirable behavior when the parent menu calls this function.
     */
    itemActivated() {}

    /**
     * Note: Prevent undesirable behavior when the parent menu calls this function.
     */
    open() {}

    /**
     * Note: Set closed flag if parent menu is closed but don't handle state.
     */
    close() {
        this.isOpen = false;
        super.close();
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) super.open();
        this.#handleState();
        if (this.isOpen) return;
        super.close();
    }

    /**
     * @param {PopupBaseMenuItem} menuItem
     * @param {boolean} isActive
     */
    setItemActiveState(menuItem, isActive = true) {
        if (menuItem instanceof PopupBaseMenuItem === false) return;
        menuItem._activatable = isActive;
        if (isActive) menuItem.remove_style_pseudo_class(INACTIVE_MENU_ITEM_STYLE_PSEUDO_CLASS);
        else menuItem.add_style_pseudo_class(INACTIVE_MENU_ITEM_STYLE_PSEUDO_CLASS);
    }

    /**
     * @param {string} title
     * @param {Object.<string, string>} items
     * @param {(value: string, items: Object.<string, string>) => void} callback
     * @returns {(value: string) => PopupBaseMenuItem[]}
     */
    addCheckboxGroup(title, items, callback) {
        const group = new Map();
        const separator = this.addSeparator(title);
        /** @param {string} value */
        const handler = value => {
            const result = [separator];
            for (const [itemValue, item] of group) {
                if (itemValue === value) item.setOrnament(Ornament.DOT);
                else item.setOrnament(Ornament.NONE);
                result.push(item);
            }
            if (typeof callback === Type.Function) callback(value, items);
            return result;
        };
        for (const value in items) group.set(value, this.#menu.addAction(items[value], () => handler(value)));
        return handler;
    }

    /**
     * @param {string} [title]
     * @returns {PopupSeparatorMenuItem}
     */
    addSeparator(title = null) {
        const separator = new PopupSeparatorMenuItem(title);
        if (title) separator.add_style_class_name(SECTION_TITLE_STYLE_CLASS);
        this.#menu.addMenuItem(separator);
        return separator;
    }

    #handleState() {
        const parentMenu = this._getTopMenu();
        const parentActor = parentMenu?.actor;
        if (!parentMenu.isOpen || !parentActor) return;
        parentActor.remove_all_transitions();
        const location = parentActor._arrowSide;
        const translation = parentMenu._boxPointer?.get_theme_node()?.get_length('-arrow-rise') ?? 0;
        const mode = Clutter.AnimationMode.LINEAR;
        Animation(parentActor, AnimationDuration.Fast, { ...AnimationType.OpacityMin, mode }).then(() => {
            this.#toggleVisibility();
            this.#titleMenuItem?.grab_key_focus();
            parentActor.translation_y = location === St.Side.BOTTOM ? translation : -translation;
            Animation(parentActor, AnimationDuration.Fast, { ...AnimationType.OpacityMax, ...AnimationType.TranslationReset, mode });
        });
        if (!this.isOpen || Context.signals.hasClient(this)) return;
        Context.signals.add(this, [parentMenu, Event.MenuClosed, () => this.#toggleVisibility()]);
    }

    #toggleVisibility() {
        if (!this.isOpen) {
            this.#menu.actor.hide();
            this.#arrowLeft.hide();
            this.#arrowRight.show();
            if (!this.#hiddenMenuItems.size) return;
            for (const menuItem of this.#hiddenMenuItems) menuItem.show();
            return this.#hiddenMenuItems.clear();
        }
        this.#menu.actor.show();
        this.#arrowLeft.show();
        this.#arrowRight.hide();
        const menuItems = this.actor?.get_parent()?.get_children();
        if (!menuItems) return;
        for (let i = 0, l = menuItems.length; i < l; ++i) {
            const menuItem = menuItems[i];
            if (menuItem === this.actor) continue;
            if (!menuItem.visible) continue;
            this.#hiddenMenuItems.add(menuItem);
            menuItem.hide();
        }
    }

}

class SoundVolumeControlSection extends MenuSection {

    /** @type {AppButton} */
    #appButton = null;

    /** @type {SliderMenuItem} */
    #inputVolumeSlider = new SliderMenuItem(menuItem => this.#setVolume(menuItem), SoundVolumeIcon.Input);

    /** @type {SliderMenuItem} */
    #outputVolumeSlider = new SliderMenuItem(menuItem => this.#setVolume(menuItem), SoundVolumeIcon.Output);

    /** @type {boolean} */
    #isSyncing = false;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(Labels.SoundVolumeControl);
        this.#appButton = appButton;
        this.menu.addMenuItem(this.#inputVolumeSlider.actor);
        this.menu.addMenuItem(this.#outputVolumeSlider.actor);
        this.menu.connect(Event.OpenStateChanged, () => this.#syncVolume());
        this.actor.connect(Event.Destroy, () => { this.#appButton = null; });
    }

    update() {
        if (!this.actor) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl?.hasInput && !soundVolumeControl?.hasOutput) return this.actor.hide();
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

    async #syncVolume() {
        if (!this.isOpen) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        this.#isSyncing = true;
        this.#inputVolumeSlider.slider.value = soundVolumeControl.inputVolume;
        this.#outputVolumeSlider.slider.value = soundVolumeControl.outputVolume;
        this.#isSyncing = false;
    }

}

class CustomizeSection extends ChildMenu {

    /** @type {AppButton} */
    #appButton = null;

    /** @type {SliderMenuItem} */
    #iconSizeSlider = new SliderMenuItem(menuItem => this.#setIconSize(menuItem), null, AppIconSize.Min);

    /** @type {(value: string) => PopupBaseMenuItem[]} */
    #activateBehavior = null;

    /** @type {(value: string) => PopupBaseMenuItem[]} */
    #demandsAttentionBehavior = null;

    /** @type {PopupMenuItem} */
    #importIconItem = null;

    /** @type {PopupMenuItem} */
    #resetIconItem = null;

    /** @type {PopupMenuItem} */
    #resetAllItem = null;

    /** @type {boolean} */
    #isSyncing = false;

    /** @type {Object.<string, string|number|boolean>} */
    #config = null;

    /** @type {string} */
    #clipboardIconPath = null;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(Labels.Customize);
        this.#appButton = appButton;
        this.#createMenuItems();
        this.menu.itemActivated = () => {};
        this.menu.actor.add_style_class_name(OPTIONS_GROUP_STYLE_CLASS);
        this.menu.connect(Event.OpenStateChanged, () => this.#sync());
        this.actor.connect(Event.Destroy, () => { this.#appButton = null; });
    }

    #createMenuItems() {
        const menu = this.menu;
        this.#activateBehavior = this.addCheckboxGroup(
            Labels.ActivateBehavior, ActivateBehaviorCheckboxGroup,
            (...args) => this.#setCheckboxValue(...args));
        this.#demandsAttentionBehavior = this.addCheckboxGroup(
            Labels.DemandsAttentionBehavior, DemandsAttentionBehaviorCheckboxGroup,
            (...args) => this.#setCheckboxValue(...args));
        this.addSeparator(Labels.IconSize);
        menu.addMenuItem(this.#iconSizeSlider.actor);
        this.addSeparator(Labels.CustomIcon);
        this.#importIconItem = menu.addAction(Labels.NoIconInClipboard, () => this.#importIcon());
        this.#resetIconItem = menu.addAction(Labels.ResetToDefault, () => this.#resetIcon());
        this.addSeparator();
        this.#resetAllItem = menu.addAction(Labels.ResetAllToDefault, () => this.#resetAll());
    }

    #resetAll() {
        if (!this.#appButton) return;
        this.#appButton.configProvider?.resetConfigOverride(this.#appButton.app);
        this.#sync();
    }

    #sync() {
        if (!this.isOpen) return;
        const app = this.#appButton?.app;
        const configProvider = this.#appButton?.configProvider;
        if (!configProvider || !app) return;
        if (!this.#config) {
            this.#config = configProvider.getConfig(app);
        }
        const config = this.#config;
        this.#isSyncing = true;
        this.#activateBehavior(config[ACTIVATE_BEHAVIOR_CONFIG_FIELD]).forEach(item => item.visible = config.isolateWorkspaces);
        this.#demandsAttentionBehavior(config[DEMANDS_ATTENTION_BEHAVIOR_CONFIG_FIELD]);
        this.#setIconSizeSliderPosition(config[ICON_SIZE_CONFIG_FIELD], configProvider.defaultConfig[ICON_SIZE_CONFIG_FIELD]);
        this.setItemActiveState(this.#resetIconItem, typeof config[ICON_PATH_CONFIG_FIELD] === Type.String);
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
            if (!isValidIcon) {
                this.#importIconItem.label.set_text(Labels.NoIconInClipboard);
                return this.#importIconItem.setOrnament(Ornament.NONE);
            }
            const iconName = iconPath.split(ICON_PATH_SEPARATOR).pop();
            this.#importIconItem.label.set_text(iconName);
            if (this.#config[ICON_PATH_CONFIG_FIELD] === iconPath) this.#importIconItem.setOrnament(Ornament.NONE);
            else this.#importIconItem.setOrnament(Ornament.CHECK);
        });
    }

    #setIconSizeSliderPosition(iconSize, defaultIconSize) {
        if (typeof iconSize !== Type.Number || typeof defaultIconSize !== Type.Number) return;
        const slider = this.#iconSizeSlider.slider;
        const offset = AppIconSize.Max - AppIconSize.Min;
        slider.overdriveStart = (defaultIconSize - AppIconSize.Min) / offset;
        slider.value = (iconSize - AppIconSize.Min) / offset;
    }

    #setIconSize(menuItem) {
        const slider = menuItem.slider;
        const iconSize = Math.round((AppIconSize.Max - AppIconSize.Min) * slider.value) + AppIconSize.Min;
        menuItem.value = iconSize;
        if (this.#isSyncing || !this.#appButton) return;
        const job = Context.jobs.removeAll(this).new(this, Delay.Sleep);
        job.destroy(() => this.#setConfigOverride(ICON_SIZE_CONFIG_FIELD, iconSize)).catch();
    }

    #setCheckboxValue(value, group) {
        if (this.#isSyncing || !this.#appButton) return;
        let field = null;
        switch (group) {
            case ActivateBehaviorCheckboxGroup:
                field = ACTIVATE_BEHAVIOR_CONFIG_FIELD;
                break;
            case DemandsAttentionBehaviorCheckboxGroup:
                field = DEMANDS_ATTENTION_BEHAVIOR_CONFIG_FIELD;
                break;
        }
        if (!field || !value) return;
        this.#setConfigOverride(field, value);
    }

    #importIcon() {
        if (typeof this.#clipboardIconPath !== Type.String) return;
        this.#setConfigOverride(ICON_PATH_CONFIG_FIELD, this.#clipboardIconPath);
        this.#importIconItem.setOrnament(Ornament.NONE);
        this.setItemActiveState(this.#resetIconItem, true);
    }

    #resetIcon() {
        this.#setConfigOverride(ICON_PATH_CONFIG_FIELD, null);
        this.setItemActiveState(this.#resetIconItem, false);
        if (typeof this.#clipboardIconPath !== Type.String) return;
        this.#importIconItem.setOrnament(Ornament.CHECK);
    }

    #setConfigOverride(field, value) {
        const configProvider = this.#appButton?.configProvider;
        if (!configProvider) return;
        configProvider.setConfigOverride(this.#appButton.app, field, value);
        this.setItemActiveState(this.#resetAllItem);
    }

}

export class Menu extends AppMenu {

    /** @type {AppButton} */
    #appButton = null;

    /** @type {boolean} */
    #hasValidAppId = true;

    /** @type {SoundVolumeControlSection} */
    #soundVolumeControlSection = null;

    /** @type {Object.<string, boolean>} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(appButton.actor, St.Side.TOP, DefaultProps);
        this.#appButton = appButton;
        this.actor.remove_style_class_name(UNWANTED_STYLE_CLASS);
        this.actor.add_style_class_name(DEFAULT_STYLE_CLASS);
        this.setApp(appButton.app);
        this.#hasValidAppId = this._appSystem?.lookup_app(this._app?.id) ? true : false;
        this.#createSections();
        this._updateDetailsVisibility();
    }

    /**
     * Note: There is a bug in the AppMenu that leads to exceptions while destroying the menu.
     *       Set this._app as null to avoid the exceptions. 
     */
    destroy() {
        Context.signals.removeAll(this);
        this.close(false);
        this._app?.disconnectObject(this);
        this._app = null;
        this.#soundVolumeControlSection = null;
        super.destroy();
    }

    /**
     * @param {BoxPointer.PopupAnimation} animation
     */
    open(animation) {
        this.actor._arrowSide = MenuPosition[this.#appButton.location];
        this.#soundVolumeControlSection?.update();
        super.open(animation);
    }

    #createSections() {
        this.#soundVolumeControlSection = new SoundVolumeControlSection(this.#appButton);
        this.addMenuItem(this.#soundVolumeControlSection.actor);
        if (this.#hasValidAppId) this.addMenuItem(new CustomizeSection(this.#appButton));
        this.addMenuItem(new PopupSeparatorMenuItem());
        this.moveMenuItem(this._quitItem, this.numMenuItems);
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
            default: return;
        }
    }

    /**
     * @param {*} actor
     * @param {Clutter.Event} event
     * @returns {number}
     */
    _onKeyPress(actor, event) {
        const key = event?.get_key_symbol();
        if (key === Clutter.KEY_space ||
            key === Clutter.KEY_Return) return Clutter.EVENT_PROPAGATE;
        return super._onKeyPress(actor, event);
    }

    _updateFavoriteItem() {
        super._updateFavoriteItem();
        if (!this._toggleFavoriteItem?.visible) return;
        if (!this.#config.showFavorites) return this._toggleFavoriteItem.hide();
        const isFavorite = this._appFavorites?.isFavorite(this._app?.id);
        if (isFavorite) return;
        this._toggleFavoriteItem.label?.set_text(Labels.Pin);
    }

    _updateWindowsSection() {
        if (!this._app) return;
        if (!this.#config.isolateWorkspaces) return super._updateWindowsSection();
        const origin = this._app;
        const workspace = global.workspace_manager.get_active_workspace();
        this._app = {
            get_windows: () => origin.get_windows().filter(window => window.get_workspace() === workspace),
            get_name: () => origin.get_name()
        };
        super._updateWindowsSection();
        this._app = origin;
    }

    _updateDetailsVisibility() {
        if (this._app && this.#hasValidAppId) super._updateDetailsVisibility();
        else this._detailsItem.hide();
    }

}
