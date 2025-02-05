/**
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { SharedConfig } from '../../../shared/utils/config.js';
import { SettingsPath, SettingsKey } from '../../../shared/core/enums.js';

const MODULE_NAME = 'Rocketbar__Taskbar_NotificationBadge';
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
const ConfigField = {
    color: SettingsKey.NotificationBadgeColor,
    fontColor: SettingsKey.NotificationBadgeFontColor,
    borderColor: SettingsKey.NotificationBadgeBorderColor,
    position: SettingsKey.NotificationBadgePosition,
    size: SettingsKey.NotificationBadgeSize,
    offset: SettingsKey.NotificationBadgeOffset,
    roundness: SettingsKey.NotificationBadgeRoundness,
    maxCount: SettingsKey.NotificationBadgeMaxCount
};

/** @type {{[option: string]: *}} */
const ConfigOptions = {
    path: SettingsPath.Taskbar
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
    x_expand: true,
    y_expand: true,
    visible: false,
    text: DEFAULT_TEXT,
    ...AnimationType.OpacityMin,
    ...AnimationType.ScaleMin
};

/**
 * @augments Component<St.Bin>
 */
export class NotificationBadge extends Component {

    /** @type {SharedConfig?} */
    static #sharedConfig = null;

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [ComponentEvent.Scale]: () => this.#updateStyle()
    };

    /** @type {St.Label?} */
    #badge = new St.Label(BadgeProps);

    /** @type {Config?} */
    #config = this.#configProvider.getConfig(this, () => this.#updateStyle());

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {SharedConfig} */
    get #configProvider() {
        NotificationBadge.#sharedConfig ??= new SharedConfig(ConfigField, ConfigOptions);
        return NotificationBadge.#sharedConfig;
    }

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
        if (!this.#badge || !this.#config || !this.#appButton || !this.isValid) return;
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
        this.#badge?.remove_all_transitions();
        this.#badge = null;
        this.#appButton = null;
        this.#events = null;
        this.#config = null;
        if (!NotificationBadge.#sharedConfig?.destroy(this)) return;
        NotificationBadge.#sharedConfig = null;
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
        if (!this.#config || !this.#badge?.visible || !this.isValid) return;
        const { color, fontColor, borderColor, offset, size, roundness, position } = this.#config;
        const scale = this.uiScale;
        const fontSize = Math.max(size - BORDER_SIZE * 2, FONT_SIZE_MIN) * scale;
        const padding = this.#badge?.text?.length === 1 ? 0 : LONG_VALUE_PADDING * scale;
        const margins =
            position === BadgePosition.TopLeft ?
            `margin-top: ${offset * scale}px; margin-left: ${offset * scale}px;` :
            position === BadgePosition.TopRight ?
            `margin-top: ${offset * scale}px; margin-right: ${offset * scale}px;` :
            position === BadgePosition.BottomLeft ?
            `margin-bottom: ${offset * scale}px; margin-left: ${offset * scale}px;` :
            position === BadgePosition.BottomRight ?
            `margin-bottom: ${offset * scale}px; margin-right: ${offset * scale}px;` : '';
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
        if (!this.#config) return;
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
