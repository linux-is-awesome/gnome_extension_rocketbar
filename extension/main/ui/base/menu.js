/**
 * @typedef {import('resource:///org/gnome/shell/ui/slider.js').Slider} Slider
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupBaseMenuItem} PopupBaseMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSubMenu} PopupSubMenu
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSubMenuMenuItem} PopupSubMenuMenuItem
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Slider } from 'resource:///org/gnome/shell/ui/slider.js';
import { Ornament,
         PopupSubMenuMenuItem,
         PopupBaseMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Icon } from './icon.js';
import { Event } from '../../../shared/enums/general.js';

const SLIDER_ICON_STYLE_CLASS = 'popup-menu-icon';

/** @type {{[prop: string]: *}} */
const SliderMenuItemProps = {
    activate: false
};

/** @type {{[prop: string]: *}} */
const SliderIconProps = {
    style_class: SLIDER_ICON_STYLE_CLASS
};

/** @type {{[prop: string]: *}} */
const SliderValueProps = {
    visible: false,
    y_expand: true,
    y_align: Clutter.ActorAlign.CENTER
};

export class SliderMenuItem {

    /** @type {PopupBaseMenuItem?} */
    #actor = null;

    /** @type {Slider?} */
    #slider = null;

    /** @type {Icon?} */
    #icon = null;

    /** @type {St.Label?} */
    #value = null;

    /** @type {PopupBaseMenuItem} */
    get actor() {
        if (!this.#actor) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#actor;
    }

    /** @type {Slider} */
    get slider() {
        if (!this.#slider) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#slider;
    }

    /** @param {string?} value */
    set icon(value) {
        if (!this.#icon) return;
        this.#icon.iconPath = value || null;
    }

    /** @param {number?} value */
    set value(value) {
        if (!this.#value) return;
        const text = typeof value === 'number' ? Math.round(value).toString() : null;
        this.#value.set_text(text);
        this.#value.visible = !!text;
    }

    /**
     * @param {(menuItem: SliderMenuItem, isClick: boolean) => void} callback
     * @param {string?} [icon]
     * @param {number?} [value]
     */
    constructor(callback, icon, value) {
        this.#actor = new PopupBaseMenuItem(SliderMenuItemProps);
        /** @type {*} */
        const defaultValue = 0;
        this.#slider = new Slider(defaultValue);
        this.#value = new St.Label(SliderValueProps);
        this.#icon = new Icon(icon);
        this.#icon.setProps(SliderIconProps);
        const iconButton = new St.Button();
        iconButton.set_child(this.#icon.actor);
        this.#actor.add_child(iconButton);
        this.#actor.add_child(this.#slider);
        this.#actor.add_child(this.#value);
        this.#actor.setOrnament(Ornament.HIDDEN);
        this.#actor.connect(Event.Destroy, () => this.#destroy());
        this.#actor.connect(Event.KeyPress, (_, event) => this.#slider?.emit(Event.KeyPress, event));
        this.value = value ?? null;
        if (typeof callback !== 'function') return;
        this.#slider.connect(Event.ValueChanged, () => callback(this, false));
        iconButton.connect(Event.Clicked, () => callback(this, true));
    }

    #destroy() {
        this.#actor = null;
        this.#slider = null;
        this.#icon = null;
        this.#value = null;
    }

}

export class CollapsibleGroup {

    /** @type {PopupSubMenuMenuItem?} */
    #actor = null;

    /** @type {PopupSubMenuMenuItem} */
    get actor() {
        if (!this.#actor) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#actor;
    }

    /** @type {PopupSubMenu} */
    get menu() {
        const menu = this.#actor?.menu;
        if (!menu) throw new Error(`${this.constructor.name} is invalid.`);
        return menu;
    }

    /** @type {boolean} */
    get isOpen() {
        return this.#actor?.menu?.isOpen ?? false;
    }

    /** @param {string} value */
    set title(value) {
        if (!this.#actor?.label) return;
        this.#actor.label.text = value;
    }

    /** @param {boolean} value */
    set visible(value) {
        if (!this.#actor || typeof value !== 'boolean') return;
        this.#actor.visible = value;
    }

    /**
     * @param {string?} [title]
     */
    constructor(title) {
        /** @type {*} */
        const params = title;
        this.#actor = new PopupSubMenuMenuItem(params);
        this.#actor.connect(Event.Destroy, () => this.#destroy());
    }

    #destroy() {
        this.#actor = null;
    }

}
