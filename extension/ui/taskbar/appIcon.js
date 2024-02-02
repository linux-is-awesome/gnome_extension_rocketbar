/**
 * JSDoc types
 *
 * @typedef {import('gi://Shell').App} Shell.App
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Context from '../../core/context.js';
import { Component, ComponentEvent, ComponentLocation } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { Delay, Event } from '../../core/enums.js';
import { DominantColor } from '../../utils/dominantColor.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppIcon';
const FALLBACK_ICON_NAME = 'application-x-executable';
const DEFAULT_SIZE = 20;
const HIGHLIGHT_BRIGHTNESS = 0.1;
const HIGHLIGHT_CONTRAST = 0.1;
const DRAG_ACTOR_SIZE_SCALE = 1.5;

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    name: MODULE_NAME,
    fallback_icon_name: FALLBACK_ICON_NAME,
    icon_size: DEFAULT_SIZE,
    x_align: Clutter.ActorAlign.CENTER,
    y_align: Clutter.ActorAlign.CENTER
};

/** @type {{[prop: string]: *}} */
const HighlightProps = {
    enabled: false
};

/** @enum {{[animation: string]: *}} */
export const AppIconAnimation = {
    Press: { duration: AnimationDuration.Fast, params: AnimationType.ScaleDown },
    Release: { duration: AnimationDuration.Fast, params: AnimationType.ScaleNormal },
    Activate: { duration: AnimationDuration.Fast, translation_y: 3 },
    Deactivate: { duration: AnimationDuration.Fast, translation_y: -3 }
};

/** @enum {string} */
export const AppIconEvent = {
    DominantColorChanged: 'appicon::dominant-color-changed'
};

/**
 * @augments Component<St.Icon>
 */
export class AppIcon extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = data => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Scale]: () => this.setSize(this.#size)
    })[data?.event]?.call(this);

    /** @type {Shell.App?} */
    #app = null;

    /** @type {number} */
    #size = DEFAULT_SIZE;

    /** @type {string?} */
    #iconPath = null;

    /** @type {Clutter.BrightnessContrastEffect?} */
    #highlight = null;

    /** @type {string?} */
    #dominantColor = null;

    /** @type {Map<Shell.App, string?>} */
    #dominantColors = Context.getStorage(this.constructor.name);

    /** @param {string?} value */
    set iconPath(value) {
        if (this.#iconPath === value) return;
        if (typeof value !== 'string' && value !== null) return;
        this.#iconPath = value;
        this.#setIcon();
    }

    /** @param {boolean} value */
    set isHighlighted(value) {
        if (typeof value !== 'boolean') return;
        this.#highlight?.set_enabled(value);
    }

    /** @type {St.Icon} */
    get dragActor() {
        const gicon = this.actor.get_gicon();
        const size = this.#size * DRAG_ACTOR_SIZE_SCALE * this.uiScale;
        return new St.Icon({ name: `${MODULE_NAME}-DragActor`, icon_size: size, gicon });
    }

    /** @type {string?} */
    get dominantColor() {
        if (!this.#app || this.#dominantColor) return this.#dominantColor;
        this.#dominantColor = this.#dominantColors.get(this.#app) ?? null;
        if (this.#dominantColors.has(this.#app)) return this.#dominantColor;
        this.#dominantColor = DominantColor(this.actor.get_gicon());
        this.#dominantColors.set(this.#app, this.#dominantColor);
        return this.#dominantColor;
    }

    /**
     * @param {Shell.App} app
     * @param {string?} [iconPath]
     */
    constructor(app, iconPath) {
        super(new St.Icon(DefaultProps));
        this.#highlight = new Clutter.BrightnessContrastEffect(HighlightProps);
        this.#highlight.set_brightness(HIGHLIGHT_BRIGHTNESS);
        this.#highlight.set_contrast(HIGHLIGHT_CONTRAST);
        this.actor.set_pivot_point(0.5, 0.5);
        this.actor.add_effect(this.#highlight);
        this.#app = app;
        this.#iconPath = iconPath ?? null;
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.#setIcon();
    }

    /**
     * @override
     * @param {number} size
     * @returns {this}
     */
    setSize(size) {
        if (typeof size !== 'number') return this;
        this.#size = size;
        this.actor.set_icon_size(size * this.uiScale);
        return this;
    }

    /**
     * @param {AppIconAnimation} animation
     * @returns {Promise<boolean>}
     */
    async animate(animation) {
        if (!this.isMapped) return false;
        const { duration } = animation;
        switch (animation) {
            case AppIconAnimation.Press:
                this.isHighlighted = false;
            case AppIconAnimation.Release:
                return Animation(this, duration, animation.params);
            case AppIconAnimation.Activate:
            case AppIconAnimation.Deactivate:
                if (!Context.systemSettings.enableAnimations) return true;
                const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
                const location = this.location === ComponentLocation.Top ? 1 : -1;
                const translation_y = animation.translation_y * location * this.uiScale * this.globalScale;
                if (!await Animation(this, duration, { translation_y, mode })) return false;
                return Animation(this, duration, { ...AnimationType.TranslationReset, mode });
            default: return false;
        }
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        if (!this.#highlight) return;
        this.actor.remove_effect(this.#highlight);
        this.#highlight = null;
    }

    #handleIconTheme() {
        this.#dominantColors.clear();
        Context.jobs.removeAll(this).new(this, Delay.Background).destroy(() => this.#setIcon());
    }

    /**
     * Note: Icon Path is not validated in terms of performance.
     *       Gio.Icon.new_for_string doesn't throw an exception if the path is invalid.
     *       So it's the expected behavior to get a blank icon in such cases for now.
     */
    #setIcon() {
        const oldIcon = this.actor.get_gicon();
        const iconPath = this.#iconPath && typeof this.#iconPath === 'string' ? this.#iconPath : null;
        const customIcon = iconPath ? Gio.Icon.new_for_string(iconPath) : null;
        if (oldIcon) this.actor.set_gicon(null);
        this.actor.set_gicon(customIcon ?? this.#app?.get_icon());
        this.#handleIcon();
        if (iconPath) Context.signals.removeAll(this);
        if (iconPath || Context.signals.hasClient(this)) return;
        Context.signals.add(this, [St.Settings.get(), Event.IconTheme, () => this.#handleIconTheme()]);
    }

    #handleIcon() {
        if (!this.#dominantColor || !this.#app) return;
        this.#dominantColors.delete(this.#app);
        this.#dominantColor = null;
        this.notifyParents(AppIconEvent.DominantColorChanged);
    }

}
