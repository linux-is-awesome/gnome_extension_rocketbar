/* exported Taskbar */

import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import { Main, Dnd } from '../core/legacy.js';
import { Context } from '../core/context.js';
import { Type, Event } from '../core/enums.js';
import { ComponentEvent } from './base/component.js';
import { ScrollView } from './base/scrollView.js';
import { TaskbarClient } from '../services/taskbarService.js';
import { AppButton } from './taskbar/appButton.js';
import { Separator } from './taskbar/separator.js';

const MODULE_NAME = 'Rocketbar__Taskbar';

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
    }
    return { rect, competitor };
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
     */
    handleDrag(params) {
        if (!params || !this.#slots) return;
        const { target, actor } = params;
        this.#watchDragActor(actor);
        const x = this.#parent?.rect.x + params.x;
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
            return;
        }
        if (this.#candidate && (this.#candidatePosition === position ||
                                competitorAtPosition === this.#candidate)) {
            this.#candidatePosition = position;
            return;
        }
        this.#candidate?.destroy();
        this.#candidatePosition = position;
        this.#candidate = new AppButton(target.app, true).setParent(this.#parent, position);
        if (!slotRect) return;
        this.#slots.splice(position, 0, DropCompetitor(this.#candidate, slotRect));
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
        this.destroy();
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
        this.destroy();
    }

}

export class Taskbar extends ScrollView {

    /**
     * @param {{event: string, params: *, target: *}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Mapped]: () => Context.layout.queueAfterInit(this, () => this.#rerender()),
        [ComponentEvent.DragOver]: () => this.#handleDragOver(data?.target, data?.params),
        [ComponentEvent.AcceptDrop]: this.#handleDrop
    })[data?.event]?.call(this);

    /** @type {Map<Meta.Workspace, Set<Shell.App>>} */
    #runningApps = Context.getSessionCache(this.constructor.name);

    /** @type {Map<Shell.App, AppButton>} */
    #appButtons = new Map();

    /** @type {TaskbarClient} */
    #service = new TaskbarClient(() => this.#rerender());

    /** @type {DragAndDropHandler} */
    #dndHandler = null;

    /** @type {Separator} */
    #separator = new Separator();

    /** @type {number} */
    #separatorPosition = 0;

    constructor() {
        super(MODULE_NAME);
        this.dropEvents = true;
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        Context.layout.requestInit(this, () => this.#setParent());
    }

    #destroy() {
        Context.layout.removeClient(this);
        this.#service?.destroy();
        this.#dndHandler?.destroy();
        this.#service = null;
        this.#appButtons = null;
        this.#dndHandler = null;
        this.#separator = null;
    }

    #setParent() {
        this.setParent(Main.panel._leftBox, -1);
    }
    
    /**
     * @param {*} target
     * @param {{x: number, y: number}} params
     * @returns {Dnd.DragMotionResult|null}
     */
    #handleDragOver(target, params) {
        if (!params || target?.app instanceof Shell.App === false) return;
        let isAppButton = target instanceof AppButton;
        if (isAppButton && !target.isValid) return;
        const result = isAppButton ? Dnd.DragMotionResult.MOVE_DROP : Dnd.DragMotionResult.COPY_DROP;
        if (!isAppButton && this.#appButtons.has(target.app)) {
            const appButton = this.#appButtons.get(target.app);
            if (appButton.isValid) target = appButton;
        }
        if (!this.#dndHandler) {
            this.#separator.show();
            const competitors = [...this.#appButtons.values()];
            competitors.splice(this.#separatorPosition, 0, this.#separator);
            this.#dndHandler = new DragAndDropHandler(this, competitors, () => this.#handleDragEnd());
        }
        this.#dndHandler.handleDrag({ target, ...params });
        return result;
    }

    /**
     * @returns {boolean}
     */
    #handleDrop() {
        const dropResult = this.#dndHandler?.handleDrop();
        if (!dropResult) return false;
        const [candidate, slots] = dropResult;
        let candidatePosition = -1;
        let separatorPosition = -1;
        const workspace = this.#service.workspace;
        const candidateApp = candidate.app;
        const oldAppButton = this.#appButtons.get(candidateApp);
        const apps = new Set();
        const appButtons = new Map();
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
        this.#runningApps.set(workspace, apps);
        this.#appButtons = appButtons;
        oldAppButton?.destroy();
        candidate.drop();
        if (candidatePosition > separatorPosition) {
            if (!oldAppButton?.isValid) candidate.activate();
            else this.#service.favorites?.remove(candidateApp);
            return true;
        } 
        const favoritePosition = [...apps].indexOf(candidateApp);
        this.#service.favorites?.add(candidateApp, favoritePosition);
        return true;
    }

    #handleDragEnd() {
        if (!this.isValid) return;
        this.#dndHandler = null;
        this.#separator.hide();
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
        let separatorPosition = favoriteApps?.size ?? 0;
        this.#separatorPosition = separatorPosition;
        const mergedAppButtons = new Map([...this.#appButtons, ...appButtons]);
        if (mergedAppButtons.size !== appButtons.size) {
            const separatorApp = separatorPosition ? apps[separatorPosition - 1] : null;
            let i = -1;
            for (const [app, appButton] of mergedAppButtons) {
                if (!appButton.isValid) continue; i++;
                if (separatorApp === app) {
                    separatorPosition = i + 1;
                }
                if (appButtons.has(app)) continue;
                appButtons.set(app, appButton);
                sortedAppButtons.splice(i, 0, appButton);
            }
        }
        this.#appButtons = appButtons;
        for (let i = 0, l = sortedAppButtons.length; i < l; ++i) sortedAppButtons[i].setParent(this, i);
        this.#separator.setParent(this, separatorPosition);
    }

    /**
     * @returns {Set<Shell.App>|null}
     */
    #getRunningApps() {
        const workspace = this.#service.workspace;
        let runningApps = this.#service.queryApps(true, true);
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

}
