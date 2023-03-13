/* exported Menu */

/** @typedef {import('./appButton.js').AppButton} AppButton */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { AppMenu, Slider, Ornament } from '../../core/legacy.js';
import { PopupSubMenuMenuItem, PopupSeparatorMenuItem, PopupBaseMenuItem } from '../../core/legacy.js';
import { Context } from '../../core/context.js';
import { Event, Type } from '../../core/enums.js';
import { ComponentLocation } from '../base/component.js';
import { Config } from '../../utils/config.js';
import { ActivateBehavior, DemandsAttentionBehavior } from '../../utils/taskbar/appConfig.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { Labels } from '../../core/labels.js';

const UNWANTED_STYLE_CLASS = 'app-menu';
const DEFAULT_STYLE_CLASS = 'rocketbar__popup-menu';
const SECTION_TITLE_STYLE_CLASS = 'rocketbar__popup-menu_section-title';
const SLIDER_ICON_STYLE_CLASS = 'popup-menu-icon';
const INACTIVE_MENU_ITEM_STYLE_PSEUDO_CLASS = 'insensitive';

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
     */
    constructor(callback, icon) {
        this.#actor.setOrnament(Ornament.HIDDEN);
        this.#actor.add_child(this.#icon);
        this.#actor.add_child(this.#slider);
        this.#actor.add_child(this.#value);
        this.icon = icon;
        this.#actor.connect(Event.KeyPress, (_, event) => this.#slider.emit(Event.KeyPress, event));
        if (typeof callback !== Type.Function) return;
        this.#slider.connect(Event.ValueChanged, () => callback(this));
    }

}

class MenuSection {

    /** @type {PopupSubMenuMenuItem} */
    #actor = null;

    /** @type {Map<PopupBaseMenuItem, number>} */
    #hiddenMenuItems = null;

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
     * @param {boolean} [dominate]
     */
    constructor(title, dominate = false) {
        this.#actor = new PopupSubMenuMenuItem(title);
        this.#actor.connect(Event.Destroy, () => { this.#actor = null; });
        if (!dominate) return;
        this.menu?.connect(Event.OpenStateChanged, () => this.#handleState());
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
     * @param {string} [title]
     */
    addSeparator(title = null) {
        if (!this.#actor?.menu) return;
        const separator = new PopupSeparatorMenuItem(title);
        if (title) separator.add_style_class_name(SECTION_TITLE_STYLE_CLASS);
        this.#actor.menu.addMenuItem(separator);
    }

    /**
     * @param {Object.<string, string>} items
     * @param {(value: string, items: Object.<string, string>) => void} callback
     * @returns {(value: string) => void}
     */
    addCheckboxGroup(items, callback) {
        const menu = this.menu;
        const group = new Map();
        /** @param {string} value */
        const handler = value => {
            for (const [itemValue, item] of group) {
                if (itemValue === value) item.setOrnament(Ornament.DOT);
                else item.setOrnament(Ornament.NONE);
            }
            if (typeof callback === Type.Function) callback(value, items);
        };
        for (const value in items) group.set(value, menu.addAction(items[value], () => handler(value)));
        return handler;
    }

    #handleState() {
        if (!this.isOpen) {
            if (!this.#hiddenMenuItems?.size) return;
            const animationParams = { ...AnimationType.OpacityMax, ...{ mode: Clutter.AnimationMode.EASE_OUT_QUAD } };
            for (const [menuItem, height] of this.#hiddenMenuItems) {
                menuItem.show();
                if (height < 0) continue;
                Animation(menuItem, AnimationDuration.Faster, { ...animationParams, ...{ height } }).then(() => menuItem.set_size(-1, -1));
            }
            return this.#hiddenMenuItems.clear();
        }
        const parent = this.#actor?.get_parent();
        if (!parent) return;
        if (!this.#hiddenMenuItems) {
            this.#hiddenMenuItems = new Map();
        }
        const menuItems = parent.get_children();
        const animationParams = { ...AnimationType.HeightMin, ...{ mode: Clutter.AnimationMode.EASE_OUT_QUAD } };
        for (let i = 0, l = menuItems.length; i < l; ++i) {
            const menuItem = menuItems[i];
            if (menuItem === this.#actor) continue;
            if (menuItem instanceof St.ScrollView || !menuItem.visible) continue;           
            const menuItemHeight = menuItem instanceof PopupSeparatorMenuItem ? -1 : menuItem.height; 
            this.#hiddenMenuItems.set(menuItem, menuItemHeight);
            if (menuItemHeight < 0) {
                menuItem.hide();
                continue;
            }
            menuItem.set(AnimationType.OpacityMin);
            Animation(menuItem, AnimationDuration.Default, animationParams).then(() => menuItem.hide());
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

class CustomizeSection extends MenuSection {

    /** @type {AppButton} */
    #appButton = null;

    /** @type {SliderMenuItem} */
    #iconSizeSlider = new SliderMenuItem(menuItem => this.#setIconSize(menuItem));

    #activateBehavior = null;

    #demandsAttentionBehavior = null;

    /** @type {PopupMenuItem} */
    #importIconItem = null;

    /** @type {PopupMenuItem} */
    #resetIconItem = null;

    /** @type {PopupMenuItem} */
    #resetAllItem = null;

    /** @type {boolean} */
    #isSyncing = false;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(Labels.Customize, true);
        this.#appButton = appButton;
        this.#createItems();
        this.menu.itemActivated = () => {};
        this.menu.connect(Event.OpenStateChanged, () => this.#sync());
        this.actor.connect(Event.Destroy, () => this.#destroy());
    }

    #destroy() {
        this.#appButton = null;
    }

    #createItems() {
        const menu = this.menu;
        this.addSeparator(Labels.ActivateBehavior);
        this.#activateBehavior = this.addCheckboxGroup(ActivateBehaviorCheckboxGroup, (...args) => this.#setCheckboxValue(...args));
        this.addSeparator(Labels.DemandsAttentionBehavior);
        this.#demandsAttentionBehavior = this.addCheckboxGroup(DemandsAttentionBehaviorCheckboxGroup, (...args) => this.#setCheckboxValue(...args));
        this.addSeparator(Labels.IconSize);
        menu.addMenuItem(this.#iconSizeSlider.actor);
        this.addSeparator(Labels.CustomIcon);
        this.#importIconItem = menu.addAction(Labels.CopyIconToClipboard, () => this.#importIcon());
        this.#resetIconItem = menu.addAction(Labels.ResetToDefault, () => this.#resetIcon());
        this.addSeparator();
        this.#resetAllItem = menu.addAction(Labels.ResetAllToDefault, () => this.#resetAll());
    }

    #sync() {
        if (!this.isOpen) return;
        this.#isSyncing = true;
        this.setItemActiveState(this.#importIconItem, false);
        this.setItemActiveState(this.#resetAllItem, false);
        this.#resetIconItem.hide();
        this.#isSyncing = false;
    }

    #setIconSize(menuItem) {
        menuItem.value = menuItem.slider.value * 100;
        if (this.#isSyncing) return;
    }

    #setCheckboxValue(value, group) {
        if (this.#isSyncing) return;
    }

    #importIcon() {

    }

    #resetIcon() {

    }

    #resetAll() {

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
        if (this.#hasValidAppId) this.addMenuItem(new CustomizeSection(this.#appButton).actor);
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
