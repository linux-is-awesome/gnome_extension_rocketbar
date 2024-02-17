/**
 * JSDoc types
 *
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenu} PopupMenu
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupDummyMenu} PopupDummyMenu
 */

import St from 'gi://St';
import Context from '../context.js';
import { MainLayout, MainPanel } from '../shell.js';
import { Component } from '../../ui/base/component.js';
import { Event, Delay } from '../enums.js';

export default class LayoutManager {

    /** @type {Map<*, (() => void)?>?} */
    #clients = new Map();

    /** @type {boolean} */
    get isStartingUp() {
        return MainLayout._startingUp ?? false;
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
            console.error(`${Context.metadata?.name} unable to add menu.`, e);
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
            console.error(`${Context.metadata?.name} unable to remove menu.`, e);
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
     * @param {() => void} callback
     */
    requestInit(client, callback) {
        if (!this.#clients || !client ||
            typeof callback !== 'function' ||
            typeof this.#clients.get(client) === 'function') return;
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
            typeof callback !== 'function' ||
            typeof this.#clients.get(client) === 'function') return;
        this.#clients.set(client, callback);
        Context.jobs.removeAll(this).new(this, Delay.Background).destroy(() => this.#handleAfterInit());
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    isQueued(client) {
        return typeof this.#clients?.get(client) === 'function';
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
            if (typeof callback === 'function') callback();
        }
    }

}
