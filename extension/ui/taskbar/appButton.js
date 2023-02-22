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
import { Config } from '../../utils/config.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { AppIcon, AppIconAnimation } from './appIcon.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppButton';

/** @enum {string} */
const ActivateBehavior = {
    NewWindow: 'new_window',
    MoveWindows: 'move_windows'
};

/** @enum {string} */
const ConfigFields = {
    isolateWorkspaces: 'taskbar-isolate-workspaces',
    enableMinimizeAction: 'appbutton-enable-minimize-action',
    activateRunningBehavior: 'appbutton-running-app-activate-behavior',
    iconSize: 'appbutton-icon-size',
    iconHPadding: 'appbutton-icon-padding',
    iconVPadding: 'appbutton-icon-vertical-padding',
    spacingAfter: 'appbutton-spacing',
    roundness: 'appbutton-roundness',
    backlightColor: 'appbutton-backlight-color',
    backlightIntensity: 'appbutton-backlight-intensity'
};

/** @type {Object.<string, number>} */
const DefaultProps = {
    width: 0,
    opacity: AnimationType.OpacityMin.opacity
};

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
    next(windows, minimize = true, reverse = false) {
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
        [ComponentEvent.Mapped]: this.#handleMapped,
        [ComponentEvent.DragActorRequest]: () => this.#appIcon.dragActor,
        [ComponentEvent.DragActorSourceRequest]: () => this.#appIcon.actor,
        [ComponentEvent.Scale]: this.#updateStyle,
        [ButtonEvent.Press]: this.#press,
        [ButtonEvent.LongPress]: () => console.log('Button long press'),
        [ButtonEvent.Click]: () => this.#click(data?.params)
    })[data?.event]?.call(this);

    /** @type {boolean} */
    #isActive = false;

    /** @type {Shell.App} */
    #app = null;

    /** @type {AppIcon} */
    #appIcon = null;

    /** @type {St.Widget} */
    #layout = new St.Widget({ name: `${MODULE_NAME}.Layout`, layout_manager: new Clutter.BinLayout() });

    /** @type {TaskbarClient} */
    #service = null;

    /** @type {Set<Meta.Window>} */
    #windows = null;

    /** @type {number} */
    #windowsCount = 0;

    /** @type {CycleWindowsQueue} */
    #cycleWindowsQueue = null;

    /** @type {Promise} */
    #destroyJob = null;

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    /** @type {boolean} */
    get #canOpenNewWindow() {
        return this.#app?.can_open_new_window() && this.#app?.state === Shell.AppState.RUNNING;
    }

    /** @type {Meta.Window[]} */
    get #sortedWindows() {
        if (!this.#app || !this.#windowsCount) return null;
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

    /** @type {boolean} */
    get isActive() {
        return this.#isActive;
    }

    /** @param {boolean} value */
    set isActive(value) {
        if (!this.isValid) return;
        const oldValue = super.isActive;
        super.isActive = !Main.overview?._shown && value;
        if (super.isActive !== oldValue) this.#updateBacklight();
        if (this.#isActive === value) return;
        this.#isActive = value;
        if (!this.#isActive) Context.signals.remove(this, Main.overview);
        else Context.signals.add(this, [
            Main.overview,
            Event.OverviewShowing, () => { this.isActive = this.#isActive; },
            Event.OverviewHiding, () => { this.isActive = this.#isActive; }
        ]);
    }

    /**
     * @param {Shell.App} app
     */
    constructor(app) {
        super(new St.Bin(), MODULE_NAME);
        this.setProps(DefaultProps);
        this.#layout.add_child(this.display);
        this.actor.set_child(this.#layout);
        this.#app = app;
        this.dragEvents = true;
        this.#appIcon = new AppIcon(app).setParent(this.display);
        this.#service = new TaskbarClient(() => this.#handleAppState(), app);
        this.#connectSignals();
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#service?.destroy();
        this.#service = null;
        this.#layout = null;
        this.#appIcon = null;
        this.#windows = null;
    }

    #connectSignals() {
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.connect(Event.Scroll, (_, event) => this.#scroll(event));
        this.connect(Event.Hover, () => this.#hover());
        Context.signals.add(this,
            [global.display, Event.FocusWindow, () => this.#handleFocusedWindow()],
            [global.window_manager, Event.Minimize, (_, actor) => this.#handleWindowState(actor?.meta_window),
                                    Event.Unminimize, (_, actor) => this.#handleWindowState(actor?.meta_window)]);
    }

    #handleMapped() {
        this.#handleConfig();
        this.#handleAppState();
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        if (!this.isValid) return;
        switch (settingsKey) {
            case ConfigFields.isolateWorkspaces:
            case ConfigFields.enableMinimizeAction:
            case ConfigFields.activateRunningBehavior:
                return;
            case ConfigFields.backlightColor:
            case ConfigFields.backlightIntensity:
                return this.#updateBacklight();
            case ConfigFields.iconSize:
            default:
                this.#appIcon.setSize(this.#config.iconSize);
            case ConfigFields.iconHPadding:
            case ConfigFields.iconVPadding:
            case ConfigFields.roundness:
            case ConfigFields.spacingAfter:
                this.#updateStyle();
        }
    }

    #updateStyle() {
        const { spacingAfter, roundness, iconSize, iconHPadding, iconVPadding } = this.#config;
        const width = iconSize + iconHPadding * 2;
        const height = iconSize + iconVPadding * 2;
        this.overrideStyle({ spacingAfter, roundness, width, height });
    }

    #updateBacklight() {
        let { backlightColor, backlightIntensity } = this.#config;
        if (!super.isActive) backlightIntensity = 0;
        this.overrideStyle({ backlightColor, backlightIntensity });
    }

    #handleAppState() {
        if (!this.isMapped) return;
        const { isolateWorkspaces } = this.#config;
        const isFavorite = this.#service.favorites?.apps?.has(this.#app);
        this.#windows = this.#service.queryWindows(isolateWorkspaces, true);
        this.#windowsCount = this.#windows?.size ?? 0;
        if (!isFavorite && !this.#windowsCount) return this.#queueDestroy();
        if (!this.#isActive || !this.#windowsCount) this.#handleFocusedWindow();
        this.#handleStartup();
        this.#setWindowsHooks();
    }

    #handleStartup() {
        if (this.#destroyJob) {
            this.actor.remove_all_transitions();
            this.#destroyJob = null;
        }
        if (this.actor.opacity === AnimationType.OpacityMax.opacity) return;
        const { spacingAfter, iconSize, iconHPadding } = this.#config;
        const width = (iconSize + iconHPadding * 2 + spacingAfter) * this.uiScale * this.globalScale;
        const animationParams = { ...AnimationType.OpacityMax, ...{ width, mode: Clutter.AnimationMode.EASE_OUT_QUAD } };
        Animation(this, AnimationDuration.Default, animationParams).then(() => this.setSize());
    }

    #queueDestroy() {
        if (this.#destroyJob) return;
        const animationParams = { ...DefaultProps, ...{ mode: Clutter.AnimationMode.EASE_OUT_QUAD } };
        this.#destroyJob = Animation(this, AnimationDuration.Slow, animationParams).then(() => this.destroy());
    }

    #handleFocusedWindow() {
        if (!this.isMapped) return;
        this.isActive = this.#windowsCount ? this.#service.hasFocusedWindow() : false;
    }

    #handleWindowState(window) {
        if (!this.isValid || !window || !this.#windows?.has(window)) return;
        this.#appIcon.animate(window.minimized ? AppIconAnimation.Deactivate : AppIconAnimation.Activate);
    }

    async #setWindowsHooks() {
        if (!this.isValid || !this.#windows?.size) return;
        for (const window of this.#windows) {
            window.get_icon_geometry = () => this.#getWindowIconGeometry(window);
        }
    }

    #hover() {
        this.#resetCycleWindowsQueue();
    }

    #press() {
        if (this.actor.pressed) this.#appIcon.animate(AppIconAnimation.Press);
        else this.#appIcon.animate(AppIconAnimation.Release);
    }

    /**
     * @param {Clutter.Event} event
     * @returns {number}
     */
    #scroll(event) {
        const scrollDirection = event?.get_scroll_direction();
        if (scrollDirection !== Clutter.ScrollDirection.UP &&
            scrollDirection !== Clutter.ScrollDirection.DOWN) return Clutter.EVENT_PROPAGATE;
        if (!this.#windowsCount || Context.jobs.hasClient(this)) return Clutter.EVENT_STOP;
        if (Main.overview?.visible) Main.overview.hide();
        Context.jobs.new(this, Delay.Sleep).destroy(() => null);
        this.#cycleWindows(false, scrollDirection === Clutter.ScrollDirection.UP);
        return Clutter.EVENT_STOP;

    }

    /**
     * @param {{ event: Clutter.Event, button: number }} params
     * @returns {void}
     */
    #click(params) {
        if (!params || this.#service.isPending) return;
        const { isOverview, isMiddleButton, isCtrlPressed } = this.#getClickDetails(params);
        if (isCtrlPressed && isMiddleButton) return this.#closeFirstWindow();
        const newWindow = this.#canOpenNewWindow && (isCtrlPressed || isMiddleButton);
        if (newWindow || this.#app.state !== Shell.AppState.RUNNING)
            return this.#openNewWindow(!isCtrlPressed && !isMiddleButton && isOverview);
        const { isolateWorkspaces, activateRunningBehavior, enableMinimizeAction } = this.#config;
        if (!this.#windowsCount) {
            if (!isolateWorkspaces) return this.#openNewWindow(isOverview); 
            switch (activateRunningBehavior) {
                case ActivateBehavior.MoveWindows: return this.#moveWindows();
                case ActivateBehavior.NewWindow:
                default: return this.#openNewWindow(isOverview);
            }
        }
        if (isOverview) return Main.activateWindow(this.#getPrimaryWindow(this.#sortedWindows));
        if (this.#windowsCount === 1) {
            const window = this.#sortedWindows[0];
            if (window.minimized || !window.has_focus() ||
                isCtrlPressed || isMiddleButton) Main.activateWindow(window);
            else if (enableMinimizeAction) window.minimize();
            return;
        }
        this.#cycleWindows(enableMinimizeAction);
    }

    #getClickDetails(params) {
        const { event, button } = params;
        const isOverview = Main.overview?.visible;
        const isMiddleButton = button === Clutter.BUTTON_MIDDLE;
        const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
        return { isOverview, isMiddleButton, isCtrlPressed };
    }

    #openNewWindow(hideOverview = false) {
        this.#resetCycleWindowsQueue();
        if (hideOverview) Main.overview?.hide();
        this.#appIcon.animate(AppIconAnimation.Activate);
        if (this.#app.state !== Shell.AppState.RUNNING || !this.#canOpenNewWindow) return this.#app.activate();
        this.#app.open_new_window(-1);
    }

    #closeFirstWindow() {
        this.#resetCycleWindowsQueue();
        const sortedWindows = this.#sortedWindows;
        if (!sortedWindows?.length) return;
        this.#appIcon.animate(AppIconAnimation.Deactivate);
        sortedWindows[0].delete(global.get_current_time());
    }

    #moveWindows() {
        const windows = this.#service.queryWindows(false, true);
        if (!windows?.size) return;
        const sortedWindows = this.#app.get_windows();
        const workspace = this.#service.workspace
        for (const window of windows) window.change_workspace(workspace);
        if (Main.overview?.visible || !sortedWindows.length) return;
        Main.activateWindow(sortedWindows[0]);
    }

    #cycleWindows(minimize = true, reverse = false) {
        if (!this.#windowsCount) return;
        const sortedWindows = this.#sortedWindows;
        if (!this.#isActive) return Main.activateWindow(this.#getPrimaryWindow(sortedWindows));
        if (sortedWindows.length === 1) return Main.activateWindow(sortedWindows[0]);
        if (!this.#cycleWindowsQueue) {
            this.#cycleWindowsQueue = new CycleWindowsQueue();
        }
        this.#cycleWindowsQueue.next(sortedWindows, minimize, reverse);   
    }

    #resetCycleWindowsQueue() {
        this.#cycleWindowsQueue = null;
    }

    /**
     * @param {Meta.Window[]} windows
     * @returns {Meta.Window}
     */
    #getPrimaryWindow(windows) {
        if (windows.length === 1) return windows[0];
        const primaryMonitor = global.display.get_primary_monitor();
        for (let i = 0, l = windows.length; i < l; ++i) {
            const window = windows[i];
            if (window.get_monitor() === primaryMonitor) return window;
        }
        return windows[0];
    }

    /**
     * @param {Meta.Window} window
     * @returns {[success: boolean, geometry: Meta.Rect]}
     */
    #getWindowIconGeometry(window) {
        if (!window) return [false];
        if (this.#appIcon) return [true, this.#appIcon.rect];
        window.get_icon_geometry = window.constructor.prototype.get_icon_geometry;
        return window.get_icon_geometry();
    }

}
