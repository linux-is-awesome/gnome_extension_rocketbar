/**
 * JSDoc types
 *
 * @typedef {import('./appButton.js').AppButton} AppButton
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Context from '../../core/context.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { Config } from '../../utils/config.js';

const MODULE_NAME = 'Rocketbar__Taskbar_NotificationBadge';
const CONFIG_PATH = 'taskbar';
const STYLE_CLASS = 'rocketbar__notification-badge';
const DEFAULT_TEXT = '0';
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

/** @enum {{[animation: string]: *}} */
const BadgeAnimation = {
    Show: { ...AnimationType.OpacityMax, ...AnimationType.ScaleNormal },
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

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    name: MODULE_NAME,
    x_expand: true,
    y_expand: true
};

/** @type {{[prop: string]: *}} */
const BadgeProps = {
    name: `${MODULE_NAME}-Badge`,
    style_class: STYLE_CLASS,
    x_expand: false,
    y_expand: false,
    visible: false,
    text: DEFAULT_TEXT,
    ...AnimationType.OpacityMin,
    ...AnimationType.ScaleMin
};

/**
 * @augments Component<St.Bin>
 */
export class NotificationBadge extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [ComponentEvent.Scale]: () => this.#updateStyle()
    };

    /** @type {St.Label?} */
    #badge = new St.Label(BadgeProps);

    /** @type {Config} */
    #config = Config(this, ConfigFields, () => this.#updateStyle(), { path: CONFIG_PATH });

    /** @type {AppButton?} */
    #appButton = null;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.Bin(DefaultProps));
        this.actor.set_child(this.#badge);
        this.#badge?.set_pivot_point(0.5, 0.5);
        this.#appButton = appButton;
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.());
    }

    /**
     * @returns {Promise<void>}
     */
    async rerender() {
        if (!this.isValid || !this.#badge || !this.#appButton) return;
        const count = this.#appButton.notificationsCount;
        const oldVisible = this.#badge.visible;
        const visible = count > 0;
        if (!visible && !oldVisible) return;
        this.#badge.remove_all_transitions();
        if (!visible) {
            const isHidden = await Animation(this.#badge, AnimationDuration.Default, BadgeAnimation.Hide);
            if (isHidden) this.#badge?.set({ visible });
            return;
        }
        const { maxCount } = this.#config;
        const text = `${count > maxCount ? maxCount : count}`;
        this.#badge.set({ text, visible });
        this.#updateStyle();
        if (oldVisible === visible) return this.#blink();
        await Animation(this.#badge, AnimationDuration.Fast, BadgeAnimation.Show);
    }

    #destroy() {
        Context.signals.removeAll(this);
        this.#badge?.remove_all_transitions();
        this.#badge = null;
        this.#appButton = null;
        this.#events = null;
    }

    /**
     * @param {number} [duration]
     * @returns {Promise<void>}
     */
    async #blink(duration = 0) {
        if (!this.#badge || duration >= BLINK_DURATION) return;
        if (!await Animation(this.#badge, AnimationDuration.Slower, BadgeAnimation.Blink)) return;
        if (!await Animation(this.#badge, AnimationDuration.Slower, BadgeAnimation.Show)) return;
        return this.#blink(++duration);
    }

    #updateStyle() {
        if (!this.isValid || !this.#badge?.visible) return;
        const { color, fontColor, borderColor, margin, size, roundness, position } = this.#config;
        const scale = this.uiScale;
        const fontSize = Math.max(size - BORDER_SIZE * 2, FONT_SIZE_MIN) * scale;
        const padding = this.#badge?.text?.length === 1 ? 0 : LONG_VALUE_PADDING * scale;
        const margins =
            position === BadgePosition.TopLeft ?
            `margin-top: ${margin * scale}px; margin-left: ${margin * scale}px;` :
            position === BadgePosition.TopRight ?
            `margin-top: ${margin * scale}px; margin-right: ${margin * scale}px;` :
            position === BadgePosition.BottomLeft ?
            `margin-bottom: ${margin * scale}px; margin-left: ${margin * scale}px;` :
            position === BadgePosition.BottomRight ?
            `margin-bottom: ${margin * scale}px; margin-right: ${margin * scale}px;` : '';
        this.#badge.set_style(
            `background-color: ${color};` +
            `color: ${fontColor};` +
            `font-size: ${fontSize}px;` +
            `border-radius: ${roundness * scale}px;` +
            `height: ${size * scale}px;` +
            `min-width: ${size * scale}px;` +
            `border-color: ${borderColor};` +
            `border-width: ${BORDER_SIZE}px;` +
            `padding: 0 ${padding}px; ${margins}`
        );
        this.#updateAlignment();
    }

    #updateAlignment() {
        const { position } = this.#config;
        const x_align = position === BadgePosition.TopLeft ||
                        position === BadgePosition.BottomLeft ?
                        Clutter.ActorAlign.START :
                        Clutter.ActorAlign.END;
        const y_align = position === BadgePosition.TopLeft ||
                        position === BadgePosition.TopRight ?
                        Clutter.ActorAlign.START :
                        Clutter.ActorAlign.END;
        this.#badge?.set({ x_align, y_align });
    }

}
