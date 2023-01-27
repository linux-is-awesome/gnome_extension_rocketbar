/* exported AppServiceClient */

import GObject from 'gi://GObject'
import Meta from 'gi://Meta'
import Shell from 'gi://Shell'
import { Context } from '../core/context.js'
import { Type, Delay } from '../core/enums.js'

class Favorites {

    constructor() {

    }

    destroy() {

    }

}

// TODO: temp export 
class AppService {

    #windowTypes = new Set([
        Meta.WindowType.NORMAL,
        Meta.WindowType.DIALOG,
        Meta.WindowType.MODAL_DIALOG
    ]);

    #windowTracker = Shell.WindowTracker.get_default();

    #workspace = null;

    #favorites = null;

    #apps = new Map(); // app => Set<window>

    #windows = new Map(); // window => app

    #changedApps = new Set();

    #clients = new Set();

    #notifyJob = Context.jobs.new(this);

    get favorites() {
        if (this.#favorites) return this.#favorites;
        this.#favorites = new Favorites();
        return this.#favorites;
    }

    get isEmpty() {
        return !this.#clients.size;
    }

    get apps() {
        return this.#apps;
    }

    get windows() {
        return this.#windows;
    }

    constructor() {
        Context.jobs.new(this).destroy(() => this.#initialize());
    }

    destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#favorites?.destroy();
        this.#favorites = null;
        this.#apps = null;
        this.#windows = null;
        this.#notifyJob = null;
    }

    addClient(client) {
        if (!this.#clients || this.#clients.has(client)) return;
        this.#clients.add(client);
    }

    removeClient(client) {
        if (!this.#clients?.has(client)) return;
        this.#clients.delete(client);
    }

    #initialize() {
        this.#addWindows();
        this.#handleWorkspace();
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), 'app-state-changed', (_, app) => this.#handleAppState(app)],
            [global.window_manager, 'switch-workspace', () => this.#handleWorkspace()]
        );
    }

    #addWindows() {
        const windows = global.get_window_actors();
        if (!windows.length) return; 
        for (let i = 0, l = windows.length; i < l; ++i) {
            const window = windows[i].metaWindow;
            if (!this.#isValidWindow(window)) continue;
            this.#addWindow(window);
        }
    }

    #handleWorkspace() {
        if (!this.#notifyJob) return;
        const currentWorkspace = global.workspace_manager.get_active_workspace();
        if (this.#workspace === currentWorkspace) return;
        Context.signals.remove(this, this.#workspace);
        this.#workspace = currentWorkspace;
        Context.signals.add(this, [
            this.#workspace,
            'window_added', (_, window) => this.#addWindowAsync(window), GObject.ConnectFlags.AFTER,
            'window_removed', (_, window) => this.#removeWindow(window), GObject.ConnectFlags.AFTER
        ]);
        this.#changedApps.clear();
        this.#notifyJob.reset(Delay.Idle).then(() => this.#notifyClients());
    }

    #handleAppState(app) {
        if (!this.#apps || app instanceof Shell.App === false) return;
        console.log('Handle app state', app?.id, app?.state);
        switch (app.state) {
            case Shell.AppState.STARTING: return;
            case Shell.AppState.RUNNING:
                if (this.#apps.has(app)) return;
                const windows = app.get_windows();
                if (!windows.length) return;
                this.#apps.set(app, new Set(windows));
                for (let i = 0, l = windows.length; i < l; ++i) this.#windows.set(windows[i], app);
                this.#trackChangedApp(app);
                return;
            default: if (!this.#apps.has(app)) return;
        }
        const windows = this.#apps.get(app);
        this.#apps.delete(app);
        if (!windows.size || !this.#windows.size) return this.#trackChangedApp(app);
        for (const window of windows) this.#windows.delete(window);
        this.#trackChangedApp(app);
    }

    #addWindowAsync(window) {
        if (!this.#isValidWindow(window)) return;
        Context.jobs.new(window).destroy(() => this.#trackChangedApp(this.#addWindow(window)));
    }

    #addWindow(window) {
        if (!this.#windows || this.#windows.has(window)) return null;
        const app = this.#windowTracker?.get_window_app(window);
        if (typeof app?.id !== Type.String) return null;
        this.#windows.set(window, app);
        if (!this.#apps.has(app)) this.#apps.set(app, new Set([window]));
        else this.#apps.get(app).add(window);
        return app;
    }

    #removeWindow(window) {
        if (!this.#isValidWindow(window)) return;
        Context.jobs.removeAll(window);
        if (!this.#windows.has(window)) return;
        const app = this.#windows.get(window);
        this.#windows.delete(window);
        if (!this.#apps?.has(app)) return;
        const windows = this.#apps.get(app);
        windows.delete(window);
        if (!windows.size) this.#apps.delete(app);
        this.#trackChangedApp(app);
    }

    #isValidWindow(window) {
        return window instanceof Meta.Window && this.#windowTypes?.has(window.get_window_type());
    }

    #trackChangedApp(app) {
        if (!this.#notifyJob || !this.#clients?.size) return;
        if (!app || this.#changedApps.has(app)) return;
        this.#changedApps.add(app);
        this.#notifyJob.reset(Delay.Queue).then(() => this.#notifyClients());
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        let trackFavorites = false;
        const hasChangedApps = this.#changedApps.size > 0;
        for (const client of this.#clients) {
            const app = client.app;
            if (!hasChangedApps) client.notify();
            else if (!app) client.notify(this.#changedApps);
            else if (this.#changedApps.has(app)) client.notify();
            if (trackFavorites) continue;
            trackFavorites = client.trackFavorites;
        }
        if (!trackFavorites && this.#favorites) {
            this.#favorites.destroy();
            this.#favorites = null;
        }
        this.#changedApps.clear();
    }

}

export class AppServiceClient {

    #service = null;

    #trackFavorites = false;

    #app = null;

    #callback = null;

    get app() {
        return this.#app;
    }

    get trackFavorites() {
        return this.#trackFavorites;
    }

    set trackFavorites(value) {
        if (typeof value !== Type.Boolean) return;
        this.#trackFavorites = value;
    }

    constructor(callback, trackFavorites, app) {
        if (typeof callback !== Type.Function) return;
        this.#callback = callback;
        this.#trackFavorites = trackFavorites;
        if (app instanceof Shell.App) {
            this.#app = app;
        }
        if (!this.#service) {
            this.#service = new AppService();
        }
        this.#service.addClient(this);
    }

    destroy() {
        this.#callback = null;
        this.#app = null;
        if (!this.#service) return;
        this.#service.removeClient(this);
        if (!this.#service.isEmpty) return;
        this.#service.destroy();
        this.#service = null;
    }

    getFavorites() {

    }

    /**
     * @param {*} filters
     * @returns {Set<Meta.Window>|Map<Shell.App, Set<Meta.Window>>}
     */
    getWindows(filters) {
        if (!this.#service) return null;
        if (this.#app) return this.#service.apps.get(this.#app);
        return this.#service.apps;
    }

    notify(apps) {
        if (typeof this.#callback === Type.Function) this.#callback(apps);
    }

}
