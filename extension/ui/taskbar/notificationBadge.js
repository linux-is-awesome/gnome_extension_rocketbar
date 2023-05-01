/* exported NotificationBadge */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { Config } from '../../utils/config.js';

const MODULE_NAME = 'Rocketbar__Taskbar_NotificationBadge';
const STYLE_CLASS = 'rocketbar__notification-badge';
const BORDER_SIZE = 1;
const FONT_SIZE_MIN = 0;
const LONG_VALUE_PADDING = 2;
const BLINK_DURATION = 2;

/** @enum {string} */
const BadgePosition = {
    TopLeft: 'top_left',
    TopRight: 'top_right',
    BottomLeft: 'bottom_left',
    BottomRight: 'bottom_right'
};

/** @enum {Object.<string, *>} */
const BadgeAnimation = {
    Show: { ...AnimationType.OpacityMax, ...AnimationType.ScaleMax },
    Hide: { ...AnimationType.OpacityMin, ...AnimationType.ScaleMin, mode: Clutter.AnimationMode.EASE_OUT_QUAD },
    Blink: { ...AnimationType.OpacityDown, mode: Clutter.AnimationMode.EASE_OUT_QUAD }
};

/** @enum {string} */
const ConfigFields = {
    color: 'notification-badge-color',
    fontColor: 'notification-badge-font-color',
    borderColor: 'notification-badge-border-color',
    position: 'notification-badge-position',
    size: 'notification-badge-size',
    margin: 'notification-badge-margin',
    roundness: 'notification-badge-roundness',
    maxCount: 'notification-badge-max-count'
};

/** @type {Object.<string, number|boolean|string>} */
const DefaultProps = {
    name: MODULE_NAME,
    style_class: STYLE_CLASS,
    x_expand: true,
    y_expand: true,
    visible: false,
    text: '0',
    ...AnimationType.OpacityMin,
    ...AnimationType.ScaleMin
};

export class NotificationBadge extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Scale]: this.#updateStyle
    })[data?.event]?.call(this);

    /**
     * @typedef {import('./appButton.js').AppButton} AppButton
     * @type {AppButton}
     */
    #appButton = null;

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, () => this.#updateStyle());

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.Label(DefaultProps));
        this.actor.set_pivot_point(0.5, 0.5);
        this.#appButton = appButton;
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
    }

    rerender() {
        if (!this.isValid) return;
        const count = this.#appButton.notificationsCount;
        const oldVisible = this.actor.visible;
        const visible = count > 0;
        if (!visible && !oldVisible) return;
        this.actor.remove_all_transitions();
        if (!visible) return Animation(this, AnimationDuration.Default, BadgeAnimation.Hide).then(() =>
                             this.setProps({ visible }));
        const { maxCount } = this.#config;
        const text = `${ count > maxCount ? maxCount : count }`;
        this.setProps({ text, visible }).#updateStyle();
        if (oldVisible === visible) return this.#blink();
        Animation(this, AnimationDuration.Fast, BadgeAnimation.Show);
    }

    #destroy() {
        this.#appButton = null;
    }

    async #blink() {
        let i = 0;
        while (i < BLINK_DURATION) {
            await Animation(this, AnimationDuration.Slower, BadgeAnimation.Blink).then(() =>
                  Animation(this, AnimationDuration.Slower, BadgeAnimation.Show));
            i++;
        }
    }

    #updateStyle() {
        if (!this.isValid) return;
        const actor = this.actor;
        if (!actor?.visible) return;
        const { color, fontColor, borderColor, margin, size, roundness, position } = this.#config;
        const scale = this.uiScale;
        const fontSize = Math.max(size - BORDER_SIZE * 2, FONT_SIZE_MIN) * scale;
        const padding = actor.text.length === 1 ? 0 : LONG_VALUE_PADDING * scale;
        const margins = (
            position === BadgePosition.TopLeft ?
            `margin-top: ${margin * scale}px; margin-left: ${margin * scale}px;` :
            position === BadgePosition.TopRight ?
            `margin-top: ${margin * scale}px; margin-right: ${margin * scale}px;` :
            position === BadgePosition.BottomLeft ?
            `margin-bottom: ${margin * scale}px; margin-left: ${margin * scale}px;` :
            position === BadgePosition.BottomRight ?
            `margin-bottom: ${margin * scale}px; margin-right: ${margin * scale}px;` : ''
        );
        actor.set_style(
            `background-color: ${color};` +
            `color: ${fontColor};` +
            `font-size: ${fontSize}px;` +
            `border-radius: ${roundness * scale}px;` +
            `height: ${size * scale}px;` +
            `min-width: ${size * scale}px;` +
            `border-color: ${borderColor};` +
            `border-width: ${BORDER_SIZE}px;` +
            `padding: 0 ${padding}px;` +
            `text-align: center; ${margins}`
        );
        this.#updateAlignment();
    }

    #updateAlignment() {
        const { position } = this.#config;
        const x_align = (
            position === BadgePosition.TopLeft || position === BadgePosition.BottomLeft ?
            Clutter.ActorAlign.START : Clutter.ActorAlign.END
        );
        const y_align = (
            position === BadgePosition.TopLeft || position === BadgePosition.TopRight ?
            Clutter.ActorAlign.START : Clutter.ActorAlign.END
        );
        this.setProps({ x_align, y_align });
    }

}
