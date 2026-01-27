/**
 * @typedef {import('gi://GObject').Object} GObject.Object
 * @typedef {import('gi://Meta').Window} Meta.Window
 */

import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { Component } from './component.js';
import { Event } from '../../../shared/enums/general.js';

/**
 * @augments Component<Shell.WindowPreview>
 */
export class WindowPreview extends Component {

    /** @type {Meta.Window?} */
    #window = null;

    /** @type {GObject.Object?} */
    #windowActor = null;

    /** @type {Meta.Window} */
    get window() {
        if (!this.#window) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#window;
    }

    /**
     * @param {Meta.Window} window
     * @param {string?} [name]
     */
    constructor(window, name = null) {
        const windowContainer = new Clutter.Actor();
        super(new Shell.WindowPreview({ name, windowContainer }));
        const layoutManager = new Shell.WindowPreviewLayout();
        windowContainer.layout_manager = layoutManager;
        windowContainer.set_pivot_point(0.5, 0.5);
        this.actor.add_child(windowContainer);
        this.#window = window;
        this.#windowActor = window.get_compositor_private();
        const windowClone = layoutManager.add_window(window);
        if (windowClone) Shell.util_set_hidden_from_pick(windowClone, true);
        this.#windowActor.connectObject(Event.Destroy, () => this.destroy(), this);
        this.connect(Event.Destroy, () => this.#destroy());
        if (typeof name !== 'string') return;
        windowContainer.set_name(`${name}-WindowContainer`);
    }

    #destroy() {
        this.#windowActor?.disconnectObject(this);
        this.#window = null;
        this.#windowActor = null;
    }
}
