/**
 * @typedef {import('resource:///org/gnome/shell/ui/overviewControls.js').ControlsManager} ControlsManager
 * @typedef {import('resource:///org/gnome/shell/ui/searchController.js').SearchController} SearchController
 */

import Clutter from 'gi://Clutter';
import { Overview } from '../core/shell.js';
import { Event } from '../../shared/core/enums.js';

export default class {

    /** @type {Clutter.ClickAction?} */
    #clickAction = null;

    /** @type {ControlsManager?} */
    #overviewControls = null;

    /** @type {SearchController?} */
    #searchController = null;

    constructor() {
        const overviewControls = Overview._overview?._controls;
        if (!overviewControls ||
            typeof Overview.toggle !== 'function' ||
            typeof overviewControls?._toggleAppsPage !== 'function') return;
        this.#searchController = Overview.searchController ?? null;
        this.#overviewControls = overviewControls;
        this.#clickAction = new Clutter.ClickAction();
        this.#clickAction.connect(Event.Clicked, event => this.#handleClick(event));
        overviewControls.reactive = true;
        overviewControls.add_action(this.#clickAction);
    }

    destroy() {
        if (!this.#clickAction || !this.#overviewControls) return;
        this.#overviewControls.reactive = false;
        this.#overviewControls.remove_action(this.#clickAction);
        this.#overviewControls = null;
        this.#clickAction = null;
        this.#searchController = null;
    }

    /**
     * @param {Clutter.Event} event
     */
    #handleClick(event) {
        if (this.#searchController?.searchActive) return this.#searchController.reset();
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
