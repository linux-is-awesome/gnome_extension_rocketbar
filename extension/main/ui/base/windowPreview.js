/**
 * @typedef {import('gi://Meta').Window} Meta.Window
 * @typedef {import('../../../shared/core/context/signals.js').Signals.SignalTracker} SignalTracker
 */

import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Context from '../../core/context.js';
import { Component } from './component.js';
import { Event } from '../../../shared/enums/general.js';

/**
 * @augments Component<Shell.WindowPreview>
 */
export class WindowPreview extends Component {

    /** @type {Meta.Window?} */
    #window = null;

    /** @type {SignalTracker?} */
    #signals = null;

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
        const windowClone = layoutManager.add_window(window);
        if (windowClone) Shell.util_set_hidden_from_pick(windowClone, true);
        const windowActor = window.get_compositor_private();
        this.#signals = Context.signals.new().add([windowActor,
            Event.Destroy, () => this.destroy()]);
        this.connect(Event.Destroy, () => this.#destroy());
        if (typeof name !== 'string') return;
        windowContainer.set_name(`${name}-WindowContainer`);
    }

    #destroy() {
        this.#signals?.destroy();
        this.#signals = null;
        this.#window = null;
    }

}
