/**
 * @typedef {import('gi://Gio').Settings} Gio.Settings
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenu} PopupMenu
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupDummyMenu} PopupDummyMenu
 * @typedef {import('resource:///org/gnome/shell/ui/modalDialog.js').ModalDialog} ModalDialog
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Context from '../context.js';
import { ModalDialog } from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { MainLayout, MainPanel, Session } from '../shell.js';
import { Component } from '../../ui/base/component.js';
import { Event, SessionMode } from '../../../shared/enums/general.js';

const FONT_SCALE_SETTINGS_KEY = 'text-scaling-factor';

export default class Desktop {

    /** @type {Map<*, () => void>?} */
    #initClients = new Map();

    /** @type {Map<*, () => void>?} */
    #scaleClients = new Map();

    /** @type {St.IconTheme?} */
    #iconTheme = null;

    /** @type {St.Settings?} */
    #settings = null;

    /** @type {St.ThemeContext?} */
    #themeContext = St.ThemeContext.get_for_stage(global.stage);

    /** @type {Gio.Settings?} */
    #uiSettings = MainLayout._interfaceSettings ?? null;

    /** @type {boolean} */
    get isReady() {
        return !MainLayout._startingUp;
    }

    /** @type {boolean} */
    get isLocked() {
        return Session.currentMode === SessionMode.Locksreen ||
               MainLayout.screenShieldGroup?.visible === true;
    }

    /** @type {number} */
    get globalScale() {
        return this.#themeContext?.scale_factor ?? 0;
    }

    /** @type {number} */
    get fontScale() {
        return this.#uiSettings?.get_double(FONT_SCALE_SETTINGS_KEY) ?? 0;
    }

    /** @type {St.IconTheme} */
    get iconTheme() {
        this.#iconTheme ??= new St.IconTheme();
        return this.#iconTheme;
    }

    /** @type {St.Settings} */
    get settings() {
        this.#settings ??= St.Settings.get();
        return this.#settings;
    }

    /** @type {ModalDialog?} */
    get activeModalDialog() {
        const dialogs = MainLayout.modalDialogGroup?.get_children();
        if (!dialogs?.length) return null;
        for (const dialog of dialogs) {
            if (dialog instanceof ModalDialog && dialog.visible) return dialog;
        }
        return null;
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#initClients?.clear();
        this.#scaleClients?.clear();
        this.#initClients = null;
        this.#scaleClients = null;
        this.#themeContext = null;
        this.#iconTheme = null;
        this.#settings = null;
        this.#uiSettings = null;
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
            Context.logError(`${this.constructor.name} failed to add menu.`, e);
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
            Context.logError(`${this.constructor.name} failed to remove menu.`, e);
        }
    }

    /**
     * @param {Clutter.Actor|Component<St.Widget>} actor
     */
    addOverlay(actor) {
        if (MainLayout.uiGroup instanceof St.Widget === false) return;
        if (actor instanceof Component) actor.setParent(MainLayout.uiGroup);
        else if (actor instanceof Clutter.Actor) MainLayout.uiGroup.add_child(actor);
    }

    /**
     * @param {Clutter.Actor|Component<St.Widget>} actor
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
     * @returns {this}
     */
    connectInit(client, callback) {
        if (!this.#initClients || !client ||
            typeof callback !== 'function') return this;
        if (this.isReady) return callback(), this;
        if (!this.#initClients.size) Context.signals.add(this,
            [MainLayout, Event.StartupComplete, () => this.#handleInit()]);
        this.#initClients.set(client, callback);
        return this;
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     * @returns {this}
     */
    connectScale(client, callback) {
        if (!this.#scaleClients || !client ||
            !this.#themeContext || !this.#uiSettings ||
            typeof callback !== 'function') return this;
        if (!this.#scaleClients.size) Context.signals.add(this,
            [this.#themeContext, Event.ScaleFactor, () => this.#notifyClients(this.#scaleClients)],
            [this.#uiSettings, `${Event.Changed}::${FONT_SCALE_SETTINGS_KEY}`, () => this.#notifyClients(this.#scaleClients)]);
        this.#scaleClients.set(client, callback);
        return this;
    }

    /**
     * @param {*} client
     */
    disconnect(client) {
        if (!client || !this.#initClients || !this.#scaleClients) return;
        this.#initClients.delete(client);
        this.#scaleClients.delete(client);
        if (this.#initClients.size || this.#scaleClients.size) return;
        Context.signals.removeAll(this);
    }

    #handleInit() {
        if (!this.#initClients) return;
        Context.signals.remove(this, MainLayout);
        this.#notifyClients(this.#initClients);
        this.#initClients.clear();
    }

    /**
     * @param {Map<*, () => void>?} clients
     */
    #notifyClients(clients) {
        if (!clients?.size) return;
        for (const [_, callback] of clients) callback();
    }

}
