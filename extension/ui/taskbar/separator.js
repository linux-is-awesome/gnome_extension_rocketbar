/* exported Separator */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Type } from '../../core/enums.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';
import { Config } from '../../utils/config.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Separator';
const BODY_COLOR = 'rgba(250, 250, 250, 0.5)';
const BODY_WIDTH = 2;

/** @enum {string} */
const ConfigFields = {
    iconSize: 'appbutton-icon-size',
    iconHPadding: 'appbutton-icon-padding',
    spacingAfter: 'appbutton-spacing'
};

/** @type {Object.<string, boolean|number|string>} */
const DefaultProps = {
    name: MODULE_NAME,
    width: 0,
    opacity: AnimationType.OpacityMin.opacity
};

/** @type {Object.<string, boolean|number|string>} */
const BodyProps = {
    name: `${MODULE_NAME}-Body`,
    y_align: Clutter.ActorAlign.CENTER,
    x_align: Clutter.ActorAlign.CENTER
};

export class Separator extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Scale]: this.#updateStyle,
        [ComponentEvent.Mapped]: () => this.#updateStyle() ?? this.#handleState()
    })[data?.event]?.call(this);

    /** @type {boolean} */
    #isToggled = false;

    /** @type {boolean} */
    #isVisible = false;

    /** @type {St.Widget} */
    #body = new St.Widget(BodyProps);

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, () => this.#updateStyle());

    /** @type {number} */
    get #width() {
        const { iconSize, iconHPadding } = this.#config;
        return Math.max((iconSize + iconHPadding * 2) / 2, BODY_WIDTH);
    }

    /**
     * Note: Using Math.round to match css width.
     * 
     * @type {Meta.Rectangle}
     */
    get rect() {
        if (!this.isValid) return null;
        const result = super.rect;
        const { spacingAfter } = this.#config;
        result.width = Math.round((this.#width + spacingAfter) * this.uiScale * this.globalScale);
        return result;
    }

    /**
     * Note: This property forces Separator to be shown or hidden.
     * 
     * @param {boolean} value
     */
    set isVisible(value) {
        if (typeof value !== Type.Boolean) return;
        this.#isToggled = false;
        if (value === this.#isVisible) return;
        this.#isVisible = value;
        this.#handleState();
    }

    constructor() {
        super(new St.Bin(DefaultProps));
        this.actor.set_child(this.#body);
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
    }

    /**
     * Note: Unlike isVisible property, this function should be called to show Separator temporary
     *       and then called again to restore previous visibility state.
     */
    toggle() {
        if (this.#isVisible && !this.#isToggled) return;
        this.isVisible = !this.#isVisible;
        this.#isToggled = true;
    }

    #destroy() {
        this.#body = null;
    }

    #updateStyle() {
        if (!this.isValid) return;
        const { iconSize, spacingAfter } = this.#config;
        const scale = this.uiScale;
        this.actor.set_style(
            `width: ${this.#width * scale}px;` +
            `padding-right: ${spacingAfter * scale}px;`
        );
        this.#body.set_style(
            `height: ${iconSize * scale}px;` +
            `width: ${BODY_WIDTH * scale}px;` +
            `border-radius: ${BODY_WIDTH * scale}px;` +
            `background-color: ${BODY_COLOR};`
        );
    }

    #handleState() {
        if (!this.isMapped) return;
        const opacity = this.actor?.opacity ?? 0;
        if (this.#isVisible && opacity === AnimationType.OpacityMax.opacity) return;
        if (!this.#isVisible && opacity === AnimationType.OpacityMin.opacity) return;
        this.actor.remove_all_transitions();
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        if (!this.#isVisible) return Animation(this, AnimationDuration.Slow, { ...DefaultProps, mode });
        const width = this.rect.width;
        Animation(this, AnimationDuration.Default, { ...AnimationType.OpacityMax, width, mode }).then(() => this.setSize());;
    }

}
