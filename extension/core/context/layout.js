import St from 'gi://St';
import { panel as MainPanel,
         layoutManager as MainLayout } from 'resource:///org/gnome/shell/ui/main.js';
import Context from '../context.js';
import { Type, Event, Delay } from '../enums.js';

export default class LayoutManager {

    /** @type {Map<*, () => void>} */
    #clients = new Map();

    /** @type {boolean} */
    get isStartingUp() {
        return MainLayout._startingUp;
    }

    destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#clients?.clear();
        this.#clients = null;
    }

    /**
     * @param {PopupMenu} menu
     */
    addMenu(menu) {
        if (!menu) return;
        try {
            MainPanel.menuManager?.addMenu(menu);
            this.addOverlay(menu.actor);
        } catch (e) {
            console.error(`${Context.metadata?.name} unable to add menu.`, e);
        }
    }

    /**
     * @param {PopupMenu} menu
     */
    removeMenu(menu) {
        if (!menu) return;
        try {
            MainPanel.menuManager?.removeMenu(menu);
            this.removeOverlay(menu.actor);
        } catch (e) {
            console.error(`${Context.metadata?.name} unable to remove menu.`, e);
        }
    }

    /**
     * @param {St.Widget} actor
     */
    addOverlay(actor) {
        if (actor instanceof St.Widget === false) return;
        MainLayout.uiGroup?.add_actor(actor);
    }

    /**
     * @param {St.Widget} actor
     */
    removeOverlay(actor) {
        if (actor instanceof St.Widget === false) return;
        MainLayout.uiGroup?.remove_actor(actor);
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    requestInit(client, callback) {
        if (!this.#clients || !client ||
            typeof callback !== Type.Function ||
            typeof this.#clients.get(client) === Type.Function) return;
        if (!this.isStartingUp) {
            this.#clients.set(client, null);
            callback();
            return;
        }
        this.#clients.set(client, callback);
        if (Context.signals.hasClient(this)) return;
        Context.signals.add(this, [MainLayout, Event.StartupComplete, () => this.#initClients()]);
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    queueAfterInit(client, callback) {
        if (!client || !this.#clients?.has(client) ||
            typeof callback !== Type.Function ||
            typeof this.#clients.get(client) === Type.Function) return;
        this.#clients.set(client, callback);
        Context.jobs.removeAll(this).new(this, Delay.Background).destroy(() => this.#handleAfterInit()).catch();
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    isQueued(client) {
        return typeof this.#clients?.get(client) === Type.Function; 
    }

    /**
     * @param {*} client
     */
    removeClient(client) {
        if (!client || !this.#clients?.has(client)) return;
        this.#clients.delete(client);
        if (this.#clients.size) return;
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
    }

    #initClients() {
        this.#processClients();
        Context.signals.removeAll(this);
    }

    #handleAfterInit() {
        this.#processClients();
        this.#clients?.clear();
    }

    #processClients() {
        if (!this.#clients?.size) return;
        for (const [client, callback] of this.#clients) {
            this.#clients.set(client, null);
            if (typeof callback === Type.Function) callback();
        }
    }

}
