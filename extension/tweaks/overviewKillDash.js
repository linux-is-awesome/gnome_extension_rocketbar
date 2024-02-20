import Clutter from 'gi://Clutter';
import { initializeDeferredWork as DeferredWork } from 'resource:///org/gnome/shell/ui/main.js';
import { Overview } from '../core/shell.js';

const MODULE_NAME = 'Rocketbar__Tweak_KillDash';
const HIDDEN_DASH_HEIGHT = 40;

/** @type {{[prop: string]: *}} */
const ActorProps = {
    name: MODULE_NAME
};

export default class {

    /** @type {Clutter.Actor?} */
    #actor = null;

    /** @type {string?} */
    #dashWorkId = null;

    constructor() {
        const dash = Overview.dash;
        if (!dash) return;
        this.#actor = new Clutter.Actor(ActorProps);
        this.#dashWorkId = dash._workId ?? null;
        dash._workId = DeferredWork(this.#actor, () => {
            dash._separator?.destroy();
            dash._separator = null;
            const appIcons = dash._box?.get_children();
            if (!appIcons?.length) return;
            for (const appIcon of appIcons) appIcon.destroy();
        });
        dash.add_child(this.#actor);
        dash.showAppsButton?.hide();
        dash._background?.hide();
        dash.set_size(-1, HIDDEN_DASH_HEIGHT);
        dash.setMaxSize(-1, HIDDEN_DASH_HEIGHT);
    }

    destroy() {
        this.#actor?.destroy();
        this.#actor = null;
        const dash = Overview.dash;
        if (!dash) return;
        if (this.#dashWorkId) {
            dash._workId = this.#dashWorkId;
        }
        this.#dashWorkId = null;
        dash.showAppsButton?.show();
        dash._background?.show();
        dash.set_size(-1, -1);
        dash.setMaxSize(-1, -1);
    }

}
