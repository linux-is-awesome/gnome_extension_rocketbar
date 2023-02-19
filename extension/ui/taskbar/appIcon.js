/* exported AppIcon, AppIconAnimation */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Context } from '../../core/context.js';
import { Event, Type } from '../../core/enums.js';
import { Component, ComponentEvent, ComponentLocation } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppIcon';
const FALLBACK_ICON_NAME = 'application-x-executable';
const DEFAULT_SIZE = 20;

/** @type {Object.<string, number|string>} */
const DefaultProps = {
    name: MODULE_NAME,
    fallback_icon_name: FALLBACK_ICON_NAME,
    icon_size: DEFAULT_SIZE
};

/** @enum {*} */
export const AppIconAnimation = {
    Press: { duration: AnimationDuration.Fast, params: AnimationType.ScaleDown },
    Release: { duration: AnimationDuration.Fast, params: AnimationType.ScaleMax },
    Activate: { duration: AnimationDuration.Fast, offset: 3 },
    Deactivate: { duration: AnimationDuration.Fast, offset: -3 }
};

export class AppIcon extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Scale]: () => this.setSize(this.#size)
    })[data?.event]?.call(this);

    /** @type {Shell.App} */
    #app = null;

    /** @type {number} */
    #size = DEFAULT_SIZE;

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
     * @returns {Promise}
     */
    animate(animation) {
        if (!this.isMapped) return null;
        switch (animation) {
            case AppIconAnimation.Press:
            case AppIconAnimation.Release:
                return Animation(this, animation.duration, animation.params);
            case AppIconAnimation.Activate:
            case AppIconAnimation.Deactivate:
                const offsetMultiplier = this.location === ComponentLocation.Top ? 1 : -1;
                const translation_y = animation.offset * offsetMultiplier;
                const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
                return Animation(this, animation.duration, { translation_y, mode }).then(() =>
                       Animation(this, animation.duration, { ...AnimationType.TranslationReset, mode }));
            default: return null;
        }
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
