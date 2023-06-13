/* exported Taskbar */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import { Main, Dnd } from '../core/legacy.js';
import { Context } from '../core/context.js';
import { Type, Event, Delay } from '../core/enums.js';
import { ComponentEvent } from './base/component.js';
import { ScrollView } from './base/scrollView.js';
import { TaskbarClient } from '../services/taskbarService.js';
import { AppButton, AppButtonEvent } from './taskbar/appButton.js';
import { Separator } from './taskbar/separator.js';
import { Config } from '../utils/config.js';
import { Animation, AnimationDuration } from './base/animation.js';

const MODULE_NAME = 'Rocketbar__Taskbar';
const APP_ALLOCATION_THRESHOLD = 2;

/** @enum {string} */
const ConfigFields = {
    enableSeparator: 'taskbar-enable-separator',
    showAllWindows: 'taskbar-show-all-windows',
    isolateWorkspaces: 'taskbar-isolate-workspaces'
};

/** @type {Object.<string, boolean|number>} */
const AllocationProps = {
    name: `${MODULE_NAME}-Allocation`,
    x_align: Clutter.ActorAlign.START
};

/**
 * @typedef {import('./base/component.js').Component} Component
 * @param {Component} competitor
 * @param {Meta.Rectangle} [xyRect]
 * @returns {{rect: Meta.Rectangle, competitor: Component}}
 */
const DropCompetitor = (competitor, xyRect) => {
    const rect = competitor.rect;
    if (xyRect) {
        [rect.x, rect.y] = [xyRect.x, xyRect.y];
    } else {
        const allocation = competitor.actor.get_allocation_box();
        [rect.x, rect.y] = [allocation.x1, allocation.y1];
    }
    return { competitor, rect };
};

class DragAndDropHandler {

    /** @type {DropCompetitor[]} */
    #slots = [];

    /** @type {Component} */
    #parent = null;

    /** @type {AppButton} */
    #candidate = null;

    /** @type {number} */
    #candidatePosition = -1;

    /** @type {() => void} */
    #destroyCallback = null;

