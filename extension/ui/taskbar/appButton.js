/* exported AppButton */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { Main } from '../../core/legacy.js';
import { Context } from '../../core/context.js';
import { Event, Delay } from '../../core/enums.js';
import { Button, ButtonEvent } from '../base/button.js';
import { ComponentEvent } from '../base/component.js';
import { TaskbarClient } from '../../services/taskbarService.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppButton';

class CycleWindowsQueue {

    /** @type {Meta.Window[]} */
    #windows = null;

    /** @type {boolean} */
    #minimize = true;

    /**
     * @param {Meta.Window[]} windows
     * @param {boolean} [reverse]
     * @param {boolean} [minimize]
     */
    next(windows, reverse = false, minimize = true) {
        if (!windows?.length) return;
        if (!this.#windows || minimize !== this.#minimize) {
            this.#windows = [...windows];
        }
        this.#minimize = minimize;
        let nextWindow = windows[0];
        if (!nextWindow.minimized) {
            let windowIndex = this.#windows.indexOf(nextWindow);
            if (reverse) windowIndex--; else windowIndex++;
            if (windowIndex === this.#windows.length) {
                windowIndex = 0;
            } else if (windowIndex < 0) {
                windowIndex = this.#windows.length - 1;
            }
            nextWindow = this.#windows[windowIndex];
            if (!nextWindow) return;
        }
        if (!minimize || nextWindow.minimized ||
            nextWindow !== this.#windows[0]) return Main.activateWindow(nextWindow);
        for (let i = 0, l = windows.length; i < l; ++i) windows[i].minimize();
        this.#windows = null;  
    }

}

export class AppButton extends Button {

    /**
     * @param {{event: string, params: *}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Mapped]: () => {},
        [ButtonEvent.Click]: () => this.#click(data?.params)
    })[data?.event]?.call(this);

    /** @type {Shell.App} */
    #app = null;

    /** @type {St.Widget} */
    #layout = new St.Widget({ name: `${MODULE_NAME}.Layout`, layout_manager: new Clutter.BinLayout() });

    /** @type {TaskbarClient} */
    #service = null;

    /** @type {Set<Meta.Window>} */
    #windows = null;

    /** @type {boolean} */
    #isActive = false;

    /** @type {CycleWindowsQueue} */
    #cycleWindowsQueue = null;

    /** @type {boolean} */
    get #canOpenNewWindow() {
        return this.#app?.can_open_new_window() && this.#app?.state === Shell.AppState.RUNNING;
    }

    get #sortedWindows() {
        if (!this.#app || !this.#windows?.size) return null;
        if (this.#windows.size === 1) return [...this.#windows];
        const windows = this.#app.get_windows();
        if (windows.length === this.#windows.size) return windows;
        const result = [];
        for (let i = 0, l = windows.length; i < l; ++i)
            if (this.#windows.has(windows[i])) result.push(windows[i]);
        return result;
    }

    /** @type {Shell.App} */
    get app() {
        return this.#app;
    }

    /**
     * @param {Shell.App} app
     */
    constructor(app) {
        super(new St.Bin({ style_class: 'panel-button' }), MODULE_NAME);
        this.#layout.add_child(this.display);
        this.actor.set_child(this.#layout);
        this.#app = app;
        this.#service = new TaskbarClient(() => this.#handleAppState(), app);
        this.#connectSignals();
        this.#handleAppState();
        // TODO
        this.#setIcon();
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        if (!this.#service) return;
        this.#service?.destroy();
        this.#service = null;
    }

    #connectSignals() {
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.connect(Event.Scroll, (_, event) => this.#scroll(event));
        this.connect(Event.Hover, () => this.#hover());
        Context.signals.add(this, [global.display, Event.FocusWindow, () => this.#rerender()]);
    }

    #handleAppState() {
        if (!this.isValid) return;
        const isFavorite = this.#service.favorites?.apps?.has(this.#app);
        this.#windows = this.#service.queryWindows(true, true);
        if (!isFavorite && !this.#windows?.size) this.destroy();
        else this.#rerender();
    }

    #rerender() {
        if (!this.isValid) return;
        const hasFocusedWindow = (
            global.display.focus_window && this.#windows ?
            this.#windows.has(global.display.focus_window) : false);
        if (this.#isActive === hasFocusedWindow) return;
        this.#isActive = hasFocusedWindow;
    }

    #setIcon() {
        this.display.set_child(this.#app.create_icon_texture(20));
    }

    #hover() {
        this.#resetCycleWindowsQueue();
    }

    #scroll(event) {
        const scrollDirection = event?.get_scroll_direction();
        if (scrollDirection !== Clutter.ScrollDirection.UP &&
            scrollDirection !== Clutter.ScrollDirection.DOWN) return Clutter.EVENT_PROPAGATE;
        if (!this.#windows?.size || Context.jobs.hasClient(this)) return Clutter.EVENT_STOP;
        if (Main.overview?.visible) Main.overview.hide();
        Context.jobs.new(this, Delay.Sleep).destroy(() => null);
        this.#cycleWindows(scrollDirection === Clutter.ScrollDirection.UP, false);
        return Clutter.EVENT_STOP;

    }

    #click(params) {
        if (!params) return;
        const { isOverview, isMiddleButton, isCtrlPressed } = this.#getClickDetails(params);
        if (!isCtrlPressed && !isMiddleButton && isOverview) Main.overview?.hide();
        if (isCtrlPressed && isMiddleButton) return this.#closeFirstWindow();
        const newWindow = this.#canOpenNewWindow && (isCtrlPressed || isMiddleButton);
        if (newWindow || !this.#windows?.size) return this.#openNewWindow();
        if (this.#windows.size === 1 || isOverview) {
            const window = this.#sortedWindows[0];
            if (window.minimized || !window.has_focus() || isOverview) Main.activateWindow(window);
            else window.minimize();
            return;
        }
        this.#cycleWindows();
    }

    #getClickDetails(params) {
        const { event, button } = params;
        const isOverview = Main.overview?.visible;
        const isMiddleButton = button === Clutter.BUTTON_MIDDLE;
        const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
        return { isOverview, isMiddleButton, isCtrlPressed };
    }

    #openNewWindow() {
        this.#resetCycleWindowsQueue();
        if (this.#app.state !== Shell.AppState.RUNNING || !this.#canOpenNewWindow) return this.#app.activate();
        this.#app.open_new_window(-1);
    }

    #closeFirstWindow() {
        this.#resetCycleWindowsQueue();
        const sortedWindows = this.#sortedWindows;
        if (!sortedWindows?.length) return;
        sortedWindows[0].delete(global.get_current_time());
    }

    #cycleWindows(reverse = false, minimize = true) {
        if (!this.#windows?.size) return;
        const sortedWindows = this.#sortedWindows;
        if (!this.#isActive || sortedWindows.length === 1) return Main.activateWindow(sortedWindows[0]);
        if (!this.#cycleWindowsQueue) {
            this.#cycleWindowsQueue = new CycleWindowsQueue();
        }
        this.#cycleWindowsQueue.next(sortedWindows, reverse, minimize);   
    }

    #resetCycleWindowsQueue() {
        this.#cycleWindowsQueue = null;
    }

}
