/* exported AppIcon */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Context } from '../../core/context.js';
import { Event, Type, Delay } from '../../core/enums.js';
import { Component, ComponentEvent, ComponentLocation } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppIcon';
const FALLBACK_ICON_NAME = 'application-x-executable';
const DEFAULT_SIZE = 20;

/** @type {Object.<string, number|string>} */
const DefaultProps = {
    name: MODULE_NAME,
    fallback_icon_name: FALLBACK_ICON_NAME,
    icon_size: DEFAULT_SIZE,
    opacity: 0
};

/** @enum {*} */
export const AppIconAnimation = {
    Startup: { duration: AnimationDuration.Fast },
    Restore: { duration: AnimationDuration.Fast }
};

export class AppIcon extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Mapped]: () =>
            !this.#startupAnimation ? this.actor.set(AnimationType.OpacityMax) :
            Context.jobs.new(this, Delay.Redraw).destroy(() => this.animate(this.#startupAnimation)).catch(),
        [ComponentEvent.Scale]: () => this.setSize(this.#size)
    })[data?.event]?.call(this);

    /** @type {Shell.App} */
    #app = null;

    /** @type {number} */
    #size = DEFAULT_SIZE;

    /** @type {AppIconAnimation} */
    #startupAnimation = !Context.layout.isInitializing ? AppIconAnimation.Startup : null;

    /** @param {AppIconAnimation} animation */
    set startupAnimation(animation) {
        if (Context.layout.isInitializing) return;
        this.#startupAnimation = animation;
    }

    /**
     * @param {Shell.App} app
     */
    constructor(app) {
        super(new St.Icon(DefaultProps));
        this.actor.set_pivot_point(0.5, 0.5);
        this.#app = app;
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.#setDefaultIcon();
    }

    /**
     * @param {number} size
     */
    setSize(size) {
        if (typeof size !== Type.Number) return;
        this.#size = size;
        this.actor.set_icon_size(size * this.uiScale);
    }

    /**
     * @param {AppIconAnimation} animation
     * @param {() => void} callback
     */
    animate(animation, callback) {
        if (!this.isMapped || !animation) return;
        const isLocationOnTop = this.location === ComponentLocation.Top;
        let animationParams = !this.actor.opacity ? AnimationType.OpacityMax : {};
        switch (animation) {
            case AppIconAnimation.Startup:
                const offset = this.#size * this.uiScale;
                this.actor.set({ translation_y: isLocationOnTop ? -offset : offset });
                animationParams = { ...animationParams, ...AnimationType.TranslationDefault };
            case AppIconAnimation.Restore:
                this.actor.set(AnimationType.ScaleHalf);
                animationParams = { ...animationParams, ...AnimationType.ScaleMax, ...{ mode: Clutter.AnimationMode.EASE_OUT_QUAD } };
                break;
            default: return;
        }
        const animationInstance = Animation(this, animation.duration, animationParams);
        if (typeof callback === Type.Function) animationInstance.then(callback);
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
    }

    #setDefaultIcon() {
        if (this.actor.get_gicon()) this.actor.set_gicon(null);
        this.actor.set_gicon(this.#app.get_icon());
        if (Context.signals.hasClient(this)) return;
        Context.signals.add(this, [St.Settings.get(), Event.IconTheme, () => this.#setDefaultIcon()]);
    }

}