    /** @type {Meta.Rectangle} */
    get #parentRect() {
        const rect = this.#parent.rect;
        const [x, y] = this.#parent.actor.get_transformed_position();
        [rect.x, rect.y] = [rect.x - x, rect.y - y];
        return rect;
    }

    /**
     * @param {Component} parent
     * @param {Component[]} competitors
     * @param {() => void} destroyCallback
     */
    constructor(parent, competitors, destroyCallback) {
        if (!parent || !competitors) return;
        this.#parent = parent;
        for (const competitor of competitors) {
            if (!competitor.isValid) continue;
            this.#slots.push(DropCompetitor(competitor));
        }
        if (typeof destroyCallback !== Type.Function) return;
        this.#destroyCallback = destroyCallback;
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#slots = null;
        this.#parent = null;
        this.#candidate?.destroy();
        this.#candidate = null;
        if (typeof this.#destroyCallback === Type.Function) this.#destroyCallback();
        this.#destroyCallback = null;
    }

    /**
     * @param {{x: number, y:number, target: *, actor: Clutter.Actor}} params
     * @returns {Component|null}
     */
    handleDrag(params) {
        if (!params || !this.#slots || !this.#parent) return null;
        const { target, actor } = params;
        this.#watchDragActor(actor);
        const x = this.#parentRect.x + params.x;
        const slots = [];
        for (let i = 0, l = this.#slots.length; i < l; ++i) {
            if (!this.#slots[i].competitor?.isValid) continue;
            slots.push(this.#slots[i]);
        }
        this.#slots = slots;
        let slotRect = null;
        let position = this.#slots.length;
        if (this.#candidatePosition > position) {
            this.#candidatePosition = position;
        }
        for (let i = 0, l = position; i < l; ++i) {
            const rect = this.#slots[i].rect;
            if (x < rect.x || x > rect.x + rect.width) continue;
            position = i;
            slotRect = rect;
            break;
        }
        const competitorAtPosition = this.#slots[position]?.competitor;
        const competitorBeforePosition = this.#slots[position - 1]?.competitor;
        const lastSlotPosition = this.#slots.length - 1;
        if (target === competitorBeforePosition && position === lastSlotPosition) {
            position++;
            slotRect = null;
        } else if (target === competitorAtPosition || target === competitorBeforePosition) {
            this.#candidate?.destroy();
            this.#candidate = null;
            return competitorAtPosition;
        }
        if (this.#candidate && (this.#candidatePosition === position ||
                                competitorAtPosition === this.#candidate ||
                                competitorBeforePosition === this.#candidate)) {
            this.#candidatePosition = position;
            return competitorAtPosition;
        }
        this.#candidate?.destroy();
        this.#candidatePosition = position;
        this.#candidate = new AppButton(target.app, true).setParent(this.#parent, position);
        if (slotRect) this.#slots.splice(position, 0, DropCompetitor(this.#candidate, slotRect));
        return competitorAtPosition;
    }

    /**
     * @returns {[candidate: AppButton, slots: Component[]]}
     */
    handleDrop() {
        if (!this.#slots || !this.#candidate) return null;
        const candidate = this.#candidate;
        const slots = new Set();
        for (let i = 0, l = this.#slots.length; i < l; ++i) {
            const { competitor } = this.#slots[i];
            if (competitor.isValid) slots.add(competitor);
        }
        if (!slots.has(candidate)) slots.add(candidate);
        this.#candidate = null;
        return [candidate, [...slots]];
    }

    /**
     * @param {Clutter.Actor} actor
     */
    #watchDragActor(actor) {
        if (Context.signals.hasClient(this)) return;
        Context.signals.add(this, [actor, Event.Destroy, () => this.destroy(),
                                          Event.MoveX, () => this.#handleDragActorPosition(actor),
                                          Event.MoveY, () => this.#handleDragActorPosition(actor)]);
    }

    /**
     * @param {Clutter.Actor} actor
     */
    #handleDragActorPosition(actor) {
        if (!actor) return;
        const parentRect = this.#parent.rect;
        const actorRect = new Meta.Rectangle();
        [actorRect.x, actorRect.y] = actor.get_transformed_position();
        [actorRect.width, actorRect.height] = actor.get_transformed_size();
        const [parentContainsActor] = actorRect.intersect(parentRect);
        if (parentContainsActor) return;
        this.#candidate?.destroy();
        this.#candidate = null;
    }

}

class TaskbarAllocation {

    /** @type {boolean} */
    #isDragMode = false;

    /** @type {boolean} */
    #isUpdating = false;

    /** @type {St.BoxLayout} */
    #actor = new St.BoxLayout(AllocationProps);

    /** @type {Map<Component, number>} */
    #allocation = new Map();

    /** @type {Job} */
    #job = Context.jobs.new(this, Delay.Redraw);

    /** @type {Taskbar} */
    #taskbar = null;

    /** @type {number} */
    get #allocationSize() {
        let result = 0;
        if (!this.#allocation?.size) return result;
        const apps = new Map();
        for (const [source, size] of this.#allocation) {
            if (source instanceof AppButton) {
                const app = source.app;
                const count = apps.get(app) ?? 0;
                if (count >= APP_ALLOCATION_THRESHOLD) continue;
                apps.set(app, count + 1);
            }
            result += size ?? 0;
        }
        return result;
    }

    /** @type {St.BoxLayout} */
    get actor() {
        return this.#actor;
    }

    /** @type {boolean} */
    get isUpdating() {
        return this.#isUpdating;
    }

    /** @param {boolean} value */
    set isDragMode(value) {
        this.#isDragMode = value;
    }

    /**
     * @param {Taskbar} taskbar
     */
    constructor(taskbar) {
        this.#taskbar = taskbar;
    }

    destroy() {
        this.#job?.destroy();
        this.#job = null;
        this.#taskbar = null;
        this.#allocation = null;
        this.#actor = null;
    }

    /**
     * @param {Component} source
     */
    add(source) {
        if (!source || !this.#allocation) return;
        const { width } = source.rect;
        this.#allocation.set(source, width);
        this.#job.reset(Delay.Redraw).then(() => this.update()).catch();
    }

    /**
     * @param {Component} source
     */
    remove(source) {
        if (!source || !this.#allocation?.has(source)) return;
        this.#allocation.delete(source);
        const delay = this.#isDragMode ? Delay.Scheduled : Delay.Redraw;
        this.#job.reset(delay).then(() => this.update()).catch();
    }

    update() {
        if (!this.#allocation || !this.#actor || !this.#taskbar) return;
        this.#actor.remove_all_transitions();
        this.#isUpdating = false;
        const { pageSize, scrollSize, scrollPosition } = this.#taskbar;
        const width = this.#allocationSize;
        const scrollOffset = Math.max(0, width - pageSize);
        const duration = width >= scrollSize ? (this.#isDragMode ? 0 : AnimationDuration.Faster) : AnimationDuration.Slower;
        const delay = width >= scrollSize ? 0 : Delay.Queue;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        this.#taskbar.scrollLimit = scrollOffset;
        const allocate = () => Animation(this.#actor, duration, { width, mode, delay });
        if (scrollOffset > scrollPosition) return allocate();
        const scrollJob = this.#taskbar.scrollToPosition(scrollOffset, true);
        if (!scrollJob) return allocate();
        this.#isUpdating = true;
        scrollJob.then(() => {
            if (!this.#isUpdating) return;
            this.#isUpdating = false;
            allocate();
        });
    }

}

export class Taskbar extends ScrollView {

    /**
     * @param {{event: string, params: *, target: *, sender: Component}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: () => this.#handleDestroy(data?.sender) ?? true,
        [ComponentEvent.Mapped]: () => this.#handleMapped(data?.sender) ?? true,
        [ComponentEvent.DragOver]: () => this.#handleDragOver(data?.target, data?.params),
        [ComponentEvent.AcceptDrop]: this.#handleDrop,
        [AppButtonEvent.Reaction]: () => this.#handleChildReaction(data?.sender) ?? true
    })[data?.event]?.call(this);

    /** @type {TaskbarAllocation} */
    #allocation = new TaskbarAllocation(this);

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey), true);

    /** @type {Map<Meta.Workspace, Set<Shell.App>>} */
    #runningApps = Context.getSessionCache(this.constructor.name);

    /** @type {Map<Shell.App, AppButton>} */
    #appButtons = new Map();

    /** @type {AppButton|null} */
    #activeAppButton = null;

    /** @type {Component|null} */
    #scrollLock = null;

    /** @type {TaskbarClient} */
    #service = new TaskbarClient(() => this.#rerender());

    /** @type {DragAndDropHandler} */
    #dndHandler = null;

    /** @type {Separator} */
    #separator = new Separator();

    /** @type {number} */
    #separatorPosition = -1;

    /** @type {St.BoxLayout} */
    get actor() {
        return this.#allocation?.actor;
    }

    constructor() {
        super(MODULE_NAME);
        super.actor.add_actor(this.#allocation.actor);
        this.dropEvents = true;
        this.#separator.connect(Event.Hover, () => this.#handleChildReaction(this.#separator));
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        Context.layout.requestInit(this, () => this.#setParent());
    }

    /**
     * @param {Component|St.Widget} actor
     * @param {boolean} [deceleration]
     */
    scrollToActor(actor, deceleration = false) {
        super.scrollToActor(actor, deceleration);
        if (this.#allocation?.isUpdating) this.#allocation.update();
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            case ConfigFields.enableSeparator:
            case ConfigFields.showAllWindows:
            case ConfigFields.isolateWorkspaces:
                this.#rerender();
                break;
        }
    }

    #setParent() {
        this.setParent(Main.panel._leftBox, -1);
    }

    /**
     * @param {Component} sender
     */
    #handleMapped(sender) {
        if (!this.isValid || !sender) return;
        if (sender === this) return Context.layout.queueAfterInit(this, () => this.#rerender());
        this.#allocation?.add(sender);
    }

    /**
     * @param {Component} sender
     */
    #handleDestroy(sender) {
        if (sender === this) return this.#destroy();
        if (sender === this.#activeAppButton) {
            this.#activeAppButton = null;
        }
        if (sender === this.#scrollLock) {
            this.#scrollLock = null;
        }
        this.#allocation?.remove(sender);
    }

    #destroy() {
        Context.layout.removeClient(this);
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#allocation?.destroy();
        this.#service?.destroy();
        this.#dndHandler?.destroy();
        this.#service = null;
        this.#appButtons = null;
        this.#dndHandler = null;
        this.#separator = null;
        this.#allocation = null;
        this.#activeAppButton = null;
        this.#scrollLock = null;
    }

    /**
     * @param {*} target
     * @param {{x: number, y: number}} params
     * @returns {Dnd.DragMotionResult|null}
     */
    #handleDragOver(target, params) {
        if (!this.isValid || !params || target?.app instanceof Shell.App === false) return;
        const isAppButton = target instanceof AppButton;
        if (isAppButton && !target.isValid) return;
        const result = isAppButton ? Dnd.DragMotionResult.MOVE_DROP : Dnd.DragMotionResult.COPY_DROP;
        if (!isAppButton && this.#appButtons.has(target.app)) {
            const appButton = this.#appButtons.get(target.app);
            if (appButton.isValid) {
                target = appButton;
            }
        }
        if (!this.#dndHandler) {
            Context.jobs.removeAll(this);
            this.#allocation.isDragMode = true;
            const competitors = [...this.#appButtons.values()];
            if (this.#service?.favorites && this.#separatorPosition >= 0) {
                this.#separator.toggle();
                competitors.splice(this.#separatorPosition, 0, this.#separator);
            }
            this.#dndHandler = new DragAndDropHandler(this, competitors, () => this.#handleDragEnd());
        }
        const competitor = this.#dndHandler.handleDrag({ target, ...params });
        if (competitor) super.scrollToActor(competitor);
        return result;
    }

    /**
     * @returns {boolean}
     */
    #handleDrop() {
        const dropResult = this.#dndHandler?.handleDrop();
        if (!dropResult) return false;
        const [candidate, slots] = dropResult;
        const workspace = this.#service.workspace;
        const favorites = this.#service.favorites;
        const candidateApp = candidate.app;
        const oldAppButton = this.#appButtons.get(candidateApp);
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
        const isFavorite = candidatePosition < separatorPosition;
        if (isFavorite && !favorites?.canAdd(candidateApp)) return candidate.destroy() ?? true;
        this.#runningApps.set(workspace, apps);
        this.#appButtons = appButtons;
        this.#dndHandler = null;
        oldAppButton?.destroy();
        if (!isFavorite && favorites) favorites.remove(candidateApp);
        candidate.drop();
        if (isFavorite) {
            const favoritePosition = [...apps].indexOf(candidateApp);
            favorites?.add(candidateApp, favoritePosition);
            return true;
        }
        if (!oldAppButton?.isValid) candidate.activate();
        return true;
    }

    #handleDragEnd() {
        if (!this.isValid) return;
        this.#allocation.isDragMode = false;
        if (!this.#dndHandler) return;
        this.#dndHandler = null;
        if (this.#service?.favorites) this.#separator.toggle();
    }

    #rerender() {
        if (!this.isMapped || Context.layout.isQueued(this)) return;
        const favoriteApps = this.#service.favorites?.apps;
        const runningApps = this.#getRunningApps();
        const apps = [...new Set([...favoriteApps ?? [], ...runningApps ?? []])];
        if (!apps.length) return;
        const appButtons = new Map();
        const sortedAppButtons = [];
        for (let i = 0, l = apps.length; i < l; ++i) {
            const app = apps[i];
            const oldAppButton = this.#appButtons.get(app);
            if (oldAppButton?.isValid) {
                appButtons.set(app, oldAppButton);
                sortedAppButtons.push(oldAppButton);
                continue;
            }
            const newAppButton = new AppButton(app);
            appButtons.set(app, newAppButton);
            sortedAppButtons.push(newAppButton);
        }
        let separatorPosition = favoriteApps?.size ?? -1;
        this.#separatorPosition = separatorPosition;
        const mergedAppButtons = new Map([...this.#appButtons, ...appButtons]);
        if (mergedAppButtons.size !== appButtons.size) {
            let i = -1;
            for (const [app, appButton] of mergedAppButtons) {
                if (!appButton.isValid) continue; i++;
                if (appButtons.has(app)) continue;
                appButtons.set(app, appButton);
                sortedAppButtons.splice(i, 0, appButton);
                if (separatorPosition !== -1 && appButton.isFavorite) separatorPosition++;
            }
        }
        this.#appButtons = appButtons;
        for (let i = 0, l = sortedAppButtons.length; i < l; ++i) sortedAppButtons[i].setParent(this, i);
        this.#separator.setParent(this, separatorPosition);
        const { enableSeparator } = this.#config;
        const isSeparatorRequired = separatorPosition > 0 && apps.length > favoriteApps?.size;
        this.#separator.isVisible = enableSeparator && isSeparatorRequired;
    }

    /**
     * @returns {Set<Shell.App>|null}
     */
    #getRunningApps() {
        const workspace = this.#service.workspace;
        const { isolateWorkspaces, showAllWindows } = this.#config;
        let runningApps = this.#service.queryApps(isolateWorkspaces, showAllWindows);
        if (!runningApps?.size) this.#runningApps.delete(workspace);
        else if (!this.#runningApps.has(workspace)) this.#runningApps.set(workspace, runningApps);
        else {
            const oldRunningApps = this.#runningApps.get(workspace);
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

    /**
     * @param {Component} child
     */
    #handleChildReaction(child) {
        if (!this.isValid || !child?.isValid) return;
        Context.jobs.removeAll(this);
        const isActive = child.isActive ?? false;
        const hasFocus = child.hasFocus ?? false;
        const hasHover = child.actor.hover ?? false;
        if (isActive) {
            this.#activeAppButton = child;
        } else if (this.#activeAppButton === child) {
            this.#activeAppButton = null;
        }
        if (hasHover) {
            this.#scrollLock = child;
        } else if (this.#scrollLock === child) {
            this.#scrollLock = null;
            if (!hasFocus && this.#activeAppButton) Context.jobs.new(this, Delay.Scheduled).destroy(() =>
                                                    this.scrollToActor(this.#activeAppButton, true));
        }
        if (this.#scrollLock && this.#scrollLock !== child) return;
        if (!isActive && !hasHover && !hasFocus) return;
        this.scrollToActor(child, !hasHover);
    }

}
