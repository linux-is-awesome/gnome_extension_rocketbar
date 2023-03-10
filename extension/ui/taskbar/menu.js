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
import { Labels } from '../../core/labels.js';

const UNWANTED_STYLE_CLASS = 'app-menu';
const DEFAULT_STYLE_CLASS = 'rocketbar__popup-menu';
const SLIDER_ICON_STYLE_CLASS = 'popup-menu-icon';

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
     * @param {(sender: SliderMenuItem) => void} callback
     * @param {string} icon
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
     * @param {string} title
     */
    constructor(title) {
        this.#actor = new PopupSubMenuMenuItem(title);
    }

}

class SoundVolumeControlSection extends MenuSection {

    /** @type {AppButton} */
    #appButton = null;

    /** @type {SliderMenuItem} */
    #inputVolumeSlider = new SliderMenuItem(sender => this.#setVolume(sender), SoundVolumeIcon.Input);

    /** @type {SliderMenuItem} */
    #outputVolumeSlider = new SliderMenuItem(sender => this.#setVolume(sender), SoundVolumeIcon.Output);

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
     * @param {SliderMenuItem} sender
     */
    #setVolume(sender) {
        if (this.#isSyncing) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const slider = sender?.slider;
        if (!slider) return;
        if (sender === this.#inputVolumeSlider) {
            soundVolumeControl.inputVolume = slider.value;
        } else if (sender === this.#outputVolumeSlider) {
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
