/**
 * JSDoc types
 *
 * @typedef {import('gi://Meta').Window} Meta.Window
 * @typedef {import('gi://Mtk').Rectangle} Mtk.Rectangle
 * @typedef {import('../../core/context/jobs.js').Jobs.Job} Job
 * @typedef {import('../../utils/config.js').Config} Config
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { activateWindow as FocusedWindow } from 'resource:///org/gnome/shell/ui/main.js';
import { Overview } from '../../core/shell.js';
import Context from '../../core/context.js';
import { RuntimeButton, ButtonEvent } from '../base/button.js';
import { TaskbarClient } from '../../services/taskbar.js';
import { AppIcon, AppIconAnimation, AppIconEvent } from './appIcon.js';
import { AppConfig, ConfigFields, ActivateBehavior, DemandsAttentionBehavior } from '../../utils/taskbar/appConfig.js';
import { Menu } from './menu.js';
import { NotificationBadge } from './notificationBadge.js';
import { ProgressBar } from './progressBar.js';
import { Tooltip } from './tooltip.js';
import { Indicators } from './indicators.js';
import { NotificationHandler } from '../../services/notifications.js';
import { AppSoundVolumeControl } from '../../services/soundVolume.js';
import { Event, Delay } from '../../core/enums.js';
import { ComponentEvent } from '../base/component.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppButton';

/** @type {{[prop: string]: *}} */
const LayoutProps = {
    name: `${MODULE_NAME}-Layout`,
    x_expand: true,
    y_expand: true
};

/** @enum {string} */
export const AppButtonEvent = {
    Reaction: 'appbutton::reaction'
};

class CycleWindowsQueue {

    /** @type {Meta.Window[]?} */
    #windows = null;

    /** @type {boolean} */
    #minimize = true;

    /**
     * @param {Meta.Window[]} windows
     * @param {boolean} [minimize]
     * @param {boolean} [reverse]
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
            if (reverse) windowIndex--;
            else windowIndex++;
            if (windowIndex === this.#windows.length) {
                windowIndex = 0;
            } else if (windowIndex < 0) {
                windowIndex = this.#windows.length - 1;
            }
            nextWindow = this.#windows[windowIndex];
            if (!nextWindow) return;
        }
        if (!minimize || nextWindow.minimized ||
            nextWindow !== this.#windows[0]) return FocusedWindow(nextWindow);
        for (let i = 0, l = windows.length; i < l; ++i) windows[i].minimize();
        this.#windows = null;
    }

}

/**
 * @augments RuntimeButton<St.Bin>
 */
export class AppButton extends RuntimeButton {

    /** @type {AppConfig?} */
    static #sharedConfig = null;

    /** @type {{[event: string]: (...args) => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [ComponentEvent.Mapped]: () => this.#handleMapped(),
        [ComponentEvent.DragActorRequest]: () => this.#appIcon?.dragActor,
        [ComponentEvent.DragActorSourceRequest]: () => this.#appIcon?.actor,
        [ComponentEvent.Scale]: () => this.#updateStyle(),
        [ButtonEvent.Press]: () => this.#press(),
        [ButtonEvent.Hover]: () => this.#hover(),
        [ButtonEvent.LongPress]: params => this.#longPress(params),
        [ButtonEvent.Click]: params => this.#click(params),
        [ButtonEvent.Focus]: () => this.notifyParents(AppButtonEvent.Reaction),
        [ButtonEvent.RequestMenu]: () => new Menu(this),
        [ButtonEvent.RequestTooltip]: () => new Tooltip(this),
        [AppIconEvent.DominantColorChanged]: () => this.#handleDominantColor()
    };

    /** @type {boolean} */
    #isFavorite = false;

    /** @type {boolean} */
    #isActive = false;

    /** @type {boolean} */
    #isDropCandidate = false;

    /** @type {Config?} */
    #config = null;

    /** @type {Job?} */
    #destroyJob = null;

