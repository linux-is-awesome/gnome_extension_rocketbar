/**
 * @typedef {import('gi://Clutter').Actor} Clutter.Actor
 * @typedef {import('../../../shared/core/context/signals.js').Signals.SignalTracker} SignalTracker
 */

import St from 'gi://St';
import Mtk from 'gi://Mtk';
import * as Dnd from 'resource:///org/gnome/shell/ui/dnd.js';
import Context from '../../../main/core/context.js';
import { Event } from '../../../shared/enums/general.js';

const DEFAULT_DRAG_THRESHOLD = 200;

/** @type {{[param: string]: *}} */
const DraggableParams = {
    manualMode: true,
    timeoutThreshold: DEFAULT_DRAG_THRESHOLD
};

/** @enum {string} */
export const ComponentEvent = {
    Init: 'component::init',
    Destroy: 'component::destroy',
    AcceptDrop: 'component::accept-drop',
    DragOver: 'component::drag-over',
    DragBegin: 'component::drag-begin',
    DragCancelled: 'component::drag-cancelled',
    DragEnd: 'component::drag-end',
    DragMotion: 'component::drag-motion',
    DragActorRequest: 'component::drag-actor-request',
    DragActorSourceRequest: 'component::drag-actor-source-request'
};

/**
 * @template {St.Widget} ComponentActor
 */
export class Component {

    /** @type {Map<St.Widget, Component<St.Widget>>} */
    static #wrappers = new Map();

    /** @type {Set<number>} */
    #signals = new Set();

    /** @type {SignalTracker?} */
    #dndSignals = null;

    /** @type {boolean} */
    #isWrapper = false;

    /** @type {boolean} */
    #isValid = true;

    /** @type {ComponentActor?} */
    #actor = null;

    /** @type {Component<St.Widget>?} */
    #parent = null;

    /** @type {Dnd._Draggable?} */
    #draggable = null;

    /** @type {((data: {event: string, params: *, target: *, sender: *}) => *)?} */
    #notifyCallback = null;

    /** @type {boolean} */
    #dropEvents = false;

    /** @type {{dragMotion: (event) => Dnd.DragMotionResult}?} */
    #dragMonitor = null;

    /** @type {boolean} */
    get isValid() {
        return this.#isValid && !!this.#actor;
    }

    /** @type {boolean} */
    get isMapped() {
        return this.#isValid && !!this.#actor?.is_mapped();
    }

    /** @type {boolean} */
    get hasAllocation() {
        const actor = this.#actor;
        return this.#isValid && !!actor?.get_stage() && (actor.is_mapped() || !!actor.get_parent());
    }

