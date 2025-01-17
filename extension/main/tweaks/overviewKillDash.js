/**
 * @typedef {import('resource:///org/gnome/shell/ui/searchController.js').SearchController} SearchController
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { initializeDeferredWork as DeferredWork } from 'resource:///org/gnome/shell/ui/main.js';
import { Overview } from '../core/shell.js';
import Context from '../core/context.js';
import { Event } from '../../shared/core/enums.js';
import { Animation, AnimationDuration, AnimationType } from '../ui/base/animation.js';

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

    /** @type {St.Button?} */
    #showAppsButton = null;

    /** @type {{[key: string]: *}?} */
    #showAppsButtonDefaultProps = null;

    /** @type {SearchController?} */
    #searchController = null;

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
        const searchController = Overview.searchController;
        if (!showAppsButton || !searchController) return;
        Context.signals.add(this,
            [showAppsButton, Event.Checked, () => this.#updateState()],
            [searchController, Event.SearchActive, () => this.#updateState()]);
        let style_class = showAppsButton.get_style_class_name();
        let child = showAppsButton.get_child();
        let pivot_point = showAppsButton.pivot_point;
        this.#showAppsButtonDefaultProps = { style_class, child, pivot_point };
        style_class = SHOW_APPS_BUTTON_STYLE_CLASS;
        child = this.#actor;
        showAppsButton.set({ style_class, child });
        showAppsButton.set_pivot_point(0.5, 0.5);
        this.#showAppsButton = showAppsButton;
        this.#searchController = searchController;
        this.#updateState();
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
            this.#showAppsButton?.set(this.#showAppsButtonDefaultProps);
        }
        this.#dashWorkId = null;
        this.#showAppsButtonDefaultProps = null;
        this.#showAppsButton = null;
        this.#searchController = null;
        dash.remove_style_class_name(STYLE_CLASS);
        dash._box?.show();
        dash._background?.show();
        dash._queueRedisplay();
    }

    #updateState() {
        if (!this.#actor || !this.#showAppsButton) return;
        const isSearchActive = !!this.#searchController?.searchActive;
        const duration = AnimationDuration.Fast;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        if (isSearchActive) {
            const animationParams = { ...AnimationType.ScaleMin, ...AnimationType.OpacityMin, mode };
            Animation(this.#showAppsButton, duration, animationParams);
            return;
        }
        if (this.#showAppsButton.opacity !== AnimationType.OpacityMax.opacity) {
            const animationParams = { ...AnimationType.ScaleNormal, ...AnimationType.OpacityMax, mode };
            Animation(this.#showAppsButton, duration, animationParams);
        }
        this.#updateActorRotation();
    }

    #updateActorRotation() {
        if (!this.#actor || !this.#showAppsButton) return;
        const showAppsButton = this.#showAppsButton;
        const rotation_angle_z = showAppsButton.checked ? ACTOR_ROTATION_CHECKED : ACTOR_ROTATION_DEFAULT;
        if (this.#actor.rotation_angle_z === rotation_angle_z) return;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const animationParams = { rotation_angle_z, mode };
        Animation(this.#actor, AnimationDuration.Slower, animationParams);
    }

}
