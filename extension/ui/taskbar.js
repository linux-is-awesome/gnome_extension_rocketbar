/* exported Taskbar */

import { Main } from '../core/legacy.js';
import { Context } from '../core/context.js';
import { ComponentEvent } from './base/component.js';
import { ScrollView } from './base/scrollView.js';
import { TaskbarClient } from '../services/taskbarService.js';
import { AppButton } from './taskbar/appButton.js';

const MODULE_NAME = 'Rocketbar__Taskbar';

export class Taskbar extends ScrollView {

    /** @type {Map<Meta.Workspace, Set<Shell.App>>} */
    #runningApps = Context.getSessionCache(this.constructor.name);

    /** @type {WeakMap<Shell.App, AppButton>} */
    #appButtons = new WeakMap();

    /** @type {TaskbarClient} */
    #service = new TaskbarClient(() => this.#rerender());

    constructor() {
        super(MODULE_NAME);
        this.connect(ComponentEvent.Notify, data => this.#handleNotify(data));
        Context.layout.requestInit(this, () => this.#setParent());
    }

    #handleNotify({ event }) {
        switch (event) {
            case ComponentEvent.Mapped:
                Context.layout.queueAfterInit(this, () => this.#rerender())
                return;
            case ComponentEvent.Destroy:
                this.#destroy();
            default: return;
        }
    }

    #destroy() {
        Context.layout.removeClient(this);
        this.#service?.destroy();
        this.#service = null;
        this.#appButtons = null;
    }

    #setParent() {
        this.setParent(Main.panel._leftBox, -1);
    }

    #rerender() {
        if (!this.isMapped || Context.layout.isQueued(this)) return;
        const apps = this.#getApps();
        if (!apps?.size) {
            this.#appButtons = new WeakMap();
            return;
        }
        const appButtons = new WeakMap();
        const sortedAppButtons = []; 
        for (const app of apps) {
            const oldAppButton = this.#appButtons.get(app);
            if (!oldAppButton) {
                const newAppButton = new AppButton(app);
                appButtons.set(app, newAppButton);
                sortedAppButtons.push(newAppButton);
                continue;
            }
            if (oldAppButton.isValid) {
                appButtons.set(app, oldAppButton);
                sortedAppButtons.push(oldAppButton);
            }
        }
        this.#appButtons = appButtons;
        for (let i = 0, l = sortedAppButtons.length; i < l; ++i) sortedAppButtons[i].setParent(this, i);
    }

    #getApps() {
        const workspace = this.#service.workspace;
        const favoriteApps = this.#service.favorites?.apps;
        let runningApps = this.#service.queryApps(true, true);
        if (!runningApps?.size) this.#runningApps.delete(workspace);
        else if (!this.#runningApps.has(workspace)) this.#runningApps.set(workspace, runningApps);
        else {
            const oldRunningApps = this.#runningApps.get(workspace);
            const newRunningApps = new Set();
            for (const app of oldRunningApps) if (runningApps.has(app)) newRunningApps.add(app);
            runningApps = new Set([...newRunningApps, ...runningApps]);
            this.#runningApps.set(workspace, runningApps);
        }
        if (!favoriteApps?.size) return runningApps;
        if (!runningApps?.size) return favoriteApps;
        return new Set([...favoriteApps, ...runningApps]);
    }

}
