/**
 * @typedef {import('resource:///org/gnome/shell/ui/overviewControls.js').ControlsManager} ControlsManager
 * @typedef {import('resource:///org/gnome/shell/ui/searchController.js').SearchController} SearchController
 * @typedef {import('resource:///org/gnome/shell/ui/windowPreview.js').WindowPreview} WindowPreview
 */

import Clutter from 'gi://Clutter';
import { WindowPreview } from 'resource:///org/gnome/shell/ui/windowPreview.js';
import { Overview, MainLayout } from '../core/shell.js';
import Context from '../core/context.js';
import { ActorPressHandler } from '../ui/base/actorPressHandler.js';
import { Event } from '../../shared/enums/general.js';

export default class {

    /** @type {ActorPressHandler?} */
    #pressHandler = null;

    constructor() {
        if (!MainLayout.overviewGroup || typeof Overview.toggle !== 'function') return;
        this.#pressHandler = new ActorPressHandler((...args) => this.#longPress(...args));
        Context.signals.add(this, [MainLayout.overviewGroup,
            Event.Leave, () => this.#pressHandler?.release(),
            Event.ButtonRelease, () => this.#pressHandler?.release((...args) => this.#click(...args)),
            Event.ButtonPress, (_, event) => this.#pressHandler?.press(event, () =>
                Overview.visible ? Clutter.EVENT_STOP :
                (this.#pressHandler?.release(), Clutter.EVENT_PROPAGATE)),
            Event.Captured, (_, event) => this.#pressHandler?.press(event, (button, target) =>
                (button === Clutter.BUTTON_MIDDLE ||
                    (button === Clutter.BUTTON_PRIMARY &&
                        !!(event.get_state() & Clutter.ModifierType.CONTROL_MASK))) &&
                Overview.visible && target instanceof WindowPreview ? Clutter.EVENT_STOP :
                (this.#pressHandler?.release(), Clutter.EVENT_PROPAGATE))]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#pressHandler?.destroy();
        this.#pressHandler = null;
    }

    /**
     * @param {Clutter.Event} event
     * @param {Clutter.Actor} target
     */
    #longPress(event, target) {
        this.#pressHandler?.release();
        if (target instanceof WindowPreview) return this.#closeWindow(target);
        if (event.get_button() === Clutter.BUTTON_MIDDLE) return;
        this.#toggleOverview(false);
    }

    /**
     * @param {Clutter.Event} event
     * @param {Clutter.Actor} target
     */
    #click(event, target) {
        if (target instanceof WindowPreview) return this.#closeWindow(target);
        const button = event.get_button();
        if (button === Clutter.BUTTON_MIDDLE) return;
        this.#toggleOverview(button === Clutter.BUTTON_PRIMARY);
    }

    /**
     * @param {boolean} isPrimaryAction
     */
    #toggleOverview(isPrimaryAction) {
        const searchController = Overview.searchController;
        if (typeof searchController?.reset !== 'function') return;
        if (searchController.searchActive) return searchController.reset();
        if (isPrimaryAction) return Overview.toggle();
        const overviewControls = Overview._overview?._controls;
        if (typeof overviewControls?._toggleAppsPage !== 'function') return;
        overviewControls._toggleAppsPage();
    }

    /**
     * @param {WindowPreview} windowPreview
     */
    #closeWindow(windowPreview) {
        windowPreview.metaWindow?.delete(global.get_current_time());
    }

}
