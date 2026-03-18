/**
 * @typedef {import('gi://Meta').Window} Meta.Window
 * @typedef {import('../base/component.js').Component} Component
 */

import Context from '../../core/context.js';
import { WindowMotionTracker } from '../../services/windowMotion.js';
import { PseudoClass } from '../../../shared/enums/general.js';

export class TransparencyManager {

    /** @type {Component?} */
    #panel = null;

    /** @type {WindowMotionTracker?} */
    #motionTracker = null;

    /** @type {Meta.Window?} */
    #maximizedWindow = null;

    /** @type {boolean} */
    #isTransparent = false;

    /** @type {boolean} */
    #isDynamic = false;

    /** @param {boolean} value */
    set isDynamic(value) {
        if (this.#isDynamic === value) return;
        this.#isDynamic = value;
        this.#handleDynamicTransparencyState();
    }

    /**
     * @param {Component} panel
     * @param {boolean} isDynamic
     */
    constructor(panel, isDynamic) {
        this.#panel = panel;
        this.#isDynamic = isDynamic;
        this.#handleDynamicTransparencyState();
    }

    destroy() {
        this.#motionTracker?.destroy();
        this.#motionTracker = null;
        this.#maximizedWindow = null;
        this.#updateStyleClass(false);
        this.#panel = null;
    }

    #handleDynamicTransparencyState() {
        if (this.#isDynamic) {
            this.#motionTracker ??= new WindowMotionTracker(() => this.#toggleTransparency());
            return;
        }
        this.#motionTracker?.destroy();
        this.#motionTracker = null;
        this.#maximizedWindow = null;
        this.#updateStyleClass();
    }

    #toggleTransparency() {
        if (!this.#motionTracker || !this.#panel) return;
        const trackerWindows = this.#motionTracker.windows;
        const panelRect = this.#panel.rect;
        const oldMaximizedWindow = this.#maximizedWindow;
        if (!panelRect || !trackerWindows?.size) {
            this.#maximizedWindow = null;
            this.#updateStyleClass();
            return;
        }
        const monitor = Context.monitors.getMonitorIndex(panelRect);
        if (oldMaximizedWindow &&
            trackerWindows.has(oldMaximizedWindow) &&
            this.#isWindowMaximized(oldMaximizedWindow, monitor)) return;
        this.#maximizedWindow = null;
        for (const window of trackerWindows) {
            if (window === oldMaximizedWindow ||
                !this.#isWindowMaximized(window, monitor)) continue;
            this.#maximizedWindow = window;
            break;
        }
        this.#updateStyleClass();
    }

    /**
     * @param {Meta.Window} window
     * @param {number} monitor
     */
    #isWindowMaximized(window, monitor) {
        return !window.minimized &&
                window.maximized_vertically &&
                window.get_monitor() === monitor;
    }

    /**
     * @param {boolean} [isTransparent]
     */
    #updateStyleClass(isTransparent = !this.#maximizedWindow) {
        if (this.#isTransparent === isTransparent || !this.#panel) return;
        const panel = this.#panel.actor;
        if (isTransparent) panel.add_style_pseudo_class(PseudoClass.Transparent);
        else panel.remove_style_pseudo_class(PseudoClass.Transparent);
        this.#isTransparent = isTransparent;
    }

}
