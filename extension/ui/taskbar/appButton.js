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
import { AppConfig, ConfigFields, ActivateBehavior, DemandsAttentionBehavior } from '../../utils/taskbar/appConfig.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { AppIcon, AppIconAnimation, AppIconEvent } from './appIcon.js';
import { Indicators } from './indicators.js';
import { Menu } from './menu.js';
import { AppSoundVolumeControl } from '../../services/soundVolumeService.js';
import { NotificationHandler } from '../../services/notificationService.js';
import { NotificationBadge } from './notificationBadge.js';
import { ProgressBar } from './progressBar.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppButton';

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

    /** @type {AppConfig} */
    static #configProvider = null;

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
        [ButtonEvent.Click]: () => this.#click(data?.params) ?? true,
        [ButtonEvent.RequestMenu]: () => new Menu(this),
        [AppIconEvent.DominantColorChanged]: () => this.#updateBacklight() ?? this.#indicators?.rerender() ?? true
    })[data?.event]?.call(this);

    /** @type {boolean} */
    #isActive = false;

    /** @type {Shell.App} */
    #app = null;

    /** @type {AppIcon} */
    #appIcon = null;

    /** @type {Indicators} */
    #indicators = null;

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

    /** @type {AppSoundVolumeControl} */
    #soundVolumeControl = null;

    /** @type {Promise} */
    #destroyJob = null;

    /** @type {Object.<string, string|number|boolean>} */
    #config = null;

    /** @type {NotificationHandler} */
    #notificationHandler = null;

    /** @type {NotificationBadge} */
    #notificationBadge = null;

    /** @type {number} */
    #notificationsCount = 0;

    /** @type {number} */
    #progress = 0;

    /** @type {ProgressBar} */
    #progressBar = null;

    /** @type {number} */
    get #isAppRunning() {
        return this.#windowsCount || this.#app?.state === Shell.AppState.RUNNING;
    }

    /** @type {boolean} */
    get #canOpenNewWindow() {
        return this.#app?.can_open_new_window() && this.#isAppRunning;
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

    /** @type {boolean} */
    get #isStartupRequired() {
        return this.actor.opacity !== AnimationType.OpacityMax.opacity;
    }

    /** @type {Shell.App} */
    get app() {
        return this.#app;
    }

    /** @type {boolean} */
    get isActive() {
        return this.#isActive;
    }

    /** @type {number} */
    get windowsCount() {
        return this.#windowsCount;
    }

    /** @type {AppConfig} */
    get configProvider() {
        if (!AppButton.#configProvider) {
            AppButton.#configProvider = new AppConfig();
        }
        return AppButton.#configProvider;
    }

    /** @type {AppSoundVolumeControl} */
    get soundVolumeControl() {
        return this.#soundVolumeControl;
    }

    /** @param {boolean} value */
    set isActive(value) {
        if (!this.isValid) return;
        const oldValue = this.#isActive;
        const oldSuperValue = super.isActive;
        this.#isActive = value;
        super.isActive = !Main.overview?._shown && value;
        if (super.isActive !== oldSuperValue) {
            this.#updateBacklight();
            if (!this.#isStartupRequired) this.#indicators?.rerender();
        }
        if (this.#isActive === oldValue) return;
        if (!this.#isActive) Context.signals.remove(this, Main.overview);
        else Context.signals.add(this, [
            Main.overview,
            Event.OverviewShowing, () => { this.isActive = this.#isActive; },
            Event.OverviewHiding, () => { this.isActive = this.#isActive; }
        ]);
    }

    /** @type {string} */
    get dominantColor() {
        return this.#appIcon?.dominantColor;
    }

    /** @type {number} */
    get notificationsCount() {
        return this.#notificationsCount;
    }

    /** @type {number} */
    get progress() {
        return this.#progress;
    }

    /**
     * @param {Shell.App} app
     */
    constructor(app) {
        super(new St.Bin(), MODULE_NAME);
        this.setProps(DefaultProps);
        this.#layout.add_child(this.display);
        this.actor.set_child(this.#layout);
        this.dragEvents = true;
        this.#app = app;
        this.#config = this.configProvider.getConfig(app, settingsKey => this.#handleConfig(settingsKey));
        this.#appIcon = new AppIcon(app, this.#config.iconPath).setParent(this.display);
        this.#service = new TaskbarClient(() => this.#handleAppState(), app);
        this.#notificationHandler = new NotificationHandler(count => this.#handleNotifications(count), this.#app);
        this.actor.animateLaunch = () => this.#appIcon.animate(AppIconAnimation.Activate);
        this.#connectSignals();
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        Context.launcherApi?.disconnect(this);
        if (AppButton.#configProvider?.destroy(this.#app)) {
            AppButton.#configProvider = null;
        }
        this.#service?.destroy();
        this.#service = null;
        this.#soundVolumeControl?.destroy();
        this.#soundVolumeControl = null;
        this.#notificationHandler?.destroy();
        this.#notificationHandler = null;
        this.#layout = null;
        this.#appIcon = null;
        this.#indicators = null;
        this.#windows = null;
    }

    #connectSignals() {
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.connect(Event.Scroll, (_, event) => this.#scroll(event));
        this.connect(Event.Hover, () => this.#hover());
        Context.signals.add(this,
            [global.display, Event.FocusWindow, () => this.#handleFocusedWindow(),
                             Event.WindowDemandsAttention, (_, window) => this.#handleUrgentWindow(window)],
            [global.window_manager, Event.Minimize, (_, actor) => this.#handleWindowState(actor?.meta_window),
                                    Event.Unminimize, (_, actor) => this.#handleWindowState(actor?.meta_window)]);
        Context.launcherApi?.connectProgress(this, () => this.#handleProgress());
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
            case ConfigFields.activateBehavior:
            case ConfigFields.demandsAttentionBehavior:
                return;
            case ConfigFields.enableIndicators:
            case ConfigFields.enableSoundControl:
            case ConfigFields.enableNotificationBadges:
            case ConfigFields.enableProgressBars:
                return this.#toggleFeatures();
            case ConfigFields.backlightColor:
            case ConfigFields.backlightIntensity:
            case ConfigFields.backlightDominantColor:
                return this.#updateBacklight();
            case ConfigFields.iconPath:
                this.#appIcon.iconPath = this.#config.iconPath;
                return;
            default:
            case ConfigFields.iconSize:
                this.#appIcon.setSize(this.#config.iconSize);
            case ConfigFields.iconHPadding:
            case ConfigFields.iconVPadding:
            case ConfigFields.roundness:
            case ConfigFields.spacingAfter:
                this.#updateStyle();
        }
        if (settingsKey) return;
        this.#appIcon.iconPath = this.#config.iconPath;
        this.#toggleFeatures();
    }

    #toggleFeatures() {
        const { enableIndicators, enableSoundControl, enableNotificationBadges, enableProgressBars } = this.#config;
        const isStartupRequired = this.#isStartupRequired;
        if (enableSoundControl && !this.#soundVolumeControl) {
            this.#soundVolumeControl = new AppSoundVolumeControl(this.#app);
        } else if (!enableSoundControl && this.#soundVolumeControl) {
            this.#soundVolumeControl.destroy();
            this.#soundVolumeControl = null;
        }
        if (enableIndicators && !this.#indicators) {
            this.#indicators = new Indicators(this).setParent(this.#layout);
            this.#layout.set_child_below_sibling(this.#indicators.actor, null);
            if (!isStartupRequired) this.#indicators.rerender();
        } else if (!enableIndicators && this.#indicators) {
            this.#indicators.destroy();
            this.#indicators = null;
        }
        if (enableNotificationBadges && !this.#notificationBadge) {
            this.#notificationBadge = new NotificationBadge(this).setParent(this.#layout);
            this.#layout.set_child_above_sibling(this.#notificationBadge.actor, null);
            if (!isStartupRequired) this.#notificationBadge.rerender();
        } else if (!enableNotificationBadges && this.#notificationBadge) {
            this.#notificationBadge.destroy();
            this.#notificationBadge = null;
        }
        if (enableProgressBars && !this.#progressBar) {
            this.#progressBar = new ProgressBar(this).setParent(this.#layout);
            const notificationBadge = this.#notificationBadge?.actor;
            if (notificationBadge) this.#layout.set_child_below_sibling(this.#progressBar.actor, notificationBadge);
            if (!isStartupRequired) this.#progressBar.rerender();
        } else if (!enableProgressBars && this.#progressBar) {
            this.#progressBar.destroy();
            this.#progressBar = null;
        }
    }

    #updateStyle() {
        const { spacingAfter, roundness, width, height } = this.#config;
        this.overrideStyle({ spacingAfter, roundness, width, height });
    }

    #updateBacklight() {
        let { backlightColor, backlightIntensity, backlightDominantColor } = this.#config;
        if (!super.isActive) backlightIntensity = 0;
        else if (backlightDominantColor) backlightColor = this.dominantColor ?? backlightColor;
        this.overrideStyle({ backlightColor, backlightIntensity });
    }

    #handleAppState() {
        if (!this.isMapped) return;
        const { isolateWorkspaces } = this.#config;
        const isFavorite = this.#service.favorites?.apps?.has(this.#app);
        this.#windows = this.#service.queryWindows(isolateWorkspaces, true);
        this.#windowsCount = this.#windows?.size ?? 0;
        this.#notificationHandler?.updatePids();
        this.#soundVolumeControl?.update();
        if (!isFavorite && !this.#windowsCount) return this.#queueDestroy();
        if (!this.#isActive || !this.#windowsCount) this.#handleFocusedWindow();
        this.#handleStartup();
        this.#handleWindows();
    }

    #handleStartup() {
        Context.jobs.removeAll(this);
        if (this.#destroyJob) {
            this.actor.remove_all_transitions();
            this.#destroyJob = null;
        }
        if (!this.#isStartupRequired) this.#indicators?.rerender();
        else this.#queueStartup();
    }

    #queueStartup() {
        const { spacingAfter } = this.#config;
        const isWorkspaceChanged = this.#service.isWorkspaceChanged;
        const width = (this.#config.width + spacingAfter) * this.uiScale * this.globalScale;
        const animationParams = { ...AnimationType.OpacityMax, ...{ width, mode: Clutter.AnimationMode.EASE_OUT_QUAD } };
        Context.jobs.new(this).destroy(() => {
            Animation(this, AnimationDuration.Default, animationParams).finally(() => {
                this.setSize();
                if (!isWorkspaceChanged) this.#indicators?.rerender();
                this.#notificationBadge?.rerender();
                this.#progressBar?.rerender();
            });
            if (isWorkspaceChanged) this.#indicators?.rerender();
        }).catch();
    }

    #queueDestroy() {
        if (this.#destroyJob) return;
        Context.jobs.removeAll(this).new(this).destroy(() => {
            const animationParams = { ...DefaultProps, ...{ mode: Clutter.AnimationMode.EASE_OUT_QUAD } };
            this.#destroyJob = Animation(this, AnimationDuration.Slow, animationParams).then(() => this.destroy());
        }).catch();
    }

    #handleFocusedWindow() {
        if (!this.isMapped) return;
        this.isActive = this.#windowsCount ? this.#service.hasFocusedWindow() : false;
    }

    #handleWindowState(window) {
        if (!this.isValid || !window || !this.#windows?.has(window)) return;
        this.#appIcon.animate(window.minimized ? AppIconAnimation.Deactivate : AppIconAnimation.Activate);
    }

    async #handleWindows() {
        if (!this.isValid || !this.#windows?.size) return;
        for (const window of this.#windows) {
            window.get_icon_geometry = () => this.#getWindowIconGeometry(window);
            if (window.demands_attention) this.#handleUrgentWindow(window);
        }
    }

    /**
     * @param {Meta.Window} window
     */
    async #handleUrgentWindow(window) {
        if (!window || !this.#windows?.has(window) || window.has_focus()) return;
        if (this.#config.demandsAttentionBehavior === DemandsAttentionBehavior.FocusActive && !this.#isActive) return;
        Main.activateWindow(window);
    }

    /**
     * @param {number} count
     */
    #handleNotifications(count) {
        this.#notificationsCount = count;
        if (!this.#isStartupRequired) this.#notificationBadge?.rerender();
    }

    #handleProgress() {
        const appId = this.#notificationHandler?.appId;
        const progress = Context.launcherApi?.progress?.get(appId) ?? 0;
        if (progress === this.#progress) return;
        this.#progress = progress;
        if (!this.#isStartupRequired) this.#progressBar?.rerender();
    }

    #hover() {
        this.#appIcon.isHighlighted = this.actor.hover;
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
        const { isOverview, isSecondaryButton, isMiddleButton, isCtrlPressed } = this.#getClickDetails(params);
        if (isSecondaryButton) return false;
        if (isCtrlPressed && isMiddleButton) return this.#closeFirstWindow();
        const newWindow = this.#canOpenNewWindow && (isCtrlPressed || isMiddleButton);
        if (newWindow || !this.#isAppRunning) return this.#openNewWindow(!isCtrlPressed && !isMiddleButton && isOverview);
        const { isolateWorkspaces, activateBehavior, enableMinimizeAction } = this.#config;
        if (!this.#windowsCount) {
            if (!isolateWorkspaces) return this.#openNewWindow(isOverview); 
            switch (activateBehavior) {
                case ActivateBehavior.MoveWindows: return this.#moveWindows();
                case ActivateBehavior.FindWindow:
                    const sortedWindows = this.#app.get_windows();
                    if (sortedWindows.length) return Main.activateWindow(sortedWindows[0]);
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

    /**
     * @param {{ event: Clutter.Event, button: number }} params
     * @returns {Object.<string, boolean>}
     */
    #getClickDetails(params) {
        const { event, button } = params;
        const isOverview = Main.overview?.visible;
        const isSecondaryButton = button === Clutter.BUTTON_SECONDARY;
        const isMiddleButton = button === Clutter.BUTTON_MIDDLE;
        const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
        return { isOverview, isSecondaryButton, isMiddleButton, isCtrlPressed };
    }

    /**
     * @param {boolean} [hideOverview]
     */
    #openNewWindow(hideOverview = false) {
        this.#resetCycleWindowsQueue();
        if (hideOverview) Main.overview?.hide();
        this.actor.animateLaunch();
        if (!this.#canOpenNewWindow) return this.#app.activate();
        this.#app.open_new_window(-1);
    }

    #closeFirstWindow() {
        this.#resetCycleWindowsQueue();
        const sortedWindows = this.#sortedWindows;
        if (!sortedWindows?.length) return;
        sortedWindows[0].delete(global.get_current_time());
    }

    #moveWindows() {
        const windows = this.#service.queryWindows(false, true);
        if (!windows?.size) return;
        this.actor.animateLaunch();
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
