/**
 * @typedef {import('gi://Shell').App} Shell.App
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Context from '../../main/context.js';
import { ComponentEvent, ComponentLocation } from '../base/component.js';
import { Icon, IconEvent } from '../base/icon.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { DominantColor } from '../../utils/dominantColor.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppIcon';
const FALLBACK_ICON_NAME = 'application-x-executable';
const DEFAULT_SIZE = 20;
const HIGHLIGHT_BRIGHTNESS = 0.1;
const HIGHLIGHT_CONTRAST = 0.1;
const DRAG_ACTOR_SIZE_SCALE = 1.5;

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    fallback_icon_name: FALLBACK_ICON_NAME,
    icon_size: DEFAULT_SIZE
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

export class AppIcon extends Icon {

    /** @type {string?} */
    static iconThemeName = null;

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [ComponentEvent.Scale]: () => this.setSize(this.#size),
        [IconEvent.TextureChanged]: () => this.#handleIconTexture()
    };

    /** @type {Shell.App?} */
    #app = null;

    /** @type {number} */
    #size = DEFAULT_SIZE;

    /** @type {Clutter.BrightnessContrastEffect?} */
    #highlight = null;

    /** @type {string?} */
    #dominantColor = null;

    /** @type {Map<Shell.App, string?>} */
    #dominantColors = Context.getStorage(this.constructor.name);

    /** @param {boolean} value */
    set isHighlighted(value) {
        if (typeof value !== 'boolean') return;
        this.#highlight?.set_enabled(value);
    }

    /** @type {St.Icon} */
    get dragActor() {
        const gicon = this.actor.get_gicon();
        const size = this.#size * DRAG_ACTOR_SIZE_SCALE * this.uiScale;
        const actorProps = { name: `${MODULE_NAME}-DragActor`, icon_size: size, gicon };
        return new St.Icon(actorProps);
    }

    /** @type {string?} */
    get dominantColor() {
        if (!this.#app || this.#dominantColor) return this.#dominantColor;
        this.#dominantColor = this.#dominantColors.get(this.#app) ?? null;
        if (this.#dominantColors.has(this.#app)) return this.#dominantColor;
        const icon = this.actor.get_gicon();
        if (!icon) return null;
        this.#dominantColor = DominantColor(icon);
        this.#dominantColors.set(this.#app, this.#dominantColor);
        return this.#dominantColor;
    }

    /**
     * @param {Shell.App} app
     * @param {string?} [iconPath]
     */
    constructor(app, iconPath) {
        const iconTexture = app?.get_icon() ?? null;
        const icon = { iconTexture, iconPath };
        super(icon, MODULE_NAME);
        this.setProps(DefaultProps);
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.());
        this.#app = app;
        this.#highlight = new Clutter.BrightnessContrastEffect(HighlightProps);
        this.#highlight.set_brightness(HIGHLIGHT_BRIGHTNESS);
        this.#highlight.set_contrast(HIGHLIGHT_CONTRAST);
        const actor = this.actor;
        actor.set_pivot_point(0.5, 0.5);
        actor.add_effect(this.#highlight);
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
        if (!this.hasAllocation) return false;
        const { duration } = animation;
        switch (animation) {
            case AppIconAnimation.Press:
                this.isHighlighted = false;
            case AppIconAnimation.Release:
                return Animation(this, duration, animation.params);
            case AppIconAnimation.Activate:
            case AppIconAnimation.Deactivate:
                if (!Context.systemSettings.enableAnimations) return true;
                const mode = Clutter.AnimationMode.EASE_OUT_SINE;
                const location = this.location === ComponentLocation.Top ? 1 : -1;
                const translation_y = animation.translation_y * location * this.uiScale * this.globalScale;
                if (!await Animation(this, duration, { translation_y, mode })) return false;
                return Animation(this, duration, { ...AnimationType.TranslationReset, mode });
            default: return false;
        }
    }

    #destroy() {
        this.#app = null;
        this.#events = null;
        this.#highlight = null;
    }

    #handleIconTexture() {
        const iconThemeName = Context.systemSettings.gtk_icon_theme;
        if (AppIcon.iconThemeName !== iconThemeName) {
            AppIcon.iconThemeName = iconThemeName;
            this.#dominantColors.clear();
        }
        if (!this.#app || !this.#dominantColor) return;
        this.#dominantColors.delete(this.#app);
        this.#dominantColor = null;
        this.notifyParents(AppIconEvent.DominantColorChanged);
    }

}
