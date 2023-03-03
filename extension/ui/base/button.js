/* exported ButtonEvent, Button */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Context } from '../../core/context.js';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';
import { Property } from '../../core/enums.js';
import { LongPressAction } from './longPressAction.js'; 
import { Gradient } from '../../utils/gradient.js';

const DEFAULT_STYLE_CLASS = 'panel-button rocketbar__button';

/** @enum {string} */
const PseudoClass = {
    Focus: 'focus',
    Active: 'active'
};

/** @enum {string} */
const CssField = {
    MarginLeft: 'margin-left',
    MarginRight: 'margin-right',
    PaddingLeft: 'padding-left',
    PaddingRight: 'padding-right',
    BorderRadius: 'border-radius',
    Height: 'height',
    Width: 'width',
    BackgroundGradient: 'background-gradient'
};

/** @type {Object.<string, boolean|number|string>} */
const DefaultProps = {
    reactive: true,
    can_focus: true,
    button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
    style_class: DEFAULT_STYLE_CLASS
};

/** @type {Object.<string, number|string>} */
const DefaultStyle = {
    spacingBefore: 0,
    spacingAfter: 1,
    width: 0,
    height: 0,
    roundness: 99,
    backlightColor: '',
    backlightIntensity: 0,
    backlightRatio: 1
};

/** @enum {string} */
export const ButtonEvent = {
    Click: 'button::click',
    Press: 'button::press',
    LongPress: 'button::long-press',
    Focus: 'button:focus',
    RequestMenu: 'button:request-menu'
};

class DummyEventEmitter {
    connectObject(){}
    disconnectObject(){}
}

class ButtonMenuTrigger extends DummyEventEmitter {

    /** @type {Button} */
    #button = null;

    /** @type {DummyEventEmitter} */
    #actor = new DummyEventEmitter();

    /** @type {Button} */
    get sourceActor() {
        return this.#button.actor;
    }

    /** @type {DummyEventEmitter} */
    get actor() {
        return this.#actor;
    }

    /**
     * @param {Button} button
     */
    constructor(button) {
        super();
        this.#button = button;
        Context.layout.addMenu(this);
    }

    /**
     * @param {BoxPointer.PopupAnimation} animation
     */
    open(animation) {
        const menu = this.#button?.notifySelf(ButtonEvent.RequestMenu);
        if (!menu || typeof menu.open !== Type.Function) return;
        this.#button.menu = menu;
        if (animation) menu.open(animation);
        else menu.toggle();
    }

    destroy() {
        if (!this.#actor) return;
        Context.layout.removeMenu(this);
        this.#button = null;
        this.#actor = null;
    }

}

export class Button extends Component {

    /** @type {St.Widget} */
    #display = this;

    /** @type {boolean} */
    #isActive = false;

    /** @type {Map<string, string>} */
    #css = null;

    /** @type {LongPressAction} */
    #longPressAction = new LongPressAction(this, () => this.#longPress());

    /** @type {ButtonMenuTrigger} */
    #menuTrigger = new ButtonMenuTrigger(this);

    /** @type {PopupMenu.PopupMenu} */
    #menu = null;

    /** @type {St.Widget} */
    get display() {
        return this.#display;
    }

    /** @type {PopupMenu.PopupMenu} */
    get menu() {
        return this.#menu;
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

    /** @param {PopupMenu.PopupMenu} menu */
    set menu(menu) {
        if (this.#menu || !menu ||
            typeof menu.open !== Type.Function ||
            typeof menu.connect !== Type.Function) return;
        this.#menuTrigger?.destroy();
        this.#menuTrigger = null;
        this.#menu = menu;
        this.#menu.connect(Event.OpenStateChanged, () => this.#focus());
        Context.layout.addMenu(this.#menu);
    }

    /**
     * @param {St.Widget} [display]
     * @param {string} [name]
     */
    constructor(display, name = null) {
        super(new St.Button({ name, ...DefaultProps }));
        this.connect(Event.Destroy, () => this.#destroy());
        this.connect(Event.Pressed, () => this.#press());
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
        if (!this.isValid) return this;
        const actor = this.actor;
        const scale = this.uiScale;
        const css = new Map();
        const { spacingBefore, spacingAfter, roundness, height, width,
                backlightColor, backlightIntensity, backlightRatio = DefaultStyle.backlightRatio } = style;
        if (this.#display === actor) {
            if (typeof spacingBefore === Type.Number) css.set(CssField.MarginLeft, `${CssField.MarginLeft}:${spacingBefore * scale}px;`);
            if (typeof spacingAfter === Type.Number) css.set(CssField.MarginRight, `${CssField.MarginRight}:${spacingAfter * scale}px;`);
        } else {
            const css = [];
            if (typeof spacingBefore === Type.Number) css.push(`${CssField.PaddingLeft}:${spacingBefore * scale}px;`);
            if (typeof spacingAfter === Type.Number) css.push(`${CssField.PaddingRight}:${spacingAfter * scale}px;`);
            if (css.length) actor.set_style(css.join(''));
        }
        if (typeof roundness === Type.Number) css.set(CssField.BorderRadius, `${CssField.BorderRadius}:${roundness * scale}px;`);
        if (typeof height === Type.Number && height > 0) {
            this.#display.set({ y_expand: false });
            css.set(CssField.Height, `${CssField.Height}:${height * scale}px;`);
        } else if (height === 0) {
            this.#display.set({ y_expand: true });
            this.#css?.delete(CssField.Height);
        }
        if (typeof width === Type.Number && width > 0) {
            this.#display.set({ x_expand: false });
            css.set(CssField.Width, `${CssField.Width}:${width * scale}px;`);
        } else if (width === 0) {
            this.#display.set({ x_expand: true });
            this.#css?.delete(CssField.Width);
        }
        if (typeof backlightColor === Type.String &&
            typeof backlightIntensity === Type.Number && backlightIntensity > 0) {
            css.set(CssField.BackgroundGradient, Gradient(backlightColor, backlightIntensity, backlightRatio));
        } else if (backlightIntensity === 0) {
            this.#css?.delete(CssField.BackgroundGradient);
        }
        this.#css = this.#css ? new Map([...this.#css, ...css]) : css;
        this.#display.set_style([...this.#css.values()].join(''));
        return this;
    }

    #destroy() {
        this.#longPressAction?.destroy();
        this.#longPressAction = null;
        this.#menuTrigger?.destroy();
        this.#menuTrigger = null;
        this.#menu?.destroy();
        this.#menu = null;
        this.#css = null;
        this.#display = null;
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

    #press() {
        const actor = this.actor;
        if (!actor.pressed) actor.fake_release();
        this.notifySelf(ButtonEvent.Press);
    }

    #longPress() {
        if (this.cancelDragEvents().notifySelf(ButtonEvent.LongPress)) return;
        this.#openMenu();
    }

    #click() {
        const event = Clutter.get_current_event();
        if (!event) return;
        const button = event.type() === Clutter.EventType.BUTTON_RELEASE ? event.get_button() : null;
        if (this.notifySelf(ButtonEvent.Click, { event, button })) return;
        this.#openMenu();
    }

    #focus() {
        if (this.actor.has_key_focus() || this.#menu?.isOpen) this.#display.add_style_pseudo_class(PseudoClass.Focus);
        else this.#display.remove_style_pseudo_class(PseudoClass.Focus);
        this.notifySelf(ButtonEvent.Focus);
    }

    #openMenu() {
        if (this.#menu) this.#menu.toggle();
        else this.#menuTrigger?.open();
    }

}
