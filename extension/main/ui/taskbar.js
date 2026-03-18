/**
 * @typedef {import('gi://Meta').Workspace} Meta.Workspace
 * @typedef {import('../../shared/core/context/jobs.js').Jobs.Job} Job
 * @typedef {import('./base/component.js').Component<St.Widget>} Component
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { DragMotionResult } from 'resource:///org/gnome/shell/ui/dnd.js';
import { WindowManager, XdndHandler } from '../core/shell.js';
import Context from '../core/context.js';
import { ComponentEvent } from './base/component.js';
import { TaskbarClient } from '../services/taskbar.js';
import { ScrollView } from './base/scrollView.js';
import { Separator } from './taskbar/separator.js';
import { ButtonEvent } from './base/button.js';
import { AppButton, AppButtonEvent } from './taskbar/appButton.js';
import { DragAndDropHandler } from './taskbar/dndHandler.js';
import { Animation, AnimationDuration } from './base/animation.js';
import { Config } from '../../shared/utils/config.js';
import { MaxLengthBounds, MaxLengthCalculator } from '../utils/maxLengthCalculator.js';
import { Event, Delay } from '../../shared/enums/general.js';
import { ConfigField, ConfigOptions } from '../../shared/enums/taskbar.js';

const MODULE_NAME = 'Rocketbar__Taskbar';
const APP_ALLOCATION_THRESHOLD = 2;

/** @type {{[prop: string]: *}} */
const AllocationProps = {
    name: `${MODULE_NAME}-Allocation`,
    x_align: Clutter.ActorAlign.START
};

class TaskbarAllocation {

    /** @type {Map<Component, number>?} */
    #allocation = new Map();

    /** @type {Job?} */
    #job = Context.jobs.new(this, Delay.Redraw);

    /** @type {{hover: ?Component, focus: ?AppButton, active: ?AppButton}?} */
    #scrollTargets = { hover: null, focus: null, active: null };

    /** @type {Taskbar?} */
    #taskbar = null;

    /** @type {boolean} */
    #isUpdating = false;

    /** @type {boolean} */
    #isDragMode = false;

    /** @type {boolean} */
    #isWorkspaceChanged = false;

    /** @type {St.BoxLayout?} */
    actor = new St.BoxLayout(AllocationProps);

    /** @type {number} */
    get #allocationSize() {
        let result = 0;
        if (!this.#allocation?.size) return result;
        const apps = new Map();
        const threshold = APP_ALLOCATION_THRESHOLD;
        for (const [source, size] of this.#allocation) {
            if (source instanceof AppButton) {
                const app = source.app;
                const count = apps.get(app) ?? 0;
                if (count >= threshold) continue;
                apps.set(app, count + 1);
            }
            result += size ?? 0;
        }
        return result;
    }

