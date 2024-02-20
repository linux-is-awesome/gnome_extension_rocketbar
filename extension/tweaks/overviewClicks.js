/**
 * JSDoc types
 *
 * @typedef {import('resource:///org/gnome/shell/ui/overviewControls.js').ControlsManager} ControlsManager
 */

import Clutter from 'gi://Clutter';
import { Overview } from '../core/shell.js';
import { Event } from '../core/enums.js';

export default class {

    /** @type {Clutter.ClickAction?} */
    #clickAction = null;

    /** @type {ControlsManager?} */
    #overviewControls = null;

    constructor() {
        const overviewControls = Overview._overview?._controls;
        if (!overviewControls ||
            typeof Overview.toggle !== 'function' ||
            typeof overviewControls?._toggleAppsPage !== 'function') return;
        this.#clickAction = new Clutter.ClickAction();
        this.#clickAction.connect(Event.Clicked, event => this.#handleClick(event));
        overviewControls.reactive = true;
        overviewControls.add_action(this.#clickAction);
        this.#overviewControls = overviewControls;
    }

    destroy() {
        if (!this.#clickAction || !this.#overviewControls) return;
        this.#overviewControls.reactive = false;
        this.#overviewControls.remove_action(this.#clickAction);
        this.#overviewControls = null;
        this.#clickAction = null;
    }

    /**
     * @param {Clutter.Event} event
     */
    #handleClick(event) {
        switch (event?.get_button()) {
            case Clutter.BUTTON_PRIMARY:
                Overview.toggle();
                break;
            case Clutter.BUTTON_SECONDARY:
                this.#overviewControls?._toggleAppsPage();
                break;
        }
    }

}
