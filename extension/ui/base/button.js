/**
 * JSDoc types
 *
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenu & { connect: (...args) => void}} PopupMenu
 * @typedef {import('resource:///org/gnome/shell/ui/boxpointer.js').PopupAnimation} BoxPointer.PopupAnimation
 */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Context from '../../core/context.js';
import { DummyEventEmitter } from '../../core/shell.js';
import { Component, ComponentLocation } from './component.js';
import { LongPressAction } from './longPressAction.js';
import { Event, Property, PseudoClass } from '../../core/enums.js';
import { Animation, AnimationType, AnimationDuration } from './animation.js';
import { Gradient } from '../../utils/gradient.js';

const STYLE_CLASS = 'panel-button rocketbar__button';

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    reactive: true,
    can_focus: true,
    button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
    style_class: STYLE_CLASS
};

/** @type {{[prop: string]: *}} */
const DisplayProps = {
    y_expand: true,
    x_expand: true,
    style_class: STYLE_CLASS
};

/** @type {{[prop: string]: *}} */
const RuntimeButtonProps = {
    width: 0,
    ...AnimationType.OpacityMin
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

/** @enum {number|string} */
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
    Focus: 'button::focus',
    RequestMenu: 'button::request-menu'
};

class ButtonMenuTrigger extends DummyEventEmitter {

    /** @type {Button?} */
    #button = null;

    /** @type {DummyEventEmitter?} */
    #actor = new DummyEventEmitter();

    /**
     * @override
     * @type {St.Button?}
     */
    get sourceActor() {
        return this.#button?.actor ?? null;
    }

    /**
     * @override
     * @type {DummyEventEmitter?}
     */
    get actor() {
        return this.#actor;
    }