    /** @type {Shell.App?} */
    #app = null;

    /** @type {AppIcon?} */
    #appIcon = null;

    /** @type {St.Widget?} */
    #layout = null;

    /** @type {TaskbarClient?} */
    #service = null;

    /** @type {Set<Meta.Window>?} */
    #windows = null;

    /** @type {number} */
    #windowsCount = 0;

    /** @type {number} */
    #notificationsCount = 0;

    /** @type {number} */
    #progress = 0;

    /** @type {CycleWindowsQueue?} */
    #cycleWindowsQueue = null;

    /** @type {Indicators?} */
    #indicators = null;

    /** @type {NotificationHandler?} */
    #notificationHandler = null;

    /** @type {NotificationBadge?} */
    #notificationBadge = null;

    /** @type {ProgressBar?} */
    #progressBar = null;

    /** @type {AppSoundVolumeControl?} */
    #soundVolumeControl = null;

    /** @type {boolean} */
    get #isAppRunning() {
        return !!this.#windowsCount || this.#app?.state === Shell.AppState.RUNNING;
    }

    /** @type {boolean} */
    get #canOpenNewWindow() {
        return !!this.#app?.can_open_new_window() && this.#isAppRunning;
    }

    /** @type {Meta.Window[]?} */
    get #sortedWindows() {
        if (!this.#app || !this.#windows || !this.#windowsCount) return null;
        if (this.#windowsCount === 1) return [...this.#windows];
        const windows = this.#app.get_windows();
        if (windows.length === this.#windowsCount) return windows;
        const result = [];
        for (const window of windows) {
            if (this.#windows.has(window)) result.push(window);
        }
        return result;
    }

    /** @type {boolean} */
    get #isFadeInRequired() {
        return !this.isFadeInDone;
    }

    /** @type {Shell.App?} */
    get app() {
        return this.#app;
    }

    /** @type {Set<Meta.Window>?} */
    get windows() {
        return this.#windows;
    }

    /**
     * @override
     * @type {boolean}
     */
    get isActive() {
        return this.#isActive;
    }

    /** @type {AppConfig} */
    get configProvider() {
        AppButton.#sharedConfig ??= new AppConfig();
        return AppButton.#sharedConfig;
    }

    /** @type {number} */
    get windowsCount() {
        return this.#windowsCount;
    }

    /** @type {number} */
    get notificationsCount() {
        return this.#notificationsCount;
    }

    /** @type {number} */
    get progress() {
        return this.#progress;
    }

    /** @type {string?} */
    get dominantColor() {
        return this.#appIcon?.dominantColor ?? null;
    }

    /** @type {AppSoundVolumeControl?} */
    get soundVolumeControl() {
        return this.#soundVolumeControl;
    }

    /** @type {boolean} */
    get isFavorite() {
        return this.#isFavorite;
    }

    /**
     * @override
     * @param {boolean} value
     */
    set isActive(value) {
        if (!this.isValid) return;
        const oldValue = this.#isActive;
        const oldSuperValue = super.isActive;
        this.#isActive = value;
        super.isActive = !Overview._shown && value;
        if (super.isActive !== oldSuperValue) {
            this.#updateBacklight();
            if (!this.#isFadeInRequired) this.#indicators?.rerender();
        }
        if (this.#isActive === oldValue) return;
        if (!this.#isActive) {
            Context.signals.remove(this, Overview);
            return;
        }
        if (!this.#isFadeInRequired) this.notifyParents(AppButtonEvent.Reaction);
        Context.signals.add(this, [
            Overview,
            Event.OverviewShowing, () => { this.isActive = this.#isActive; },
            Event.OverviewHiding, () => { this.isActive = this.#isActive; }
        ]);
    }

    /**
     * @param {Shell.App} app
     * @param {boolean} [isDropCandidate]
     */
    constructor(app, isDropCandidate = false) {
        super(new St.Bin(), MODULE_NAME);
        this.#layout = new St.Widget({ ...LayoutProps, layout_manager: new Clutter.BinLayout() });
        this.#layout.add_child(this.display);
        this.actor.set_child(this.#layout);
        this.dragEvents = true;
        this.#app = app;
        this.#isDropCandidate = isDropCandidate;
        this.actor.set_reactive(!isDropCandidate);
        this.#config = this.configProvider.getConfig(app, this, settingsKey => this.#handleConfig(settingsKey));
        this.#appIcon = new AppIcon(app, this.#config?.iconPath).setParent(this.display);
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.(data?.params));
    }

    /**
     * @override
     */
    destroy() {
        if (!this.isValid) return;
        this.#service?.destroy();
        this.#service = null;
        this.#queueDestroy();
    }

    drop() {
        if (!this.#isDropCandidate) return;
        this.#isDropCandidate = false;
        this.actor.set_reactive(!this.#isDropCandidate);
        this.#handleMapped();
        this.#abortDestroy();
    }

    /**
     * @param {ActivateBehavior?} [activateBehavior]
     */
    activate(activateBehavior) {
        switch (activateBehavior) {
            case ActivateBehavior.MoveWindows:
                this.#moveWindows();
                break;
            case ActivateBehavior.FindWindow:
                const sortedWindows = this.#app?.get_windows();
                if (sortedWindows?.length) FocusedWindow(sortedWindows[0]);
                break;
            case ActivateBehavior.NewWindow:
            default:
                const isOverview = Overview.visible;
                this.#openNewWindow(isOverview);
        }
    }

    /**
     * Note: This function is exposed to simulate AppDisplay's behavior inside the Shell.
     */
    animateLaunch() {
        this.#appIcon?.animate(AppIconAnimation.Activate);
    }

    /**
     * Note: This function is exposed to simulate AppDisplay's behavior inside the Shell.
     *
     * @param {number} x
     * @param {number} y
     */
    animateLaunchAtPos(x, y) {
        if (!this.#appIcon ||
            typeof x !== 'number' ||
            typeof y !== 'number') return;
        const monitorRect = this.monitorRect;
        if (!monitorRect) return;
        const actor = this.#appIcon.dragActor;
        Context.layout.addOverlay(actor);
        actor.set_position(x, y);
        actor.set_pivot_point(0.5, 0.5);
        const [width, height] = actor.get_size();
        const scaledWidth = width * AnimationType.ScaleTriple.scale_x;
        const scaledHeight = height * AnimationType.ScaleTriple.scale_y;
        const scaledX = x - (scaledWidth - width) / 2;
        const scaledY = y - (scaledHeight - height) / 2;
        const originX = Math.min(Math.max(scaledX, monitorRect.x),
                                 monitorRect.x + monitorRect.width - scaledWidth) - scaledX;
        const originY = Math.min(Math.max(scaledY, monitorRect.y),
                                 monitorRect.y + monitorRect.height - scaledHeight) - scaledY;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const animationParams = { ...AnimationType.OpacityMin, ...AnimationType.ScaleTriple,
                                  translation_x: originX, translation_y: originY, mode };
        Animation(actor, AnimationDuration.Slow, animationParams).finally(() => actor.destroy());
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        Context.launcherApi?.disconnect(this);
        if (AppButton.#sharedConfig?.destroy(this.#app, this)) {
            AppButton.#sharedConfig = null;
        }
        this.#service?.destroy();
        this.#service = null;
        this.#soundVolumeControl?.destroy();
        this.#soundVolumeControl = null;
        this.#notificationHandler?.destroy();
        this.#notificationHandler = null;
        this.#windows?.clear();
        this.#windows = null;
        this.#layout = null;
        this.#appIcon = null;
        this.#indicators = null;
        this.#destroyJob = null;
        this.#config = null;
        this.#events = null;
    }

    #handleMapped() {
        if (!this.isValid) return;
        this.#handleConfig();
        if (this.#isDropCandidate) return this.#handleRunningApp();
        this.#service = new TaskbarClient(() => this.#handleAppState(), this.#app);
        this.#notificationHandler = new NotificationHandler(count => this.#handleNotifications(count), this.#app);
        this.#connectSignals();
        this.#handleProgress();
        this.#handleAppState();
    }

    #connectSignals() {
        this.connect(Event.Scroll, (_, event) => this.#scroll(event));
        Context.signals.add(this,
            [global.display, Event.FocusWindow, () => this.#handleFocusedWindow(),
                             Event.WindowDemandsAttention, (_, window) => this.#handleUrgentWindow(window)],
            [global.window_manager, Event.Minimize, (_, actor) => this.#handleWindowState(actor?.meta_window),
                                    Event.Unminimize, (_, actor) => this.#handleWindowState(actor?.meta_window)]);
        Context.launcherApi?.connectProgress(this, () => this.#handleProgress());
    }

    /**
     * @param {string?} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (!this.#config || !this.#appIcon) return;
        switch (settingsKey) {
            case ConfigFields.enableMinimizeAction:
            case ConfigFields.activateBehavior:
            case ConfigFields.demandsAttentionBehavior:
                return;
            case ConfigFields.isolateWorkspaces:
            case ConfigFields.showAllWindows:
                return this.#handleAppState();
            case ConfigFields.enableIndicators:
            case ConfigFields.enableSoundControl:
            case ConfigFields.enableNotificationBadges:
            case ConfigFields.enableProgressBars:
            case ConfigFields.enableTooltips:
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
        if (!this.#config || !this.#app || !this.#layout) return;
        const { enableIndicators,
                enableSoundControl,
                enableNotificationBadges,
                enableProgressBars,
                enableTooltips,
                enableMenus } = this.#config;
        const isFadeInRequired = this.#isFadeInRequired;
        if (enableSoundControl && !this.#soundVolumeControl) {
            this.#soundVolumeControl = new AppSoundVolumeControl(this.#app, () => this.#handleSoundStreams());
        } else if (!enableSoundControl && this.#soundVolumeControl) {
            this.#soundVolumeControl.destroy();
            this.#soundVolumeControl = null;
        }
        if (enableIndicators && !this.#indicators) {
            this.#indicators = new Indicators(this).setParent(this.#layout);
            this.#layout.set_child_above_sibling(this.#indicators.actor, this.display);
            if (!isFadeInRequired) this.#indicators.rerender();
        } else if (!enableIndicators && this.#indicators) {
            this.#indicators.destroy();
            this.#indicators = null;
        }
        if (enableNotificationBadges && !this.#notificationBadge) {
            this.#notificationBadge = new NotificationBadge(this).setParent(this.#layout);
            this.#layout.set_child_above_sibling(this.#notificationBadge.actor, null);
            if (!isFadeInRequired) this.#notificationBadge.rerender();
        } else if (!enableNotificationBadges && this.#notificationBadge) {
            this.#notificationBadge.destroy();
            this.#notificationBadge = null;
        }
        if (enableProgressBars && !this.#progressBar) {
            this.#progressBar = new ProgressBar(this).setParent(this.#layout);
            const notificationBadge = this.#notificationBadge?.actor;
            if (notificationBadge) this.#layout.set_child_below_sibling(this.#progressBar.actor, notificationBadge);
            if (!isFadeInRequired) this.#progressBar.rerender();
        } else if (!enableProgressBars && this.#progressBar) {
            this.#progressBar.destroy();
            this.#progressBar = null;
        }
        if (!enableTooltips) {
            this.tooltip = null;
        }
        if (!enableMenus) {
            this.menu = null;
        }
        this.requestTooltip = enableTooltips;
        this.requestMenu = enableMenus;
    }

    #updateStyle() {
        if (!this.#config) return;
        const { spacingAfter, roundness, width, height } = this.#config;
        const style = { spacingAfter, roundness, width, height };
        this.overrideStyle(style);
        this.notifyParents(ComponentEvent.Mapped);
    }

    /**
     * @returns {boolean}
     */
    #handleDominantColor() {
        this.#updateBacklight();
        this.#indicators?.rerender();
        return true;
    }

    #updateBacklight() {
        if (!this.#config) return;
        let { backlightColor, backlightIntensity, backlightDominantColor } = this.#config;
        if (!super.isActive) {
            backlightIntensity = 0;
        } else if (backlightDominantColor) {
            backlightColor = this.dominantColor ?? backlightColor;
        }
        const style = { backlightColor, backlightIntensity };
        this.overrideStyle(style);
    }

    #handleAppState() {
        if (!this.hasAllocation || !this.#service || !this.#config) return;
        const { isolateWorkspaces, showAllWindows } = this.#config;
        const isFavorite = !!this.#app && !!this.#service.favorites?.apps?.has(this.#app);
        this.#windows = this.#service.queryWindows(isolateWorkspaces, showAllWindows);
        this.#windowsCount = this.#windows?.size ?? 0;
        if (!isFavorite && !this.#windowsCount) return this.#queueDestroy();
        this.#isFavorite = isFavorite;
        this.#notificationHandler?.updatePids();
        this.#soundVolumeControl?.update();
        if (!this.#isActive || !this.#windowsCount) this.#handleFocusedWindow();
        if (this.#windowsCount) this.#handleWindows();
        else if (this.#progress) this.#handleProgress();
        this.#handleRunningApp();
    }

    #handleRunningApp() {
        this.#abortDestroy();
        if (this.#isFadeInRequired) return this.#queueFadeIn();
        this.#indicators?.rerender();
    }

    #abortDestroy() {
        if (!this.#destroyJob) return;
        this.#destroyJob.destroy();
        this.#destroyJob = null;
        this.actor.remove_all_transitions();
        this.notifyParents(ComponentEvent.Mapped);
    }

    #queueFadeIn() {
        const isWorkspaceChanged = this.#service?.isWorkspaceChanged ?? false;
        Context.jobs.new(this).destroy(() => {
            const targetWidth = this.rect?.width ?? 0;
            const { opacity } = this.#isDropCandidate ? AnimationType.OpacityDown : AnimationType.OpacityMax;
            this.fadeIn(targetWidth, opacity)?.then(isShown => {
                if (!isShown) return;
                if (!isWorkspaceChanged) this.#rerenderChildren();
                if (this.#isActive) Context.jobs.new(this, Delay.Queue).destroy(() =>
                this.notifyParents(AppButtonEvent.Reaction));
            });
            if (isWorkspaceChanged) this.#rerenderChildren();
        });
    }

    #queueDestroy() {
        if (this.#destroyJob) return;
        this.#destroyJob = Context.jobs.removeAll(this).new(this).destroy(() => (
        this.fadeOut().then(isHidden => isHidden && super.destroy()),
        this.notifyParents(ComponentEvent.Destroy)));
    }

    #rerenderChildren() {
        this.#indicators?.rerender();
        this.#notificationBadge?.rerender();
        this.#progressBar?.rerender();
    }

    #handleFocusedWindow() {
        if (!this.hasAllocation || !this.#service) return;
        this.isActive = this.#windowsCount ? this.#service.hasFocusedWindow : false;
        if (this.#isActive) this.#rerenderTooltip();
    }

    /**
     * @param {Meta.Window} window
     */
    #handleWindowState(window) {
        if (!this.isValid || !window || !this.#windows?.has(window)) return;
        const animation = window.minimized ? AppIconAnimation.Deactivate : AppIconAnimation.Activate;
        this.#appIcon?.animate(animation);
    }

    #handleWindows() {
        if (!this.isValid || !this.#windows) return;
        for (const window of this.#windows) {
            window.get_icon_geometry = () => this.#getWindowIconGeometry(window);
            if (window.demands_attention) this.#handleUrgentWindow(window);
        }
    }

    /**
     * @param {Meta.Window} window
     */
    #handleUrgentWindow(window) {
        if (!window || !this.#windows?.has(window) || window.has_focus()) return;
        const demandsAttentionBehavior = this.#config?.demandsAttentionBehavior;
        if (demandsAttentionBehavior === DemandsAttentionBehavior.FocusActive && !this.#isActive) return;
        FocusedWindow(window);
    }

    /**
     * @param {number} count
     */
    #handleNotifications(count) {
        this.#notificationsCount = count;
        if (this.#isFadeInRequired) return;
        this.#notificationBadge?.rerender();
        this.#rerenderTooltip();
    }

    #handleProgress() {
        const canHandleProgress = this.#isAppRunning;
        if (!canHandleProgress && !this.#progress) return;
        const appId = this.#notificationHandler?.appId;
        const progress = canHandleProgress && appId ?
                         Context.launcherApi?.progress?.get(appId) ?? 0 : 0;
        if (progress === this.#progress) return;
        this.#progress = progress;
        if (this.#isFadeInRequired) return;
        this.#progressBar?.rerender();
        this.#rerenderTooltip();
    }

    #handleSoundStreams() {
        this.#rerenderTooltip();
        this.#rerenderMenu();
    }

    #rerenderTooltip() {
        const tooltip = this.hasTooltip ? this.tooltip : null;
        if (tooltip instanceof Tooltip === false || !tooltip.isShown) return;
        tooltip.rerender(true);
    }

    #rerenderMenu() {
        const menu = this.hasMenu ? this.menu : null;
        if (menu instanceof Menu === false || !menu.isOpen) return;
        menu.rerender();
    }

    #hover() {
        if (!this.#appIcon) return;
        this.#appIcon.isHighlighted = this.hasHover;
        this.#resetCycleWindowsQueue();
        this.notifyParents(AppButtonEvent.Reaction);
    }

    #press() {
        if (!this.#appIcon) return;
        if (this.actor.pressed) this.#appIcon.animate(AppIconAnimation.Press);
        else this.#appIcon.animate(AppIconAnimation.Release).then(isFinished => {
            if (!isFinished || !this.#appIcon) return;
            this.#appIcon.isHighlighted = this.actor.hover;
        });
    }

    /**
     * @param {{event: Clutter.Event}} params
     * @returns {boolean}
     */
    #longPress(params) {
        if (!params || !params.event) return false;
        const button = params.event.get_button();
        const { isMiddleButton, isCtrlPressed } = this.#getClickDetails({ ...params, button });
        if (!isMiddleButton && !isCtrlPressed) return false;
        if (isCtrlPressed) this.#closeWindows(true);
        return true;
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #scroll(event) {
        const scrollDirection = event?.get_scroll_direction();
        if (scrollDirection !== Clutter.ScrollDirection.UP &&
            scrollDirection !== Clutter.ScrollDirection.DOWN) return Clutter.EVENT_PROPAGATE;
        if (!this.#windowsCount || Context.jobs.hasClient(this)) return Clutter.EVENT_STOP;
        if (Overview.visible) Overview.hide();
        Context.jobs.new(this, Delay.Sleep).destroy(() => null);
        this.#cycleWindows(false, scrollDirection === Clutter.ScrollDirection.UP);
        return Clutter.EVENT_STOP;

    }

    /**
     * @param {{event: Clutter.Event, button: number}} [params]
     * @returns {boolean}
     */
    #click(params) {
        if (this.#service?.isPending || !this.#config) return false;
        const { isSecondaryButton,
                isMiddleButton,
                isCtrlPressed } = this.#getClickDetails(params);
        if (isSecondaryButton) return false;
        if (isCtrlPressed && isMiddleButton) {
            this.#closeWindows();
            return true;
        }
        const newWindow = this.#canOpenNewWindow && (isCtrlPressed || isMiddleButton);
        const isOverview = Overview.visible;
        if (newWindow || !this.#isAppRunning) {
            this.#openNewWindow(!isCtrlPressed && !isMiddleButton && isOverview);
            return true;
        }
        const { isolateWorkspaces, activateBehavior, enableMinimizeAction } = this.#config;
        if (!this.#windowsCount) {
            this.activate(isolateWorkspaces ? activateBehavior : ActivateBehavior.NewWindow);
            return true;
        }
        const sortedWindows = this.#sortedWindows;
        if (!sortedWindows?.length) return true;
        if (isOverview) FocusedWindow(this.#getPrimaryWindow(sortedWindows));
        else if (this.#windowsCount === 1) {
            const window = sortedWindows[0];
            const canFocus = window.minimized || !window.has_focus() ||
                             isCtrlPressed || isMiddleButton;
            if (canFocus) FocusedWindow(window);
            else if (enableMinimizeAction) window.minimize();
        } else this.#cycleWindows(enableMinimizeAction);
        return true;
    }

    /**
     * @param {{event: Clutter.Event, button: number}} [params]
     * @returns {{[key: string]: boolean}}
     */
    #getClickDetails(params) {
        const { event, button } = params ?? {};
        const isSecondaryButton = button === Clutter.BUTTON_SECONDARY;
        const isMiddleButton = button === Clutter.BUTTON_MIDDLE;
        const isCtrlPressed = !event ? false : (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
        return { isSecondaryButton, isMiddleButton, isCtrlPressed };
    }

    /**
     * @param {boolean} [hideOverview]
     */
    #openNewWindow(hideOverview = false) {
        this.#resetCycleWindowsQueue();
        if (hideOverview) Overview.hide();
        this.animateLaunch();
        if (!this.#canOpenNewWindow) return this.#app?.activate();
        this.#app?.open_new_window(-1);
    }

    /**
     * @param {boolean} [closeAll]
     */
    #closeWindows(closeAll = false) {
        this.#resetCycleWindowsQueue();
        const sortedWindows = this.#sortedWindows;
        if (!sortedWindows?.length) return;
        const timestamp = global.get_current_time();
        if (!closeAll) sortedWindows[0].delete(timestamp);
        else for (const window of sortedWindows) window.delete(timestamp);
    }

    #moveWindows() {
        const windows = this.#service?.queryWindows(false, true);
        if (!windows?.size) return;
        const workspace = this.#service?.workspace;
        if (!workspace) return;
        this.animateLaunch();
        const sortedWindows = this.#app?.get_windows();
        for (const window of windows) window.change_workspace(workspace);
        if (Overview.visible || !sortedWindows?.length) return;
        FocusedWindow(sortedWindows[0]);
    }

    /**
     * @param {boolean} [minimize]
     * @param {boolean} [reverse]
     * @returns {void}
     */
    #cycleWindows(minimize = true, reverse = false) {
        if (!this.#windowsCount) return;
        const sortedWindows = this.#sortedWindows;
        if (!sortedWindows?.length) return;
        if (!this.#isActive) return FocusedWindow(this.#getPrimaryWindow(sortedWindows));
        if (sortedWindows.length === 1) return FocusedWindow(sortedWindows[0]);
        this.#cycleWindowsQueue ??= new CycleWindowsQueue();
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
        for (const window of windows) {
            if (window.get_monitor() === primaryMonitor) return window;
        }
        return windows[0];
    }

    /**
     * @param {Meta.Window} window
     * @returns {[success: boolean, geometry: Mtk.Rectangle|null]}
     */
    #getWindowIconGeometry(window) {
        if (!window) return [false, null];
        if (this.#appIcon) return [true, this.#appIcon?.rect];
        window.get_icon_geometry = window.constructor.prototype.get_icon_geometry;
        return window.get_icon_geometry();
    }

}
