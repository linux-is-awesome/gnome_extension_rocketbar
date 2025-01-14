/**
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenu} PopupMenu
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupDummyMenu} PopupDummyMenu
 */

import St from 'gi://St';
import Context from '../context.js';
import { MainLayout, MainPanel } from '../shell.js';
import { Component } from '../../ui/base/component.js';
import { Event, Delay } from '../../shared/enums.js';

export default class Desktop {

    /** @type {Map<*, (() => void)?>?} */
    #clients = new Map();

    /** @type {boolean} */
    get isReady() {
        return !MainLayout._startingUp;
    }

    destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#clients?.clear();
        this.#clients = null;
    }

    /**
     * @param {PopupMenu|PopupDummyMenu} menu
     */
    addMenu(menu) {
        if (menu?.actor instanceof St.Widget === false) return;
        try {
            MainPanel.menuManager?.addMenu(menu);
            this.addOverlay(menu.actor);
        } catch (e) {
            Context.logError(`${Desktop.name} failed to add menu.`, e);
        }
    }

    /**
     * @param {PopupMenu|PopupDummyMenu} menu
     */
    removeMenu(menu) {
        if (menu?.actor instanceof St.Widget === false) return;
        try {
            MainPanel.menuManager?.removeMenu(menu);
            this.removeOverlay(menu.actor);
        } catch (e) {
            Context.logError(`${Desktop.name} failed to remove menu.`, e);
        }
    }

    /**
     * @param {St.Widget|Component<St.Widget>} actor
     */
    addOverlay(actor) {
        if (actor instanceof Component && MainLayout.uiGroup) {
            actor.setParent(MainLayout.uiGroup);
            return;
        }
        if (actor instanceof St.Widget === false) return;
        MainLayout.uiGroup?.add_child(actor);
    }

    /**
     * @param {St.Widget|Component<St.Widget>} actor
     */
    removeOverlay(actor) {
        if (actor instanceof Component) {
            actor = actor.actor ?? actor;
        }
        if (actor instanceof St.Widget === false) return;
        MainLayout.uiGroup?.remove_child(actor);
    }

    /**
     * @param {*} client
     * @param {(() => void)?} [callback]
     */
    addClient(client, callback) {
        if (!this.#clients || !client) return;
        if (this.isReady) {
            this.#clients.set(client, null);
            if (typeof callback === 'function') callback();
            return;
        }
        const isValidCallback = typeof callback === 'function';
        this.#clients.set(client, isValidCallback ? callback : null);
        if (!isValidCallback || Context.signals.hasClient(this)) return;
        Context.signals.add(this, [MainLayout, Event.StartupComplete, () => this.#handleStartup()]);
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    queueClient(client, callback) {
        if (!client || typeof callback !== 'function' || !this.#clients?.has(client)) return;
        if (!this.isReady) return Context.logError(`${Desktop.name} is not ready to queue client requests.`);
        this.#clients.set(client, callback);
        Context.jobs.removeAll(this).new(this, Delay.Background).destroy(() => this.#notifyClients());
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

    /**
     * @param {*} client
     * @returns {boolean}
     */
    hasClient(client) {
        return this.#clients?.has(client) ?? false;
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    isQueued(client) {
        return typeof this.#clients?.get(client) === 'function';
    }

    #handleStartup() {
        Context.signals.removeAll(this);
        this.#notifyClients();
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        for (const [client, callback] of this.#clients) {
            if (typeof callback !== 'function') continue;
            this.#clients.set(client, null);
            callback();
        }
    }

}
