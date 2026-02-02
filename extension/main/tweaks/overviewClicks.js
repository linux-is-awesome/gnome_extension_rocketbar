/**
 * @typedef {import('resource:///org/gnome/shell/ui/windowPreview.js').WindowPreview} WindowPreview
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { WindowPreview } from 'resource:///org/gnome/shell/ui/windowPreview.js';
import { WorkspacesDisplay } from 'resource:///org/gnome/shell/ui/workspacesView.js';
import { Overview, MainLayout } from '../core/shell.js';
import Context from '../core/context.js';
import { ActorPressHandler } from '../ui/base/actorPressHandler.js';
import { Event } from '../../shared/enums/general.js';

export default class {

    /** @type {ActorPressHandler?} */
    #pressHandler = null;

    /** @type {[x: number, y: number]?} */
    #pointerPosition = null;

    constructor() {
        if (!MainLayout.overviewGroup || typeof Overview.toggle !== 'function') return;
        this.#pressHandler = new ActorPressHandler((...args) => this.#longPress(...args));
        Context.signals.add(this, [MainLayout.overviewGroup,
            Event.Leave, () => this.#pressHandler?.release(),
            Event.ButtonRelease, () => this.#pressHandler?.release((...args) => this.#click(...args)),
            Event.Captured, (_, event) => this.#pressHandler?.press(event, (button, target) =>
                                          this.#getPressResult(event, button, target))]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#pressHandler?.destroy();
        this.#pressHandler = null;
        this.#pointerPosition = null;
    }

    /**
     * @param {Clutter.Event} event
     * @param {number} button
     * @param {Clutter.Actor} target
     * @returns {boolean}
     */
    #getPressResult(event, button, target) {
        this.#pointerPosition = null;
        if (!Overview.visible) return Clutter.EVENT_PROPAGATE;
        if (target instanceof WindowPreview) {
            const isCtrlPressed = !!(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
            if (button === Clutter.BUTTON_MIDDLE ||
               (button === Clutter.BUTTON_PRIMARY && isCtrlPressed)) return Clutter.EVENT_STOP;
        } else if (target instanceof St.ScrollView) {
            if (button !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_STOP;
            const [x, y] = global.get_pointer();
            this.#pointerPosition = [x, y];
            return Clutter.EVENT_PROPAGATE;
        } else if (target === MainLayout.overviewGroup ||
                   target instanceof WorkspacesDisplay) return Clutter.EVENT_STOP;
        this.#pressHandler?.release();
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * @param {Clutter.Event} event
     * @param {Clutter.Actor} target
     */
    #longPress(event, target) {
        this.#pressHandler?.release();
        if (!this.#validatePointerPosition()) return;
        if (target instanceof WindowPreview) return this.#closeWindow(target);
        if (event.get_button() === Clutter.BUTTON_MIDDLE) return;
        this.#toggleOverview(false);
    }

    /**
     * @param {Clutter.Event} event
     * @param {Clutter.Actor} target
     */
    #click(event, target) {
        if (!this.#validatePointerPosition()) return;
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
     * @returns {boolean}
     */
    #validatePointerPosition() {
        if (!this.#pointerPosition) return true;
        const [x, y] = this.#pointerPosition;
        const [currentX, currentY] = global.get_pointer();
        this.#pointerPosition = null;
        return x === currentX && y === currentY;
    }

    /**
     * @param {WindowPreview} windowPreview
     */
    #closeWindow(windowPreview) {
        windowPreview.metaWindow?.delete(global.get_current_time());
    }

}