    /** @type {ComponentActor} */
    get actor() {
        if (!this.#actor) throw new Error(`${this.constructor.name} is not valid.`);
        return this.#actor;
    }

    /** @type {Component<St.Widget>|St.Widget|null} */
    get parent() {
        if (!this.hasAllocation) return null;
        const result = this.#actor?.get_parent() ?? null;
        if (result instanceof St.Widget === false) return null;
        if (result._delegate instanceof Component) return result._delegate;
        if (result._delegate?._delegate instanceof Component) return result._delegate._delegate;
        const component = Component.#wrappers.get(result);
        return component ?? result;
    }

    /** @type {St.Widget?} */
    get parentActor() {
        const parent = this.parent;
        if (parent instanceof Component) return parent.#actor;
        return parent;
    }

    /** @type {Mtk.Rectangle?} */
    get rect() {
        if (!this.#isValid || !this.#actor) return null;
        const [x, y] = this.#actor.get_transformed_position();
        const [width, height] = this.#actor.get_transformed_size();
        return new Mtk.Rectangle({ x, y, width, height });
    }

    /** @type {Mtk.Rectangle?} */
    get centerRect() {
        return this.rect;
    }

    /** @param {number} value -1..0...999 */
    set position(value) {
        this.#setPosition(value);
    }

    /** @param {boolean} enabled */
    set dragEvents(enabled) {
        this.#setDragEvents(enabled);
    }

    /** @param {boolean} enabled */
    set dropEvents(enabled) {
        this.#dropEvents = typeof enabled === 'boolean' ? enabled : false;
    }

    /** @param {((data: {event: string, params: *, target: *, sender: *}) => *)?} callback */
    set notifyCallback(callback) {
        this.#notifyCallback = typeof callback === 'function' ? callback : null;
    }

    /**
     * @param {ComponentActor} actor
     * @param {boolean} [isWrapper]
     */
    constructor(actor, isWrapper = false) {
        if (actor instanceof St.Widget === false) {
            throw new Error(`Failed to construct ${this.constructor.name}, ${actor} is not an instance of St.Widget.`);
        }
        this.#isWrapper = isWrapper;
        this.#actor = actor;
        this.#signals.add(actor.connect_after(Event.Destroy, () => this.#destroy()));
        if (isWrapper) {
            Component.#wrappers.set(actor, this);
            return;
        }
        this.#actor._delegate = this;
    }

    destroy() {
        if (this.#isWrapper) this.#destroy();
        else this.#actor?.destroy();
    }

    /**
     * @param {{[prop: string]: *}} props
     * @returns {this}
     */
    setProps(props) {
        if (props) this.#actor?.set(props);
        return this;
    }

    /**
     * @param {St.Widget|Component<St.Widget>|null} parent
     * @param {number} [position] -1..0..999
     * @returns {this}
     */
    setParent(parent, position = -1) {
        if (!this.#isValid || !this.#actor ||
            parent === this || typeof position !== 'number') return this;
        this.#parent = null;
        if (parent instanceof Component) {
            this.#parent = parent;
            parent = parent.actor;
        }
        const oldParent = this.parentActor;
        const isParentChanged = oldParent !== parent;
        if (isParentChanged) oldParent?.remove_child(this.#actor);
        if (parent instanceof St.Widget === false) return this;
        if (isParentChanged) this.#setInitHandler();
        if (parent instanceof St.Bin) {
            if (isParentChanged) parent.set_child(this.#actor);
            return this;
        }
        if (!isParentChanged) this.#setPosition(position);
        else parent.insert_child_at_index(this.#actor, position);
        return this;
    }

    /**
     * @param {number} [width]
     * @param {number} [height]
     * @returns {this}
     */
    setSize(width = -1, height = -1) {
        if (typeof width === 'number' &&
            typeof height === 'number') this.#actor?.set_size(width, height);
        return this;
    }

    /**
     * @param {string} event
     * @param {(...args) => *} callback
     * @returns {number|null}
     */
    connect(event, callback) {
        if (!this.#actor ||
            typeof event !== 'string' ||
            typeof callback !== 'function') return null;
        const signalId = this.#actor.connect(event, callback);
        this.#signals.add(signalId);
        return signalId;
    }

    /**
     * @param {number} signalId
     * @returns {this}
     */
    disconnect(signalId) {
        if (!this.#signals.has(signalId)) return this;
        this.#signals.delete(signalId);
        this.#actor?.disconnect(signalId);
        return this;
    }

    /**
     * @param {string} event a custom event
     * @param {*} [params]
     * @returns {this}
     */
    notifyParents(event, params) {
        return this.#notifyParents(event, params);
    }

    /**
     * @param {string} event a custom event
     * @param {*} [params]
     * @returns {this}
     */
    notifyChildren(event, params) {
        if (typeof event !== 'string') return this;
        const children = this.#actor?.get_children();
        if (!children?.length) return this;
        for (let i = 0, l = children.length; i < l; ++i) {
            let child = children[i]._delegate;
            if (!child) continue;
            if (child instanceof Component === false) {
                child = child._delegate;
                if (child instanceof Component === false) continue;
            }
            if (child.#notifySelf(event, child, params, this)) break;
        }
        return this;
    }

    /**
     * @param {string} event any custom event
     * @param {*} [params]
     * @returns {*}
     */
    notifySelf(event, params) {
        return this.#notifySelf(event, this, params);
    }

    /**
     * @param {*} source
     * @param {Clutter.Actor} [actor]
     * @param {number} [x]
     * @param {number} [y]
     * @returns {boolean}
     */
    acceptDrop(source, actor, x, y) {
        if (!this.#dropEvents) return false;
        return this.#notifySelf(ComponentEvent.AcceptDrop, source, { actor, x, y }) ?? false;
    }

    /**
     * @param {*} source
     * @param {Clutter.Actor} [actor]
     * @param {number} [x]
     * @param {number} [y]
     * @returns {Dnd.DragMotionResult}
     */
    handleDragOver(source, actor, x, y) {
        if (!this.#dropEvents) return Dnd.DragMotionResult.CONTINUE;
        return this.#notifySelf(ComponentEvent.DragOver, source, { actor, x, y }) ?? Dnd.DragMotionResult.CONTINUE;
    }

    /**
     * @returns {Clutter.Actor}
     */
    getDragActor() {
        return this.#notifySelf(ComponentEvent.DragActorRequest) ?? this.#actor;
    }

    /**
     * @returns {Clutter.Actor}
     */
    getDragActorSource() {
        return this.#notifySelf(ComponentEvent.DragActorSourceRequest) ?? this.#actor;
    }

    /**
     * @returns {this}
     */
    cancelDragEvents() {
        if (!this.#draggable) return this;
        if (typeof this.#draggable.fakeRelease === 'function') this.#draggable.fakeRelease();
        return this;
    }

    #destroy() {
        if (!this.#isValid || !this.#actor) return;
        if (this.#isWrapper) Component.#wrappers.delete(this.#actor);
        for (const id of this.#signals) this.#actor.disconnect(id);
        this.#signals.clear();
        this.#isValid = false;
        if (!this.#isWrapper) this.#actor.remove_all_transitions();
        this.#setDragEvents(false);
        this.#notifySelf(ComponentEvent.Destroy);
        if (!this.#isWrapper) {
            this.#actor._delegate = null;
        }
        this.#actor = null;
        this.#parent = null;
        this.#draggable = null;
        this.#dragMonitor = null;
        this.#notifyCallback = null;
    }

    #setInitHandler() {
        if (!this.#actor) return;
        const signalId = this.#actor.connect_after(Event.ParentChanged, () =>
            (this.disconnect(signalId), this.#notifySelf(ComponentEvent.Init)));
        this.#signals.add(signalId);
    }

    /**
     * @param {number} position -1..0...999
     * @returns {boolean}
     */
    #setPosition(position) {
        if (!this.#actor || typeof position !== 'number') return false;
        const parentActor = this.parentActor;
        if (!parentActor) return false;
        const maxPosition = parentActor.get_n_children() - 1;
        if (position < 0 || position > maxPosition) {
            position = maxPosition;
        }
        const actorAtIndex = parentActor.get_child_at_index(position);
        if (actorAtIndex === this.#actor) return false;
        parentActor.set_child_at_index(this.#actor, position);
        return true;
    }

    /**
     * @param {boolean} enabled
     */
    #setDragEvents(enabled) {
        if (!this.#actor || this.#isWrapper) return;
        if (!enabled && this.#dragMonitor) Dnd.removeDragMonitor(this.#dragMonitor);
        if (!enabled && !this.#draggable) return;
        this.#draggable ??= Dnd.makeDraggable(this.#actor, DraggableParams);
        this.#dragMonitor ??= { dragMotion: event => this.#dragMotion(event) };
        this.#draggable.startGesture?.set_manual_mode(!enabled);
        this.#dndSignals?.destroy();
        this.#dndSignals = null;
        if (!enabled) return;
        this.#dndSignals = Context.signals.new().add([this.#draggable,
            Event.DragBegin, () => this.#dragBegin(),
            Event.DragCancelled, () => this.#dragCancelled(),
            Event.DragEnd, () => this.#dragEnd()]);
        if (typeof this.#draggable._onButtonPress !== 'function' ||
            typeof this.#draggable._onTouchEvent !== 'function') return;
        this.#dndSignals.add([this.#actor,
            Event.ButtonPress, this.#draggable._onButtonPress.bind(this.#draggable),
            Event.Touch, this.#draggable._onTouchEvent.bind(this.#draggable)]);
    }

    /**
     * @param {{x: number, y: number, source: *, dragActor: *, targetActor: *}} event
     * @returns {Dnd.DragMotionResult}
     */
    #dragMotion(event) {
        return this.#notifySelf(ComponentEvent.DragMotion, this, event) ?? Dnd.DragMotionResult.CONTINUE;
    }

    #dragBegin() {
        if (!this.#dragMonitor) return;
        Dnd.addDragMonitor(this.#dragMonitor);
        this.#notifySelf(ComponentEvent.DragBegin);
    }

    #dragCancelled() {
        if (!this.#dragMonitor) return;
        this.#notifySelf(ComponentEvent.DragCancelled);
    }

    #dragEnd() {
        if (!this.#dragMonitor) return;
        Dnd.removeDragMonitor(this.#dragMonitor);
        this.#notifySelf(ComponentEvent.DragEnd);
    }

    /**
     * @param {string} event any custom event
     * @param {*} [params]
     * @param {Component<St.Widget>} [sender]
     * @returns {this}
     */
    #notifyParents(event, params, sender = this) {
        if (typeof event !== 'string') return this;
        const parent = this.#parent ?? this.parent;
        if (parent === this) return this;
        if (parent instanceof Component === false ||
            parent.#notifySelf(event, parent, params, sender)) return this;
        parent.#notifyParents(event, params, sender);
        return this;
    }

    /**
     * @param {string} event any custom event
     * @param {*} [target]
     * @param {*} [params]
     * @param {Component<St.Widget>} [sender]
     * @returns {*}
     */
    #notifySelf(event, target = this, params, sender = this) {
        if (typeof this.#notifyCallback !== 'function') return null;
        try {
            const notifyParams = { event, target, params, sender };
            return this.#notifyCallback(notifyParams);
        } catch (e) {
            Context.logError(`${this.constructor.name} failed to handle event ${event}.`, e);
        }
        return null;
    }

}