    /**
     * @param {Button} button
     */
    constructor(button) {
        super();
        this.#button = button;
        Context.signals.add(this, [this.#button.actor, Event.KeyPress, (_, event) => this.#keyPress(event)]);
        Context.layout.addMenu(this);
    }

    /**
     * @override
     * @param {BoxPointer.PopupAnimation} [animation]
     * @returns {PopupMenu?}
     */
    open(animation) {
        if (!this.#button) return null;
        const menu = this.#button?.notifySelf(ButtonEvent.RequestMenu);
        if (!this.isValidMenu(menu)) return null;
        this.#button.menu = menu;
        if (animation) menu.open(animation);
        else menu.toggle();
        return menu;
    }

    /**
     * @override
     */
    destroy() {
        if (!this.#actor) return;
        Context.signals.removeAll(this);
        Context.layout.removeMenu(this);
        this.#button = null;
        this.#actor = null;
    }

    /**
     * @param {*} menu
     * @returns {boolean}
     */
    isValidMenu(menu) {
        return menu && typeof menu.open === 'function' &&
                       typeof menu.toggle === 'function' &&
                       typeof menu.connect === 'function';
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #keyPress(event) {
        let state = event.get_state();
        state &= ~Clutter.ModifierType.LOCK_MASK;
        state &= ~Clutter.ModifierType.MOD2_MASK;
        state &= Clutter.ModifierType.MODIFIER_MASK;
        if (state) return Clutter.EVENT_PROPAGATE;
        const key = this.#button?.location === ComponentLocation.Top ? Clutter.KEY_Down : Clutter.KEY_Up;
        if (event.get_key_symbol() !== key) return Clutter.EVENT_PROPAGATE;
        const menu = this.open();
        if (!menu) return Clutter.EVENT_PROPAGATE;
        if (typeof menu.actor?.navigate_focus === 'function') {
            menu.actor.navigate_focus(null, St.DirectionType.TAB_FORWARD, false);
        }
        return Clutter.EVENT_STOP;
    }

}

/**
 * @template {St.Widget} ButtonDisplay
 * @augments Component<St.Button>
 */
export class Button extends Component {

    /** @type {ButtonDisplay|St.Button?} */
    #display = this.actor;

    /** @type {boolean} */
    #isActive = false;

    /** @type {boolean} */
    #hasFocus = false;

    /** @type {Map<string, string>?} */
    #css = null;

    /** @type {LongPressAction?} */
    #longPressAction = new LongPressAction(this, event => this.#longPress(event));

    /** @type {ButtonMenuTrigger?} */
    #menuTrigger = new ButtonMenuTrigger(this);

    /** @type {PopupMenu?} */
    #menu = null;

    /** @type {ButtonDisplay|St.Button} */
    get display() {
        return this.#display ?? this.actor;
    }

    /** @type {PopupMenu?} */
    get menu() {
        return this.#menu;
    }

    /** @type {boolean} */
    get isActive() {
        return this.#isActive;
    }

    /** @type {boolean} */
    get hasFocus() {
        return this.#hasFocus;
    }

    /** @param {boolean} value */
    set isActive(value) {
        if (!this.#display || this.#isActive === value) return;
        this.#isActive = value;
        if (this.#isActive) this.#display.add_style_pseudo_class(PseudoClass.Active);
        else this.#display.remove_style_pseudo_class(PseudoClass.Active);
    }

    /** @param {PopupMenu} menu */
    set menu(menu) {
        if (this.#menu || !this.#menuTrigger?.isValidMenu(menu)) return;
        this.#menuTrigger?.destroy();
        this.#menuTrigger = null;
        this.#menu = menu;
        this.#menu.connect(Event.OpenStateChanged, () => this.#focus());
        Context.layout.addMenu(this.#menu);
    }

    /**
     * @param {ButtonDisplay?} [display]
     * @param {string?} [name]
     */
    constructor(display, name = null) {
        super(new St.Button({ name, ...DefaultProps }));
        this.connect(Event.Destroy, () => this.#destroy());
        this.connect(Event.Pressed, () => this.#press());
        this.connect(Event.Clicked, () => this.#click());
        this.connect(Event.FocusIn, () => this.#focus());
        this.connect(Event.FocusOut, () => this.#focus());
        if (display) this.#setDisplay(display, name);
    }

    /**
     * @param {{[prop: string]: string|number}} [style]
     * @returns {this}
     */
    overrideStyle(style = DefaultStyle) {
        if (!this.#display) return this;
        const actor = this.actor;
        const scale = this.uiScale;
        const css = new Map();
        const { spacingBefore, spacingAfter, roundness, height, width,
                backlightColor, backlightIntensity, backlightRatio = DefaultStyle.backlightRatio } = style;
        if (this.#display === actor) {
            if (typeof spacingBefore === 'number') css.set(CssField.MarginLeft, `${CssField.MarginLeft}:${spacingBefore * scale}px;`);
            if (typeof spacingAfter === 'number') css.set(CssField.MarginRight, `${CssField.MarginRight}:${spacingAfter * scale}px;`);
        } else {
            const actorCss = [];
            if (typeof spacingBefore === 'number') actorCss.push(`${CssField.PaddingLeft}:${spacingBefore * scale}px;`);
            if (typeof spacingAfter === 'number') actorCss.push(`${CssField.PaddingRight}:${spacingAfter * scale}px;`);
            if (actorCss.length) actor.set_style(actorCss.join(''));
        }
        if (typeof roundness === 'number') css.set(CssField.BorderRadius, `${CssField.BorderRadius}:${roundness * scale}px;`);
        if (typeof height === 'number' && height > 0) {
            this.#display.set({ y_expand: false });
            css.set(CssField.Height, `${CssField.Height}:${height * scale}px;`);
        } else if (height === 0) {
            this.#display.set({ y_expand: true });
            this.#css?.delete(CssField.Height);
        }
        if (typeof width === 'number' && width > 0) {
            this.#display.set({ x_expand: false });
            css.set(CssField.Width, `${CssField.Width}:${width * scale}px;`);
        } else if (width === 0) {
            this.#display.set({ x_expand: true });
            this.#css?.delete(CssField.Width);
        }
        if (typeof backlightColor === 'string' &&
            typeof backlightIntensity === 'number' &&
            typeof backlightRatio === 'number' && backlightIntensity > 0) {
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
     * @param {ButtonDisplay} display
     * @param {string?} [name]
     */
    #setDisplay(display, name) {
        if (display instanceof St.Widget === false) return;
        this.#display = display;
        this.#display.set(DisplayProps);
        this.actor.set_style_class_name(null);
        this.actor.bind_property(Property.Hover, this.#display, Property.Hover, GObject.BindingFlags.SYNC_CREATE);
        if (typeof name !== 'string') return;
        this.#display.set({ name: `${name}-Display` });
    }

    #press() {
        const actor = this.actor;
        if (!actor.pressed) actor.fake_release();
        this.notifySelf(ButtonEvent.Press);
    }

    /**
     * @param {Clutter.Event} event
     */
    #longPress(event) {
        if (this.cancelDragEvents().notifySelf(ButtonEvent.LongPress, { event })) return;
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
        if (!this.#display) return;
        this.#hasFocus = this.actor.has_key_focus() || this.#menu?.isOpen || false;
        if (this.#hasFocus) this.#display.add_style_pseudo_class(PseudoClass.Focus);
        else this.#display.remove_style_pseudo_class(PseudoClass.Focus);
        this.notifySelf(ButtonEvent.Focus);
    }

    #openMenu() {
        if (this.#menu) this.#menu.toggle();
        else this.#menuTrigger?.open();
    }

}

/**
 * @template {St.Widget} ButtonDisplay
 * @augments Button<ButtonDisplay>
 */
export class RuntimeButton extends Button {

    /** @type {boolean} */
    get isFadeInDone() {
        return this.actor.opacity === AnimationType.OpacityMax.opacity;
    }

    /**
     * @param {ButtonDisplay?} [display]
     * @param {string?} [name]
     */
    constructor(display, name = null) {
        super(display, name);
        this.setProps(RuntimeButtonProps);
    }

    /**
     * @param {number} width
     * @param {number} [opacity]
     * @returns {Promise<boolean>?}
     */
    fadeIn(width, opacity = AnimationType.OpacityMax.opacity) {
        if (!width || this.isFadeInDone) return null;
        const animationParams = { opacity, width, mode: Clutter.AnimationMode.EASE_OUT_QUAD };
        return Animation(this, AnimationDuration.Default, animationParams).then(isShown => {
            if (isShown) this.setSize();
            return isShown;
        });
    }

    /**
     * @returns {Promise<boolean>}
     */
    fadeOut() {
        const animationParams = { ...RuntimeButtonProps, mode: Clutter.AnimationMode.EASE_OUT_QUAD };
        return Animation(this, AnimationDuration.Slow, animationParams);
    }

}
