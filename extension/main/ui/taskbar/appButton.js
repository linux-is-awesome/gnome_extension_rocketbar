/**
 * @typedef {import('gi://Shell').App} Shell.App
 * @typedef {import('gi://Mtk').Rectangle} Mtk.Rectangle
 * @typedef {import('../../../shared/core/context/jobs.js').Jobs.Job} Job
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Overview } from '../../core/shell.js';
import Context from '../../core/context.js';
import { TaskbarEvent, TaskbarClient } from '../../services/taskbar.js';
import { NotificationHandler } from '../../services/notifications.js';
import { AppSoundVolumeControl } from '../../services/soundVolume.js';
import { ComponentEvent } from '../base/component.js';
import { RuntimeButton, ButtonEvent } from '../base/button.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';
import { AppIcon, AppIconAnimation, AppIconEvent } from './appIcon.js';
import { Menu } from './menu.js';
import { NotificationBadge } from './notificationBadge.js';
import { ProgressBar } from './progressBar.js';
import { Tooltip } from './tooltip.js';
import { Indicators } from './indicators.js';
import { AppGridDragActor } from './appGridDragActor.js';
import { WindowManager } from '../../utils/taskbar/windowManager.js';
import { AppConfig, ConfigField } from '../../../shared/utils/taskbar/appConfig.js';
import { Event, Delay, Progress } from '../../../shared/enums/general.js';
import { ActivationBehavior, ScrollAction, ColorType } from '../../../shared/enums/taskbar.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppButton';
const SCHEDULED_DESTOY_DELAY = Delay.Scheduled * 5;

/** @type {{[prop: string]: *}} */
const LayoutProps = {
    name: `${MODULE_NAME}-Layout`,
    x_expand: true,
    y_expand: true
};

/** @type {{[primaryAction: ScrollAction]: ScrollAction}} */
export const ScrollAlternativeAction = {
    [ScrollAction.CycleAllWindows]: ScrollAction.CycleRecentWindows,
    [ScrollAction.CycleRecentWindows]: ScrollAction.CycleAllWindows,
    [ScrollAction.ChangeOutputSoundVolume]: ScrollAction.ChangeInputSoundVolume,
    [ScrollAction.ChangeInputSoundVolume]: ScrollAction.ChangeOutputSoundVolume
};

/** @enum {string} */
export const AppButtonEvent = {
    Reaction: 'appbutton::reaction',
    Motion: 'appbutton::motion'
};

/**
 * @augments RuntimeButton<St.Bin>
 */
export class AppButton extends RuntimeButton {

    /** @type {AppConfig?} */
    static #sharedConfig = null;

    /** @type {{[event: string]: (...args) => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [ComponentEvent.Init]: () => this.#handleInit(),
        [ComponentEvent.DragActorRequest]: () => this.#appIcon?.dragActor,
        [ComponentEvent.DragActorSourceRequest]: () => this.#appIcon?.actor,
        [ComponentEvent.DragBegin]: () => this.#handleDragBegin(),
        [ComponentEvent.DragCancelled]: () => this.#handleDragEnd(true),
        [ComponentEvent.DragEnd]: () => this.#handleDragEnd(),
        [ButtonEvent.Hover]: () => this.#hover(),
        [ButtonEvent.Focus]: () => this.notifyParents(AppButtonEvent.Reaction),
        [ButtonEvent.Press]: () => this.#press(),
        [ButtonEvent.LongPress]: params => this.#longPress(params),
        [ButtonEvent.Click]: params => this.#click(params),
        [ButtonEvent.RequestMenu]: () => new Menu(this),
        [ButtonEvent.RequestTooltip]: () => new Tooltip(this),
        [AppButtonEvent.Motion]: () => this.#rerenderTooltip(),
        [AppIconEvent.DominantColorChanged]: () => (this.#handleDominantColor(), true),
        [TaskbarEvent.Focus]: () => this.#handleAppFocus(),
        [TaskbarEvent.Change]: () => this.#handleAppState(),
        [TaskbarEvent.Minimize]: () => this.#appIcon?.animate(AppIconAnimation.Deactivate),
        [TaskbarEvent.Unminimize]: () => this.#appIcon?.animate(AppIconAnimation.Activate)
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

    /** @type {AppGridDragActor?} */
    #appGridDragActor = null;

