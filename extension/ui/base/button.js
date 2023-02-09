/* exported Button */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';
import { Property } from '../../core/enums.js';

const DEFAULT_STYLE_CLASS = 'panel-button rocketbar__button';
const CSS_JOIN_SEPARATOR = ' ';

/** @enum {string} */
const PseudoClass = {
    Focus: 'focus',
    Active: 'active'
};

/** @enum {string} */
const CssFields = {
    MarginLeft: 'margin-left',
    MarginRight: 'margin-right',
    BorderRadius: 'border-radius',
    Height: 'height',
    Width: 'width'
}

/** @type {Object.<string, boolean|number|string>} */
const DefaultProps = {
    reactive: true,
    can_focus: true,
    button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
    style_class: DEFAULT_STYLE_CLASS
};

/** @type {Object.<string, number>} */
const DefaultStyle = {
    spacingBefore: 0,
    spacingAfter: 1,
    width: 0,
    height: 0,
    roundness: 99,
    backlight: null,
    backlightIntensity: 0
};

/** @enum {string} */
export const ButtonEvent = {
    Click: 'click',
    Focus: 'focus'
};

export class Button extends Component {

    /** @type {St.Widget} */
    #display = this;

    /** @type {boolean} */
    #isActive = false;

    /** @type {Map<string, string>} */
    #css = null;

    /** @type {DefaultStyle} */
    #style = DefaultStyle;

    /** @type {St.Widget} */
    get display() {
        return this.#display;
    }

    /** @type {boolean} */
    get isActive() {
        return this.#isActive;
    }

    /** @param {boolean} value */
    set isActive(value) {
        if (this.#isActive === value) return;
        this.#isActive = value;
        if (this.#isActive) this.#display.add_style_pseudo_class(PseudoClass.Active);
        else this.#display.remove_style_pseudo_class(PseudoClass.Active);
    }

    /**
     * @param {St.Widget} [display]
     * @param {string} [name]
     */
    constructor(display, name = null) {
        super(new St.Button({ name, ...DefaultProps }));
        this.connect(Event.Clicked, () => this.#click());
        this.connect(Event.FocusIn, () => this.#focus());
        this.connect(Event.FocusOut, () => this.#focus());
        this.#setDisplay(display, name);
    }

    /**
     * @param {DefaultStyle} [style]
     * @returns {this}
     */
    overrideStyle(style = DefaultStyle) {
        if (style) this.#style = { ...this.#style, ...style };
        else style = this.#style;
        const css = new Map();
        if (typeof style.spacingBefore === Type.Number) css.set(CssFields.MarginLeft, `${CssFields.MarginLeft}: ${style.spacingBefore}px;`);
        if (typeof style.spacingAfter === Type.Number) css.set(CssFields.MarginRight, `${CssFields.MarginRight}: ${style.spacingAfter}px;`);
        if (this.#display !== this.actor && css.size) {
            this.actor.style = [...css.values()].join(CSS_JOIN_SEPARATOR);
            css.clear();
        }
        if (typeof style.roundness === Type.Number) css.set(CssFields.BorderRadius, `${CssFields.BorderRadius}: ${style.roundness}px;`);
        if (typeof style.height === Type.Number && style.height > 0) {
            this.#display.set({ y_expand: false });
            css.set(CssFields.Height, `${CssFields.Height}: ${style.height}px;`);
        } else if (style.height === 0) {
            this.#display.set({ y_expand: true });
            this.#css?.delete(CssFields.Height);
        }
        if (typeof style.width === Type.Number && style.width > 0) {
            this.#display.set({ x_expand: false });
            css.set(CssFields.Width, `${CssFields.Width}: ${style.width}px;`);
        } else if (style.width === 0) {
            this.#display.set({ x_expand: true });
            this.#css?.delete(CssFields.Width);
        }
        this.#css = this.#css ? new Map([...this.#css, ...css]) : css;
        this.#display.style = [...this.#css.values()].join(CSS_JOIN_SEPARATOR);
        return this;
    }

    /**
     * @param {St.Widget} display
     * @param {string} [name]
     */
    #setDisplay(display, name) {
        if (display instanceof St.Widget === false) return;
        this.#display = display;
        this.#display.set({ style_class: DEFAULT_STYLE_CLASS, y_expand: true, x_expand: true });
        this.actor.set_style_class_name(null);
        this.actor.bind_property(Property.Hover, this.#display, Property.Hover, GObject.BindingFlags.SYNC_CREATE);
        if (typeof name !== Type.String) return;
        this.#display.set({ name: `${name}.Display` });
    }

    #click() {
        const event = Clutter.get_current_event();
        if (!event) return;
        const button = event.type() === Clutter.EventType.BUTTON_RELEASE ? event.get_button() : null;
        this.notifySelf(ButtonEvent.Click, { event, button });
    }

    #focus() {
        if (this.actor.has_key_focus()) this.#display.add_style_pseudo_class(PseudoClass.Focus);
        else this.#display.remove_style_pseudo_class(PseudoClass.Focus);
        this.notifySelf(ButtonEvent.Focus);
    }

}
