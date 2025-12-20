/**
 * @typedef {import('gi://Mtk').Rectangle} Mtk.Rectangle
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Context from '../../core/context.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';
import { Config } from '../../../shared/utils/config.js';
import { SettingsKey } from '../../../shared/enums/settings.js';
import { ConfigOptions } from '../../../shared/enums/taskbar.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Separator';
const BODY_COLOR = 'rgba(250, 250, 250, 0.5)';
const BODY_WIDTH = 2;

/** @enum {string} */
const ConfigField = {
    iconSize: SettingsKey.AppButtonIconSize,
    iconHPadding: SettingsKey.AppButtonIconHPadding,
    spacingAfter: SettingsKey.AppButtonSpacing
};

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    name: MODULE_NAME,
    reactive: true,
    track_hover: true,
    width: 0,
    opacity: AnimationType.OpacityMin.opacity
};

/** @type {{[prop: string]: *}} */
const BodyProps = {
    name: `${MODULE_NAME}-Body`,
    y_align: Clutter.ActorAlign.CENTER,
    x_align: Clutter.ActorAlign.CENTER
};

/**
 * @augments Component<St.Bin>
 */
export class Separator extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [ComponentEvent.Init]: () => (this.#updateStyle(), this.#handleState())
    };

    /** @type {boolean} */
    #isToggled = false;

    /** @type {boolean} */
    #isVisible = false;

    /** @type {St.Widget?} */
    #body = new St.Widget(BodyProps);

    /** @type {Config} */
    #config = Config(this, ConfigField, () => this.#handleConfig(), ConfigOptions);

    /** @type {number} */
    get #width() {
        const { iconSize, iconHPadding } = this.#config;
        return Math.max((iconSize + iconHPadding * 2) / 2, BODY_WIDTH);
    }

    /**
     * Note: Using Math.round to match css width.
     *
     * @override
     * @type {Mtk.Rectangle?}
     */
    get rect() {
        if (!this.isValid) return null;
        const result = super.rect;
        if (!result) return null;
        const { spacingAfter } = this.#config;
        const { globalScale, fontScale } = Context.desktop;
        result.width = Math.round((this.#width + spacingAfter) * fontScale * globalScale);
        return result;
    }

    /**
     * Note: This property forces Separator to be shown or hidden.
     *
     * @param {boolean} value
     */
    set isVisible(value) {
        if (typeof value !== 'boolean') return;
        this.#isToggled = false;
        if (value === this.#isVisible) return;
        this.#isVisible = value;
        this.#handleState();
    }

    constructor() {
        super(new St.Bin(DefaultProps));
        super.notifyCallback = data => this.#events?.[data?.event]?.();
        this.actor.set_child(this.#body);
        Context.desktop.connectScale(this, () => this.#handleConfig());
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
        Context.desktop.disconnect(this);
        Context.signals.removeAll(this);
        this.#body = null;
        this.#events = null;
    }

    #handleConfig() {
        this.#updateStyle();
        if (this.#isVisible) this.notifyParents(ComponentEvent.Init);
    }

    #updateStyle() {
        if (!this.isValid || !this.#body) return;
        const { iconSize, spacingAfter } = this.#config;
        const { fontScale } = Context.desktop;
        this.actor.set_style(
            `width: ${this.#width * fontScale}px;` +
            `padding-right: ${spacingAfter * fontScale}px;`
        );
        this.#body.set_style(
            `height: ${iconSize * fontScale}px;` +
            `width: ${BODY_WIDTH * fontScale}px;` +
            `border-radius: ${BODY_WIDTH * fontScale}px;` +
            `background-color: ${BODY_COLOR};`
        );
    }

    async #handleState() {
        if (!this.hasAllocation) return;
        const opacity = this.actor?.opacity ?? 0;
        if (this.#isVisible && opacity === AnimationType.OpacityMax.opacity) return;
        if (!this.#isVisible && opacity === AnimationType.OpacityMin.opacity) return;
        this.actor.remove_all_transitions();
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        if (!this.#isVisible) {
            Animation(this, AnimationDuration.Slow, { ...DefaultProps, mode });
            this.notifyParents(ComponentEvent.Destroy);
            return;
        }
        const width = this.rect?.width ?? BODY_WIDTH;
        this.notifyParents(ComponentEvent.Init);
        const isShown = await Animation(this, AnimationDuration.Default, { ...AnimationType.OpacityMax, width, mode });
        if (isShown) this.setSize();
    }

}