    /** @type {St.Widget?} */
    #layout = null;

    /** @type {TaskbarClient?} */
    #service = null;

    /** @type {WindowManager?} */
    #windows = null;

    /** @type {boolean} */
    #isRunning = false;

    /** @type {number} */
    #progress = Progress.Min;

    /** @type {Indicators?} */
    #indicators = null;

    /** @type {ProgressBar?} */
    #progressBar = null;

    /** @type {NotificationBadge?} */
    #notificationBadge = null;

    /** @type {NotificationHandler?} */
    #notificationHandler = null;

    /** @type {AppSoundVolumeControl?} */
    #soundVolumeControl = null;

    /** @type {Mtk.Rectangle?} */
    get iconRect() {
        if (!this.#appIcon || !this.#config) return null;
        const centerRect = this.centerRect;
        if (!centerRect) return null;
        const { iconHPadding, iconVPadding, iconSize } = this.#config;
        centerRect.x += iconHPadding;
        centerRect.y += iconVPadding;
        centerRect.height = iconSize;
        centerRect.width = iconSize;
        return centerRect;
    }

    /** @type {Shell.App?} */
    get app() {
        return this.#app;
    }

    /** @type {WindowManager?} */
    get windows() {
        return this.#windows;
    }

    /** @type {AppConfig} */
    get configProvider() {
        AppButton.#sharedConfig ??= new AppConfig();
        return AppButton.#sharedConfig;
    }

    /** @type {NotificationHandler?} */
    get notifications() {
        return this.#notificationHandler;
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

    /** @type {boolean} */
    get isRunning() {
        return this.#isRunning;
    }

    /**
     * @override
     * @type {boolean}
     */
    get isActive() {
        return this.#isActive;
    }

    /**
     * @override
     * @param {boolean} value
     */
    set isActive(value) {
        if (!this.isValid) return;
        const oldValue = this.#isActive;
        const oldSuperValue = super.isActive;
        const isFadeInDone = this.isFadeInDone;
        this.#isActive = value;
        super.isActive = !Overview._shown && value;
        if (super.isActive !== oldSuperValue) {
            this.#updateBacklight();
            if (isFadeInDone) this.#indicators?.rerender();
        }
        if (this.#isActive === oldValue) return;
        if (!this.#isActive) {
            Context.signals.remove(this, Overview);
            return;
        }
        if (isFadeInDone) this.notifyParents(AppButtonEvent.Reaction);
        const overviewHandler = () => {
            this.isActive = this.#isActive;
        };
        Context.signals.add(this, [Overview, Event.Showing, overviewHandler,
                                             Event.Hiding, overviewHandler]);
    }

    /**
     * @param {Shell.App} app
     * @param {boolean} [isDropCandidate]
     */
    constructor(app, isDropCandidate = false) {
        super(new St.Bin(), MODULE_NAME);
        super.notifyCallback = data => this.#events?.[data?.event]?.(data?.params);
        this.#layout = new St.Widget({ ...LayoutProps, layout_manager: new Clutter.BinLayout() });
        this.#layout.add_child(this.display);
        this.actor.set_child(this.#layout);
        this.#app = app;
        this.#isDropCandidate = isDropCandidate;
        this.actor.set_reactive(!isDropCandidate);
        this.#config = this.configProvider.get(app.id, this, settingsKey => this.#handleConfig(settingsKey));
        this.#appIcon = new AppIcon(app, this.#config?.iconPath).setParent(this.display);
        Context.desktop.connectScale(this, () => this.#updateStyle());
    }

    /**
     * @override
     */
    destroy() {
        if (!this.isValid) return;
        this.#destroyService();
        this.#enqueueDestroy();
    }

    drop() {
        if (!this.#isDropCandidate) return;
        this.#isDropCandidate = false;
        this.actor.set_reactive(true);
        this.#handleInit();
        this.#abortDestroy(true);
    }

    /**
     * @param {ActivationBehavior?} [activationBehavior]
     */
    activate(activationBehavior = null) {
        if (!this.#service || !this.#windows) return;
        this.#abortDestroy(true);
        if (!activationBehavior) {
            Overview.hide();
            if (this.#isRunning) return this.#windows.raise();
        }
        this.animateLaunch();
        this.#service.activate(activationBehavior);
    }

    /**
     * Note: This function is exposed to simulate behavior of `AppDisplay.AppIcon`.
     *
     * @deprecated
     * @returns {St.Widget?}
     */
    get_parent() {
        return this.parentActor;
    }

    /**
     * Note: This function is exposed to simulate behavior of `AppDisplay.AppIcon`.
     */
    animateLaunch() {
        this.#appIcon?.animate(AppIconAnimation.Activate);
    }

    /**
     * Note: This function is exposed to simulate behavior of `AppDisplay.AppIcon`.
     *
     * @param {number} x
     * @param {number} y
     */
    animateLaunchAtPos(x, y) {
        if (!this.#appIcon ||
            typeof x !== 'number' ||
            typeof y !== 'number') return;
        const monitor = Context.monitors.getMonitorInfo(this.rect);
        if (!monitor) return;
        const actor = this.#appIcon.dragActor;
        Context.desktop.addOverlay(actor);
        actor.set_position(x, y);
        actor.set_pivot_point(0.5, 0.5);
        const [width, height] = actor.get_size();
        const scaledWidth = width * AnimationType.ScaleTriple.scale_x;
        const scaledHeight = height * AnimationType.ScaleTriple.scale_y;
        const scaledX = x - (scaledWidth - width) / 2;
        const scaledY = y - (scaledHeight - height) / 2;
        const originX = Math.min(Math.max(scaledX, monitor.x),
                                 monitor.x + monitor.width - scaledWidth) - scaledX;
        const originY = Math.min(Math.max(scaledY, monitor.y),
                                 monitor.y + monitor.height - scaledHeight) - scaledY;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const animationParams = { ...AnimationType.OpacityMin, ...AnimationType.ScaleTriple,
                                  translation_x: originX, translation_y: originY, mode };
        Animation(actor, AnimationDuration.Slow, animationParams).finally(() => actor.destroy());
    }

    #destroy() {
        this.#handleDragEnd(true);
        Context.desktop.disconnect(this);
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        Context.launcherApi.disconnect(this);
        if (AppButton.#sharedConfig?.destroy(this.#app?.id, this)) {
            AppButton.#sharedConfig = null;
        }
        this.#destroyService();
        this.#soundVolumeControl?.destroy();
        this.#notificationHandler?.destroy();
        this.#soundVolumeControl = null;
        this.#notificationHandler = null;
        this.#layout = null;
        this.#appIcon = null;
        this.#indicators = null;
        this.#progressBar = null;
        this.#notificationBadge = null;
        this.#destroyJob = null;
        this.#config = null;
        this.#events = null;
        this.#app = null;
    }

    #destroyService() {
        this.#service?.destroy();
        this.#service = null;
        this.#windows?.destroy();
        this.#windows = null;
    }

    #handleInit() {
        if (!this.isValid) return;
        this.#handleConfig();
        if (this.#isDropCandidate) return this.#handleRunningApp();
        this.connect(Event.Scroll, (_, event) => this.#scroll(event));
        this.#service = new TaskbarClient(event => this.#events?.[event]?.(), this.#app);
        this.#windows = new WindowManager(this.#service, this.#appIcon);
        this.#notificationHandler = new NotificationHandler(() => this.#handleNotifications(), this.#app);
        Context.launcherApi.connectProgress(this, () => this.#handleProgress());
        this.#handleAppState();
    }

    /**
     * @param {string?} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (!this.#config || !this.#appIcon) return;
        switch (settingsKey) {
            case ConfigField.enableMinimizeAction:
            case ConfigField.isolateWorkspaces:
            case ConfigField.windowRouting:
            case ConfigField.activationBehavior:
            case ConfigField.preferredMonitor:
            case ConfigField.attentionBehavior:
            case ConfigField.attentionNotificationsBehavior:
            case ConfigField.notificationsBehavior:
            case ConfigField.scrollAction:
                return;
            case ConfigField.enableIndicators:
            case ConfigField.enableSoundControl:
            case ConfigField.enableNotificationBadges:
            case ConfigField.enableProgressBars:
            case ConfigField.enableTooltips:
            case ConfigField.enableMenus:
            case ConfigField.enableDragAndDrop:
                return this.#toggleFeatures();
            case ConfigField.backlightColor:
            case ConfigField.backlightColorType:
            case ConfigField.backlightIntensity:
                return this.#updateBacklight();
            case ConfigField.iconPath:
                this.#appIcon.iconPath = this.#config.iconPath;
                return;
            default:
            case ConfigField.iconSize:
                this.#appIcon.setSize(this.#config.iconSize);
            case ConfigField.iconHPadding:
            case ConfigField.iconVPadding:
            case ConfigField.roundness:
            case ConfigField.spacingAfter:
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
                enableMenus,
                enableDragAndDrop } = this.#config;
        const isFadeInDone = this.isFadeInDone;
        if (enableSoundControl && !this.#soundVolumeControl) {
            this.#soundVolumeControl = new AppSoundVolumeControl(this.#app, () => this.#handleSoundStreams());
        } else if (!enableSoundControl && this.#soundVolumeControl) {
            this.#soundVolumeControl.destroy();
            this.#soundVolumeControl = null;
        }
        if (enableIndicators && !this.#indicators) {
            this.#indicators = new Indicators(this).setParent(this.#layout);
            this.#layout.set_child_above_sibling(this.#indicators.actor, this.display);
            if (isFadeInDone) this.#indicators.rerender();
        } else if (!enableIndicators && this.#indicators) {
            this.#indicators.destroy();
            this.#indicators = null;
        }
        if (enableNotificationBadges && !this.#notificationBadge) {
            this.#notificationBadge = new NotificationBadge(this).setParent(this.#layout);
            this.#layout.set_child_above_sibling(this.#notificationBadge.actor, null);
            if (isFadeInDone) this.#notificationBadge.rerender();
        } else if (!enableNotificationBadges && this.#notificationBadge) {
            this.#notificationBadge.destroy();
            this.#notificationBadge = null;
        }
        if (enableProgressBars && !this.#progressBar) {
            this.#progressBar = new ProgressBar(this).setParent(this.#layout);
            const notificationBadge = this.#notificationBadge?.actor;
            if (notificationBadge) this.#layout.set_child_below_sibling(this.#progressBar.actor, notificationBadge);
            if (isFadeInDone) this.#progressBar.rerender();
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
        this.dragEvents = enableDragAndDrop;
    }

    #updateStyle() {
        if (!this.#config) return;
        const { spacingAfter, roundness, width, height } = this.#config;
        const style = { spacingAfter, roundness, width, height };
        this.overrideStyle(style);
        this.notifyParents(ComponentEvent.Init);
    }

    /**
     * Note: The App Grid can only accept favorite apps, otherwise it throws an exception.
     */
    #handleDragBegin() {
        if (!this.#isFavorite || !this.#appIcon || !this.isValid) return;
        const isAppGridVisible = Overview.visible && !!Overview.dash?.showAppsButton?.checked;
        if (!isAppGridVisible) return;
        this.#appGridDragActor ??= new AppGridDragActor(this, this.#appIcon);
    }

    /**
     * @param {boolean} [isDragCancelled]
     */
    #handleDragEnd(isDragCancelled = false) {
        this.#appGridDragActor?.destroy(isDragCancelled);
        this.#appGridDragActor = null;
    }

    #handleDominantColor() {
        this.#updateBacklight();
        this.#indicators?.rerender();
    }

    #updateBacklight() {
        if (!this.#config) return;
        let { backlightColor, backlightIntensity, backlightColorType } = this.#config;
        if (!super.isActive) {
            backlightIntensity = 0;
        } else if (backlightColorType === ColorType.Dominant) {
            backlightColor = this.dominantColor ?? backlightColor;
        }
        const style = { backlightColor, backlightIntensity };
        this.overrideStyle(style);
    }

    #handleAppState() {
        if (!this.#service || !this.#windows || !this.hasAllocation) return;
        const isFavorite = !!this.#app && !!this.#service.favorites?.apps?.has(this.#app);
        this.#windows.update();
        this.#isRunning = !!this.#windows.size;
        this.#handleAppFocus();
        if (!isFavorite && !this.#isRunning) return this.#enqueueDestroy();
        this.#isFavorite = isFavorite;
        this.#handleProgress();
        this.#handleRunningApp();
    }

    #handleAppFocus() {
        if (!this.#service || !this.#windows || !this.hasAllocation) return;
        this.isActive = this.#isRunning ? this.#service.hasFocus : false;
        this.#windows.hasFocus = this.#isActive;
        this.#rerenderTooltip();
    }

    #handleRunningApp() {
        this.#abortDestroy();
        if (!this.isFadeInDone) return this.#enqueueFadeIn();
        this.#indicators?.rerender();
        this.#rerenderMenu();
    }

    /**
     * @param {boolean} [isRescheduling]
     */
    #abortDestroy(isRescheduling = false) {
        if (!this.#destroyJob) return;
        this.#destroyJob.destroy();
        this.#destroyJob = null;
        this.actor.remove_all_transitions();
        this.notifyParents(ComponentEvent.Init);
        if (!isRescheduling) return;
        this.#enqueueDestroy(SCHEDULED_DESTOY_DELAY);
    }

    #enqueueFadeIn() {
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

    /**
     * @param {number} delay
     */
    #enqueueDestroy(delay = Delay.Idle) {
        if (this.#destroyJob && this.#service) return;
        this.#destroyJob = Context.jobs.replace(this, delay).destroy(() => (
        this.fadeOut().then(isHidden => isHidden && super.destroy()),
        this.notifyParents(ComponentEvent.Destroy)));
    }

    #rerenderChildren() {
        this.#indicators?.rerender();
        this.#notificationBadge?.rerender();
        this.#progressBar?.rerender();
    }

    #handleNotifications() {
        if (!this.isFadeInDone) return;
        this.#notificationBadge?.rerender();
        this.#rerenderTooltip();
    }

    #handleProgress() {
        const canHandleProgress = !!this.#app?.get_windows().length;
        if (!canHandleProgress && !this.#progress) return;
        const appId = this.#notificationHandler?.appId;
        const progress = canHandleProgress && appId ?
                         Context.launcherApi.progress?.get(appId) ?? Progress.Min :
                         Progress.Min;
        if (progress === this.#progress) return;
        this.#progress = progress;
        if (!this.isFadeInDone) return;
        this.#progressBar?.rerender();
        this.#rerenderTooltip();
    }

    #handleSoundStreams() {
        this.#rerenderTooltip();
        this.#rerenderMenu();
    }

    #hover() {
        if (!this.#appIcon) return;
        this.#appIcon.isHighlighted = this.hasHover;
        this.#windows?.resetQueue();
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
        if (!this.#windows || !params || !params.event) return false;
        const button = params.event.get_button();
        const { isPrimaryButton,
                isMiddleButton,
                isCtrlPressed } = this.#getClickDetails({ ...params, button });
        if (isPrimaryButton && isCtrlPressed) this.#windows.minimize();
        else if (isMiddleButton && isCtrlPressed) this.#windows.close(true);
        else if (isMiddleButton) this.#windows.raise();
        else return false;
        return true;
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #scroll(event) {
        if (!this.#config) return Clutter.EVENT_PROPAGATE;
        const scrollDirection = event?.get_scroll_direction();
        if (scrollDirection !== Clutter.ScrollDirection.UP &&
            scrollDirection !== Clutter.ScrollDirection.DOWN) return Clutter.EVENT_PROPAGATE;
        const { scrollAction } = this.#config;
        if (!scrollAction || scrollAction === ScrollAction.None) return Clutter.EVENT_PROPAGATE;
        const isDirectionUp = scrollDirection === Clutter.ScrollDirection.UP;
        const isCtrlPressed = !!(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
        const action = isCtrlPressed ? ScrollAlternativeAction[scrollAction] : scrollAction;
        switch (action) {
            case ScrollAction.CycleAllWindows:
            case ScrollAction.CycleRecentWindows:
                if (!this.#isRunning || !this.#windows) return Clutter.EVENT_STOP;
                const isCycleRecent = action === ScrollAction.CycleRecentWindows;
                if (isCycleRecent) this.#windows.resetQueue();
                this.#windows.cycle(false, isDirectionUp && !isCycleRecent, true);
                if (this.#windows.size > 1 && !this.tooltip?.isShown) this.tooltip?.show(true);
                break;
            case ScrollAction.ChangeInputSoundVolume:
            case ScrollAction.ChangeOutputSoundVolume:
                if (!this.#soundVolumeControl) return Clutter.EVENT_STOP;
                const multiplier = isDirectionUp ? 1 : -1;
                const isInput = action === ScrollAction.ChangeInputSoundVolume;
                if (isInput && !this.#soundVolumeControl.hasInput) return Clutter.EVENT_STOP;
                if (!isInput && !this.#soundVolumeControl.hasOutput) return Clutter.EVENT_STOP;
                if (isInput) this.#soundVolumeControl.changeInputVolume(multiplier);
                else this.#soundVolumeControl.changeOutputVolume(multiplier);
                if (!this.tooltip?.isShown) this.tooltip?.show(true);
                this.#rerenderTooltip();
                break;
        }
        return Clutter.EVENT_STOP;
    }

    /**
     * @param {{event: Clutter.Event, button: number}} [params]
     * @returns {boolean}
     */
    #click(params) {
        if (!this.#service || !this.#windows ||
            !this.#config || !this.isFadeInDone) return true;
        const { isSecondaryButton,
                isMiddleButton,
                isCtrlPressed } = this.#getClickDetails(params);
        if (isSecondaryButton) return false;
        const isPrimaryAction = !isCtrlPressed && !isMiddleButton;
        if (isMiddleButton && isCtrlPressed) this.#windows.close();
        else if (this.#isRunning && isPrimaryAction) this.#windows.cycle(this.#config.enableMinimizeAction);
        else this.activate(isPrimaryAction ? null : ActivationBehavior.Default);
        return true;
    }

    /**
     * @param {{event: Clutter.Event, button?: number?}} [params]
     * @returns {{[key: string]: boolean}}
     */
    #getClickDetails(params) {
        const { event, button } = params ?? {};
        const isPrimaryButton = button === Clutter.BUTTON_PRIMARY;
        const isSecondaryButton = button === Clutter.BUTTON_SECONDARY;
        const isMiddleButton = button === Clutter.BUTTON_MIDDLE;
        const isCtrlPressed = !!(event && event.get_state() & Clutter.ModifierType.CONTROL_MASK);
        return { isPrimaryButton, isSecondaryButton, isMiddleButton, isCtrlPressed };
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

}
