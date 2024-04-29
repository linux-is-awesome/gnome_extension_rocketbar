import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { initializeDeferredWork as DeferredWork } from 'resource:///org/gnome/shell/ui/main.js';
import { Overview } from '../core/shell.js';
import Context from '../core/context.js';
import { Event } from '../core/enums.js';
import { Animation, AnimationDuration } from '../ui/base/animation.js';

const MODULE_NAME = 'Rocketbar__Tweak_OverviewKillDash';
const STYLE_CLASS = 'rocketbar__tweak_overview-kill-dash';
const SHOW_APPS_BUTTON_STYLE_CLASS = 'page-navigation-arrow';
const ACTOR_ICON_NAME = 'carousel-arrow-next-symbolic';
const ACTOR_ROTATION_DEFAULT = -90;
const ACTOR_ROTATION_CHECKED = 90;

/** @type {{[prop: string]: *}} */
const ActorProps = {
    name: MODULE_NAME,
    icon_name: ACTOR_ICON_NAME,
    rotation_angle_z: ACTOR_ROTATION_DEFAULT
};

export default class {

    /** @type {St.Icon?} */
    #actor = null;

    /** @type {string?} */
    #dashWorkId = null;

    /** @type {{[key: string]: *}?} */
    #showAppsButtonDefaultProps = null;

    constructor() {
        const dash = Overview.dash;
        if (!dash) return;
        this.#actor = new St.Icon(ActorProps);
        this.#actor.set_pivot_point(0.5, 0.5);
        this.#dashWorkId = dash._workId ?? null;
        dash._workId = DeferredWork(this.#actor, () => {
            dash._separator?.destroy();
            dash._separator = null;
            const appIcons = dash._box?.get_children();
            if (!appIcons?.length) return;
            for (const appIcon of appIcons) appIcon.destroy();
        });
        dash._background?.hide();
        dash._box?.hide();
        dash.add_style_class_name(STYLE_CLASS);
        const showAppsButton = dash.showAppsButton;
        if (!showAppsButton) return;
        Context.signals.add(this, [showAppsButton, Event.Checked, () => this.#updateActorRotation()]);
        let style_class = showAppsButton.get_style_class_name();
        let child = showAppsButton.get_child();
        this.#showAppsButtonDefaultProps = { style_class, child };
        style_class = SHOW_APPS_BUTTON_STYLE_CLASS;
        child = this.#actor;
        showAppsButton.set({ style_class, child });
        this.#updateActorRotation();
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#actor?.destroy();
        this.#actor = null;
        const dash = Overview.dash;
        if (!dash) return;
        if (this.#dashWorkId) {
            dash._workId = this.#dashWorkId;
        }
        if (this.#showAppsButtonDefaultProps) {
            dash.showAppsButton?.set(this.#showAppsButtonDefaultProps);
        }
        this.#dashWorkId = null;
        this.#showAppsButtonDefaultProps = null;
        dash.remove_style_class_name(STYLE_CLASS);
        dash._box?.show();
        dash._background?.show();
        dash._queueRedisplay();
    }

    #updateActorRotation() {
        if (!this.#actor) return;
        const showAppsButton = Overview.dash?.showAppsButton;
        if (!showAppsButton) return;
        const rotation_angle_z = showAppsButton.checked ? ACTOR_ROTATION_CHECKED : ACTOR_ROTATION_DEFAULT;
        if (this.#actor.rotation_angle_z === rotation_angle_z) return;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const animationParams = { rotation_angle_z, mode };
        Animation(this.#actor, AnimationDuration.Slower, animationParams);
    }

}
