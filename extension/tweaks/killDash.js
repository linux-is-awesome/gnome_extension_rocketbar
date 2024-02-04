import Clutter from 'gi://Clutter';
import { initializeDeferredWork as DeferredWork } from 'resource:///org/gnome/shell/ui/main.js';
import { Overview } from '../core/shell.js';

const HIDDEN_DASH_HEIGHT = 40;

export default class {

    /** @type {string?} */
    #dashWorkId = null;

    /** @type {Clutter.Actor?} */
    #dummyActor = null;

    constructor() {
        const dash = Overview.dash;
        if (!dash) return;
        this.#dashWorkId = dash._workId ?? null;
        this.#dummyActor = new Clutter.Actor();
        dash.add_child(this.#dummyActor);
        const workId = DeferredWork(this.#dummyActor, () => {
            const appIcons = dash._box?.get_children();
            if (!appIcons?.length) return;
            for (const appIcon of appIcons) appIcon.destroy();
        });
        dash._workId = workId;
        dash.showAppsButton?.hide();
        dash._background?.hide();
        dash._separator = null;
        dash.set_size(-1, HIDDEN_DASH_HEIGHT);
        dash.setMaxSize(-1, HIDDEN_DASH_HEIGHT);
    }

    destroy() {
        const dash = Overview.dash;
        if (!dash) return;
        if (this.#dashWorkId) {
            dash._workId = this.#dashWorkId;
        }
        this.#dummyActor?.destroy();
        this.#dummyActor = null;
        this.#dashWorkId = null;
        dash.showAppsButton?.show();
        dash._background?.show();
        dash.set_size(-1, -1);
        dash.setMaxSize(-1, -1);
    }

}
