
/**
 * @typedef {import('../../../shared/core/context/signals.js').Signals.SignalTracker} SignalTracker
 * @typedef {import('./windowInfo.js').default} WindowInfo
 */

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Context from '../../core/context.js';
import { WindowPreview } from '../../ui/base/windowPreview.js';
import { Delay, Event } from '../../../shared/enums/general.js';

const IS_NEW_API = typeof Meta.Window.prototype.is_maximized === 'function';
const LEGACY_MAXIMIZE_FLAG = 3; // Meta.MaximizeFlags.BOTH

const WINDOW_JUMP_THRESHOLD = 4;
const MAX_JUMP_PREVENT_ATTEMPTS = 2;

/** @type {{[prop: string]: *}} */
const RoutingHelperProps = {
    name: 'Rocketbar__TaskbarService_RoutingHelper',
    opacity: 0
};

class JumpingWindowTracker {

    /** @type {Meta.Window?} */
    #window = null;

    /** @type {number?} */
    #targetMonitor = null;

    /** @type {number[]} */
    #jumps = [];

    /** @type {number} */
    #attempts = 0;

    /** @type {SignalTracker?} */
    #windowSignals = null;

    /** @type {boolean} */
    isActive = false;

    /**
     * @param {Meta.Window} window
     */
    constructor(window) {
        this.#window = window;
    }

    destroy() {
        this.#finalize(true);
    }

    track() {
        if (!this.#window || this.isActive || this.#attempts >= MAX_JUMP_PREVENT_ATTEMPTS) return;
        const now = Date.now();
        this.#jumps = this.#jumps.filter(time => now - time < Delay.Background);
        if (!this.#jumps.length) {
            this.#targetMonitor = this.#window.get_monitor();
        }
        this.#jumps.push(now);
        if (this.#jumps.length < WINDOW_JUMP_THRESHOLD ||
            !this.#window.maximized_horizontally ||
            !this.#window.maximized_vertically) return;
        this.#preventJumping();
    }

    async #preventJumping() {
        if (!this.#window) return;
        const targetMonitor = this.#targetMonitor ?? this.#window.get_monitor();
        this.#targetMonitor = null;
        this.#jumps = [];
        this.isActive = true;
        this.#attempts++;
        Context.signals.add(this, [this.#window, Event.Unmanaged, () => this.#finalize(true)]);
        if (this.#window.maximized_horizontally &&
            this.#window.maximized_vertically) await this.#run(Event.WindowSizeChanged,
                () => IS_NEW_API ? this.#window?.unmaximize() : this.#window?.unmaximize(LEGACY_MAXIMIZE_FLAG));
        if (this.#canMove(targetMonitor)) await this.#run(Event.WindowPositionChanged,
                () => this.#window?.move_to_monitor(targetMonitor));
        if (!this.#window.maximized_horizontally &&
            !this.#window.maximized_vertically) await this.#run(Event.WindowSizeChanged,
                () => IS_NEW_API ? this.#window?.maximize() : this.#window?.maximize(LEGACY_MAXIMIZE_FLAG));
        this.#finalize();
    }

    /**
     * @param {number} monitor
     * @returns {boolean}
     */
    #canMove(monitor) {
        return !!this.#window &&
               monitor >= 0 && monitor < global.display.get_n_monitors() &&
               monitor !== this.#window.get_monitor();
    }

    /**
     * @param {string} event
     * @param {() => void} callback
     * @returns {Promise<void>}
     */
    #run(event, callback) {
        if (!this.isActive || !this.#window) return Promise.resolve();
        return new Promise(resolve => {
            const finish = () => {
                this.#windowSignals?.destroy();
                Context.jobs.removeAll(this);
                resolve();
            };
            this.#windowSignals = Context.signals.new();
            this.#windowSignals.add([this.#window, event, () => finish()]);
            Context.jobs.new(this, Delay.Scheduled).destroy(() => finish());
            try {
                callback();
            } catch (e) {
                Context.logError(`${this.constructor.name} failed to trigger event ${event}.`, e);
                finish();
            }
        });
    }

    /**
     * @param {boolean} [isUnmanaged]
     */
    #finalize(isUnmanaged = false) {
        this.#windowSignals?.destroy();
        Context.signals.removeAll(this);
        Context.jobs.removeAll(this);
        this.isActive = false;
        this.#windowSignals = null;
        if (!isUnmanaged) return;
        this.#window = null;
    }

}

export default class RoutingHelper {

    /** @type {Clutter.Actor?} */
    #actor = null;

    /** @type {Map<Meta.Window, WindowInfo>?} */
    #windows = new Map();

    /** @type {Map<Meta.Window, JumpingWindowTracker>?} */
    #jumpingWindows = new Map();

    /** @type {boolean} */
    get hasJumpingWindows() {
        return [...this.#jumpingWindows?.values() ?? []].some(tracker => tracker.isActive);
    }

    /**
     * Note: To correctly process monitor and workspace changes,
     *       all windows must be visible on the screen.
     *       Otherwise, some events may not be triggered.
     *       We create invisible window clones to ensure all events are triggered.
     *
     * @param {Map<Meta.Window, WindowInfo>} windows
     */
    constructor(windows) {
        if (!windows?.size) return;
        this.#actor = new Clutter.Actor(RoutingHelperProps);
        this.#windows = windows;
        Context.desktop.addOverlay(this.#actor, true);
        for (const [window, windowInfo] of windows) {
            const windowActor = window.get_compositor_private();
            if (windowActor instanceof Clutter.Actor) windowActor.remove_all_transitions();
            const { app } = windowInfo;
            const name = `${this.#actor.name}-WindowClone_${app.id}`;
            const clone = new WindowPreview(window, name).setSize(1, 1);
            this.#actor.add_child(clone.actor);
        }
    }

    destroy() {
        this.#actor?.destroy();
        this.#actor = null;
        this.#windows = null;
        if (!this.#jumpingWindows) return;
        for (const tracker of this.#jumpingWindows.values()) tracker.destroy();
        this.#jumpingWindows.clear();
        this.#jumpingWindows = null;
    }

    /**
     * Note: This is a workaround to break Mutter's maximized window relocation loop on Wayland
     *       by re-maximizing a jumping window from a floating state:
     *       unmaximize -> move to the target monitor -> maximize.
     *       Every step waits for the related window event or a timeout before the next one.
     *
     * @param {Meta.Window} window
     */
    preventWindowJumping(window) {
        if (!window || !this.#jumpingWindows || !this.#windows?.has(window)) return;
        const tracker = this.#jumpingWindows.get(window) ?? new JumpingWindowTracker(window);
        this.#jumpingWindows.set(window, tracker);
        tracker.track();
    }

}