    /** @param {boolean} value */
    set isDragMode(value) {
        if (this.#isDragMode === value) return;
        this.#isDragMode = value;
        if (this.#isDragMode) return;
        this.#scrollToCurrentTarget();
    }

    /** @param {boolean} value */
    set isWorkspaceChanged(value) {
        if (!this.#job) return;
        this.#isWorkspaceChanged = value;
        if (!this.#isWorkspaceChanged) return;
        this.update();
    }

    /**
     * @param {Taskbar} taskbar
     */
    constructor(taskbar) {
        this.#taskbar = taskbar;
    }

    destroy() {
        this.actor?.remove_all_transitions();
        this.#job?.destroy();
        this.#job = null;
        this.#scrollTargets = null;
        this.#taskbar = null;
        this.#allocation?.clear();
        this.#allocation = null;
        this.actor = null;
    }

    /**
     * @param {Component} source
     */
    add(source) {
        if (!source || !this.#allocation) return;
        const rect = source.rect;
        if (!rect) return;
        this.#isUpdating = true;
        const { width } = source.rect;
        this.#allocation.set(source, width);
        this.#job?.reset(Delay.Redraw);
        if (this.#isWorkspaceChanged) this.#update();
        else this.#job?.enqueue(() => this.#update());
    }

    /**
     * @param {Component} source
     */
    remove(source) {
        if (!source || !this.#allocation?.has(source)) return;
        this.#isUpdating = true;
        this.#allocation.delete(source);
        for (const target in this.#scrollTargets) {
            if (this.#scrollTargets[target] !== source) continue;
            this.#scrollTargets[target] = null;
        }
        const delay = this.#isDragMode ? Delay.Scheduled : Delay.Redraw;
        this.#job?.reset(delay).enqueue(() => this.#update());
    }

    /**
     * @param {Component?} source
     */
    scrollIntoView(source) {
        if (!this.#scrollTargets || !source?.isValid || !this.#allocation?.has(source)) return;
        const isAppButton = source instanceof AppButton;
        const { hover: oldHover, focus: oldFocus, active: oldActive } = this.#scrollTargets;
        const hover = (isAppButton ? source.hasHover : source.actor.hover) ? source :
                       oldHover === source ? null : oldHover;
        const focus = isAppButton && source.hasFocus ? source :
                      oldFocus === source ? null : oldFocus;
        const active = isAppButton && source.isActive ? source :
                       oldActive === source ? null : oldActive;
        if (oldHover === hover && oldFocus === focus && oldActive === active) return;
        const delay = hover === source ? Delay.Debounce :
                      !hover && oldHover === source ? Delay.Scheduled : Delay.Redraw;
        this.#scrollTargets = { hover, focus, active };
        this.#scrollToCurrentTarget(delay);
    }

    update() {
        if (!this.#job || this.#isUpdating || !this.#allocation?.size) return;
        this.#job.reset(Delay.Queue).enqueue(() => this.#update());
    }

    async #update() {
        if (!this.#allocation || !this.actor || !this.#taskbar) return;
        this.#isUpdating = false;
        this.actor.remove_all_transitions();
        const { pageSize, scrollSize, scrollPosition } = this.#taskbar;
        const width = this.#allocationSize;
        const scrollOffset = Math.max(0, width - pageSize);
        const duration = width >= scrollSize ?
                         this.#isDragMode ? AnimationDuration.Disabled :
                         AnimationDuration.Faster : AnimationDuration.Slower;
        const delay = width >= scrollSize ? Delay.Idle : Delay.Queue;
        this.#taskbar.scrollLimit = scrollOffset;
        const scrollJob = scrollOffset > scrollPosition ? null :
                          this.#taskbar.scrollToPosition(scrollOffset, true);
        if (!scrollJob) return this.#allocate(duration, delay, width);
        this.#isUpdating = true;
        const scrollJobResult = await scrollJob;
        if (!scrollJobResult || !this.#isUpdating) return;
        this.#isUpdating = false;
        this.#allocate(duration, delay, width);
    }

    /**
     * @param {AnimationDuration} duration
     * @param {Delay} delay
     * @param {number} width
     * @returns {Promise<void>}
     */
    async #allocate(duration, delay, width) {
        if (!this.actor) return;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const animationParams = { width, mode, delay };
        const isFinished = await Animation(this.actor, duration, animationParams);
        if (!isFinished) return;
        if (!this.#isDragMode) this.#scrollToCurrentTarget();
        this.#isWorkspaceChanged = false;
    }

    /**
     * @param {Delay} [delay]
     */
    #scrollToCurrentTarget(delay = Delay.Scheduled) {
        if (this.#isUpdating || !this.#job || !this.#scrollTargets) return;
        this.#job.reset(this.#isWorkspaceChanged ? Delay.Redraw : delay);
        for (const target in this.#scrollTargets) {
            const currentTarget = this.#scrollTargets[target];
            if (!currentTarget?.isValid) continue;
            const deceleration = currentTarget !== this.#scrollTargets.hover;
            this.#job.enqueue(() => this.#scrollToTarget(currentTarget, deceleration));
            return;
        }
    }

    /**
     * @param {Component} target
     * @param {boolean} deceleration
     */
    async #scrollToTarget(target, deceleration) {
        if (!this.#taskbar || this.#isUpdating ||
            !this.#allocation?.has(target) || !target.isValid) return;
        const scrollJob = this.#taskbar.scrollToActor(target, deceleration);
        if (!scrollJob) return;
        const scrollJobResult = await scrollJob;
        if (!scrollJobResult || target instanceof AppButton === false) return;
        target.notifySelf(AppButtonEvent.Motion);
    }

}

export default class Taskbar extends ScrollView {

    /** @type {{[event: string]: (...args) => *}?} */
    #events = {
        [ComponentEvent.Destroy]: data => (this.#handleDestroy(data?.sender), true),
        [ComponentEvent.Init]: data => (this.#handleInit(data?.sender), true),
        [ComponentEvent.DragOver]: data => this.#handleDragOver(data?.target, data?.params),
        [ComponentEvent.AcceptDrop]: () => this.#handleDrop(),
        [AppButtonEvent.Reaction]: data => (this.#allocation?.scrollIntoView(data?.sender), true)
    };

    /** @type {boolean} */
    #isRerendering = true;

    /** @type {TaskbarAllocation?} */
    #allocation = new TaskbarAllocation(this);

    /** @type {Config?} */
    #config = Config(this, ConfigField, settingsKey => this.#handleConfig(settingsKey), ConfigOptions);

    /** @type {Map<Meta.Workspace, Set<Shell.App>>?} */
    #runningApps = Context.getStorage(this.constructor.name);

    /** @type {Map<AppButton, Shell.App>?} */
    #activatedApps = new Map();

    /** @type {Map<Shell.App, AppButton>?} */
    #appButtons = new Map();

    /** @type {TaskbarClient?} */
    #service = new TaskbarClient(() => this.#rerender());

    /** @type {DragAndDropHandler?} */
    #dndHandler = null;

    /** @type {Separator?} */
    #separator = new Separator();

    /** @type {number} */
    #separatorPosition = -1;

    /**
     * @override
     * @type {St.BoxLayout}
     */
    get actor() {
        const result = this.#allocation?.actor;
        if (!result) throw new Error(`${this.constructor.name} is not valid.`);
        return result;
    }

    constructor() {
        super(MODULE_NAME);
        super.actor.add_child(this.actor);
        super.dropEvents = true;
        super.notifyCallback = data => this.#events?.[data?.event]?.(data);
        this.#cleanRunningApps();
        this.#separator?.connect(Event.Hover, () => this.#allocation?.scrollIntoView(this.#separator));
        Context.signals.add(this, [global.workspace_manager,
            Event.WorkspaceRemoved, () => this.#cleanRunningApps()]);
        Context.hooks.add(this, WindowManager, WindowManager._getNthFavoriteApp,
            (_, __, appIndex) => (this.#handleAppActivationShortcut(appIndex), null));
    }

    /**
     * @override
     * @param {St.Widget|Component} parent
     * @param {number} [position]
     * @returns {this}
     */
    setParent(parent, position) {
        Context.desktop.connectInit(this, () => super.setParent(parent, position));
        return this;
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            case ConfigField.enableSeparator:
                this.#rerender();
                break;
            case ConfigField.maxLength:
                this.#updateMaxLength();
                break;
        }
    }

    /**
     * @param {Component} sender
     */
    #handleInit(sender) {
        if (!this.isValid || !sender) return;
        if (sender !== this) return this.#allocation?.add(sender);
        this.#updateMaxLength();
        Context.jobs.shared(this, () => this.#rerender(), Delay.Background);
    }

    /**
     * @param {Component} sender
     */
    #handleDestroy(sender) {
        if (sender === this) return this.#destroy();
        this.#allocation?.remove(sender);
        if (sender instanceof AppButton && this.#activatedApps?.has(sender)) {
            this.#activatedApps.delete(sender);
            this.#rerender();
        }
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.desktop.disconnect(this);
        Context.monitors.disconnect(this);
        Context.hooks.removeAll(this);
        Context.signals.removeAll(this);
        Context.clearStorage(this.constructor.name);
        this.#allocation?.destroy();
        this.#service?.destroy();
        this.#dndHandler?.destroy();
        this.#service = null;
        this.#appButtons?.clear();
        this.#activatedApps?.clear();
        this.#appButtons = null;
        this.#activatedApps = null;
        this.#runningApps = null;
        this.#dndHandler = null;
        this.#separator = null;
        this.#allocation = null;
        this.#config = null;
        this.#events = null;
    }

    /**
     * @param {*} target
     * @param {{x: number, y: number, actor: Clutter.Actor}} params
     * @returns {DragMotionResult}
     */
    #handleDragOver(target, params) {
        if (this.#isRerendering || !this.isValid ||
            !this.#allocation || !this.#appButtons ||
            !this.#separator || !target || !params?.actor) return DragMotionResult.NO_DROP;
        const isXdndTarget = target === XdndHandler;
        if (!isXdndTarget) {
            const isAppButton = !isXdndTarget && target instanceof AppButton;
            const isAppContainer = isAppButton || target?.app instanceof Shell.App;
            if (!isAppContainer || (isAppButton && !target.isValid)) return DragMotionResult.NO_DROP;
            if (isAppContainer && this.#appButtons.has(target.app)) {
                const appButton = this.#appButtons.get(target.app);
                target = appButton?.isValid ? appButton : target;
            }
        }
        if (!this.#dndHandler) {
            this.#allocation.isDragMode = true;
            /** @type {(AppButton|Separator)[]} */
            const competitors = [...this.#appButtons.values()];
            if (this.#service?.favorites) {
                if (!isXdndTarget) this.#separator.lock();
                if (this.#separatorPosition < 0) competitors.push(this.#separator);
                else competitors.splice(this.#separatorPosition, 0, this.#separator);
            }
            this.#dndHandler = new DragAndDropHandler(this, competitors, () => this.#handleDragEnd());
        }
        const dragParams = { target, ...params };
        const competitor = this.#dndHandler.handleDrag(dragParams);
        if (competitor) super.scrollToActor(competitor);
        if (isXdndTarget) return DragMotionResult.CONTINUE;
        return competitor && !this.#dndHandler.hasCandidate ? DragMotionResult.NO_DROP :
               target instanceof AppButton ? DragMotionResult.MOVE_DROP : DragMotionResult.COPY_DROP;
    }

    /**
     * @returns {boolean}
     */
    #handleDrop() {
        const dropResult = this.#dndHandler?.handleDrop();
        if (!dropResult || !this.#activatedApps || !this.#runningApps) return false;
        const [candidate, slots] = dropResult;
        const workspace = this.#service?.workspace;
        const favorites = this.#service?.favorites;
        const candidateApp = candidate.app;
        if (!candidateApp || !workspace) return true;
        const oldAppButton = this.#appButtons?.get(candidateApp);
        const apps = new Set();
        const appButtons = new Map();
        let candidatePosition = -1;
        let separatorPosition = -1;
        for (let i = 0, l = slots.length; i < l; ++i) {
            const actor = slots[i];
            if (actor instanceof Separator) {
                separatorPosition = i;
                continue;
            }
            if (actor instanceof AppButton === false) continue;
            const app = actor.app;
            if (actor === candidate) {
                candidatePosition = i;
            } else if (app === candidateApp) {
                if (actor === oldAppButton) appButtons.set({ app }, actor);
                continue;
            }
            apps.add(app);
            appButtons.set(app, actor);
        }
        const isFavorite = candidatePosition < separatorPosition && !!favorites;
        if (isFavorite && !favorites.canAdd(candidateApp)) {
            candidate.destroy();
            return true;
        }
        this.#runningApps.set(workspace, apps);
        this.#appButtons = appButtons;
        oldAppButton?.destroy();
        if (separatorPosition > 0 &&
            separatorPosition <= apps.size &&
            this.#config?.enableSeparator) this.#separator?.lock();
        if (isFavorite) {
            const favoritePosition = [...apps].indexOf(candidateApp);
            favorites.add(candidateApp, favoritePosition);
            candidate.drop();
            return true;
        }
        if (!isFavorite && !!favorites && favorites.apps.has(candidateApp)) {
            favorites.remove(candidateApp);
            candidate.drop();
            if (!candidate.isRunning) candidate.destroy();
            return true;
        }
        candidate.drop();
        if (!oldAppButton?.isValid) candidate.activate();
        if (oldAppButton) this.#activatedApps.delete(oldAppButton);
        if (!candidate.isRunning) this.#activatedApps.set(candidate, candidateApp);
        return true;
    }

    #handleDragEnd() {
        if (!this.#allocation || !this.isValid) return;
        this.#dndHandler = null;
        this.#separator?.unlock();
        this.#allocation.isDragMode = false;
    }

    #rerender() {
        if (!this.#appButtons || !this.#allocation || !this.#service ||
            !this.hasAllocation || Context.jobs.hasShared(this, Delay.Background)) return;
        this.#isRerendering = true;
        this.#dndHandler?.abort();
        this.#allocation.isWorkspaceChanged = this.#service.isWorkspaceChanged;
        const favoriteApps = this.#service.favorites?.apps;
        const runningApps = this.#getRunningApps();
        const apps = favoriteApps && runningApps ? new Set([...favoriteApps, ...runningApps]) :
                     !favoriteApps && runningApps ? runningApps :
                     !runningApps && favoriteApps ? favoriteApps : null;
        const appsSize = apps?.size;
        if (!appsSize) {
            this.#separatorPosition = -1;
            this.#updateSeparator();
            this.#isRerendering = false;
            return;
        }
        const hasFavoritesApps = !!favoriteApps;
        const favoriteAppsSize = favoriteApps?.size ?? 0;
        const appButtons = new Map();
        const oldFavorites = new Set();
        const sortedAppButtons = [];
        for (const app of apps) {
            const oldAppButton = this.#appButtons.get(app);
            if (oldAppButton?.isValid) {
                const isFavoriteChanged = hasFavoritesApps && this.#separatorPosition !== -1 &&
                                          oldAppButton.isFavorite !== favoriteApps.has(app);
                if (!isFavoriteChanged) {
                    appButtons.set(app, oldAppButton);
                    sortedAppButtons.push(oldAppButton);
                    continue;
                }
                oldFavorites.add(app);
            }
            const newAppButton = new AppButton(app);
            appButtons.set(app, newAppButton);
            sortedAppButtons.push(newAppButton);
        }
        if (oldFavorites.size) {
            const oldAppButtons = new Map();
            for (const [app, appButton] of this.#appButtons) {
                if (oldFavorites.has(app)) {
                    if (!appButton.isFavorite) oldAppButtons.set(app, appButton);
                    oldAppButtons.set({ app }, appButton);
                    appButton.destroy();
                    continue;
                }
                oldAppButtons.set(app, appButton);
            }
            this.#appButtons = oldAppButtons;
        }
        let separatorPosition = hasFavoritesApps ? favoriteAppsSize : -1;
        this.#separatorPosition = separatorPosition;
        const mergedAppButtons = new Map([...this.#appButtons, ...appButtons]);
        if (mergedAppButtons.size !== appButtons.size) {
            let i = -1;
            for (const [app, appButton] of mergedAppButtons) {
                if (!appButton.isValid) continue;
                i++;
                if (appButtons.has(app)) continue;
                appButtons.set(app, appButton);
                sortedAppButtons.splice(i, 0, appButton);
                if (hasFavoritesApps && appButton.isFavorite) separatorPosition++;
            }
        }
        this.#appButtons = appButtons;
        for (let i = 0, l = sortedAppButtons.length; i < l; ++i) {
            sortedAppButtons[i].setParent(this, i);
        }
        const isSeparatorVisible = !!this.#config?.enableSeparator &&
                                   favoriteAppsSize > 0 &&
                                   appsSize > favoriteAppsSize;
        this.#updateSeparator(separatorPosition, isSeparatorVisible);
        this.#isRerendering = false;
    }

    /**
     * @param {number} [position]
     * @param {boolean} [isVisible]
     */
    #updateSeparator(position = this.#separatorPosition, isVisible = false) {
        if (!this.#separator) return;
        this.#separator.setParent(this, position);
        this.#separator.isVisible = isVisible;
    }

    /**
     * @returns {Set<Shell.App>?}
     */
    #getRunningApps() {
        const workspace = this.#service?.workspace;
        if (!this.#service || !workspace || !this.#runningApps) return null;
        let runningApps = this.#service.apps;
        if (this.#activatedApps?.size) {
            runningApps = runningApps ? new Set([...runningApps]) : new Set();
            for (const [appButton, app] of this.#activatedApps) {
                if (!runningApps.has(app) && appButton.isValid) runningApps.add(app);
                else this.#activatedApps.delete(appButton);
            }
        }
        if (!runningApps?.size) this.#runningApps.delete(workspace);
        else if (!this.#runningApps.has(workspace)) this.#runningApps.set(workspace, runningApps);
        else {
            const oldRunningApps = this.#runningApps.get(workspace) ?? new Set();
            const newRunningApps = new Set();
            for (const app of oldRunningApps) {
                if (!runningApps.has(app)) continue;
                newRunningApps.add(app);
            }
            runningApps = new Set([...newRunningApps, ...runningApps]);
            this.#runningApps.set(workspace, runningApps);
        }
        return runningApps;
    }

    #cleanRunningApps() {
        if (!this.#runningApps?.size) return;
        const allWorkspaces = new Set();
        for (let i = 0, l = global.workspace_manager.get_n_workspaces(); i < l; ++i) {
            allWorkspaces.add(global.workspace_manager.get_workspace_by_index(i));
        }
        const cachedWorkspaces = this.#runningApps.keys();
        for (const workspace of cachedWorkspaces) {
            if (allWorkspaces.has(workspace)) continue;
            this.#runningApps.delete(workspace);
        }
    }

    /**
     * @param {number} appIndex
     */
    #handleAppActivationShortcut(appIndex) {
        if (typeof appIndex !== 'number' || !this.#appButtons?.size) return;
        const appButtons = [...this.#appButtons.values()].filter(appButton => appButton.isValid);
        const appButton = appButtons[appIndex];
        const event = Clutter.get_current_event();
        if (!appButton || !event) return;
        appButton.notifySelf(ButtonEvent.Click, { event });
    }

    #updateMaxLength() {
        if (!this.#allocation || !this.#config || !this.isValid) return;
        const { maxLength } = this.#config;
        if (maxLength >= MaxLengthBounds.Max) {
            this.container.set_style(null);
            Context.monitors.disconnect(this);
            this.#allocation.update();
            return;
        }
        const monitorInfo = Context.monitors.getMonitorInfo(this.rect);
        if (!monitorInfo) return;
        const length = MaxLengthCalculator(monitorInfo.width, maxLength);
        this.container.set_style(`max-width: ${length}px;`);
        this.#allocation.update();
        if (Context.monitors.has(this)) return;
        Context.monitors.connect(this, () => this.#updateMaxLength());
    }

}
