/**
 * @typedef {import('gi://Gio').Settings} Gio.Settings
 * @typedef {import('gi://Clutter').Actor} Clutter.Actor
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Mtk from 'gi://Mtk';
import * as Dnd from 'resource:///org/gnome/shell/ui/dnd.js';
import { MainLayout } from '../../core/shell.js';
import { Event } from '../../../shared/core/enums.js';

const DRAG_TIMEOUT_THRESHOLD = 200;
const UI_SCALE_SETTINGS_KEY = 'text-scaling-factor';

/** @type {{[param: string]: *}} */
const DraggableParams = {
    manualMode: true,
    timeoutThreshold: DRAG_TIMEOUT_THRESHOLD
};

/** @enum {string} */
export const ComponentEvent = {
    Notify: 'component::notify',
    Mapped: 'component::mapped',
    Destroy: 'component::destroy',
    Scale: 'component::scale',
    AcceptDrop: 'component::accept-drop',
    DragOver: 'component::drag-over',
    DragBegin: 'component::drag-begin',
    DragEnd: 'component::drag-end',
    DragMotion: 'component::drag-motion',
    DragActorRequest: 'component::drag-actor-request',
    DragActorSourceRequest: 'component::drag-actor-source-request'
};

/** @enum {number} */
export const ComponentLocation = {
    Top: 0,
    Bottom: 1
};

/**
 * @template {St.Widget} ComponentActor
 */
export class Component {

    /** @type {*} */
    #signalTracker = null;

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

    /** @type {((args: { event: string, params: *, target: *, sender: * }) => *)?} */
    #notifyCallback = null;

    /** @type {boolean} */
    #dropEvents = false;

    /** @type {*} */
    #dragMonitor = null;

    /** @type {St.ThemeContext?} */
    #themeContext = null;

    /** @type {Gio.Settings?} */
    #uiSettings = null;

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

    /** @type {St.Widget|Component<St.Widget>|null} */
    get parent() {
        if (!this.hasAllocation) return null;
        const result = this.#actor?.get_parent() ?? null;
        if (result?._delegate instanceof Component) return result._delegate;
        if (result instanceof St.Widget) return result;
        return null;
    }

    /** @type {St.Widget?} */
    get parentActor() {
        const parent = this.parent;
        if (parent instanceof Component) return parent.#actor;
        return parent;
    }

    /** @type {ComponentLocation} */
    get location() {
        const rect = this.rect;
        const monitorRect = rect ? this.monitorRect : null;
        if (!rect || !monitorRect ||
            rect.y < (monitorRect.y + monitorRect.height) / 2) return ComponentLocation.Top;
        return ComponentLocation.Bottom;
    }

    /** @type {Mtk.Rectangle?} */
    get monitorRect() {
        const monitorIndex = this.monitorIndex;
        if (monitorIndex < 0) return null;
        return global.display.get_monitor_geometry(monitorIndex);
    }

    /** @type {number} */
    get monitorIndex() {
        const rect = this.rect;
        if (!rect) return -1;
        return global.display.get_monitor_index_for_rect(rect);
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

    /** @type {number} */
    get globalScale() {
        if (!this.#actor) return 0;
        if (this.#themeContext) return this.#themeContext.scale_factor;
        this.#themeContext = St.ThemeContext.get_for_stage(global.stage);
        this.#themeContext.connectObject(Event.ScaleFactor, () =>
            this.#notifySelf(ComponentEvent.Scale), this.#signalTracker);
        return this.#themeContext.scale_factor;
    }

    /** @type {number} */
    get uiScale() {
        if (!this.#actor) return 0;
        if (this.#uiSettings) return this.#uiSettings.get_double(UI_SCALE_SETTINGS_KEY);
        this.#uiSettings = MainLayout._interfaceSettings ?? null;
        this.#uiSettings?.connectObject(`${Event.Changed}::${UI_SCALE_SETTINGS_KEY}`, () =>
            this.#notifySelf(ComponentEvent.Scale), this.#signalTracker);
        return this.#uiSettings?.get_double(UI_SCALE_SETTINGS_KEY) ?? 0;
    }

    /** @param {number} value 0..999 */
    set position(value) {
        this.#setPosition(value);
    }

    /** @param {boolean} enabled */
    set dropEvents(enabled) {
        this.#dropEvents = enabled;
    }

    /** @param {boolean} enabled */
    set dragEvents(enabled) {
        this.#setDragEvents(enabled);
    }

    /**
     * @param {ComponentActor} actor
     * @param {boolean} [isWrapper]
     */
    constructor(actor, isWrapper = false) {
        if (actor instanceof St.Widget === false) {
            throw new Error(`Unable to construct ${this.constructor.name}, ${actor} is not an instance of St.Widget.`);
        }
        this.#isWrapper = isWrapper;
        this.#signalTracker = { actor };
        this.#actor = actor;
        this.#actor.connectObject(Event.Destroy, () => this.#destroy(),
                                  GObject.ConnectFlags.AFTER, this.#signalTracker);
        if (isWrapper) return;
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
            typeof position !== 'number') return this;
        let parentComponent = null;
        if (parent instanceof Component) {
            parentComponent = parent;
            parent = parent.actor;
        }
        this.#parent = parentComponent;
        const oldParent = this.parentActor;
        const isParentChanged = oldParent !== parent;
        if (isParentChanged) oldParent?.remove_child(this.#actor);
        if (parent instanceof St.Widget === false) return this;
        if (isParentChanged) this.#setMappedHandler();
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
     * @returns {number|string|null}
     */
    connect(event, callback) {
        if (!this.#actor ||
            typeof event !== 'string' ||
            typeof callback !== 'function') return null;
        if (event === ComponentEvent.Notify && !this.#notifyCallback) {
            this.#notifyCallback = callback;
            return event;
        }
        return this.#actor.connect(event, callback) ?? null;
    }

    /**
     * @param {number|string} id
     * @returns {this}
     */
    disconnect(id) {
        if (typeof id === 'number') {
            this.#actor?.disconnect(id);
        } else if (id === ComponentEvent.Notify) {
            this.#notifyCallback = null;
        }
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
            /** @type {Component<St.Widget>} */
            const child = children[i]._delegate;
            if (child instanceof Component === false) continue;
            if (child.#notifySelf(event, child, params, this)) break;
        }
        return this;
    }

    /**
     * @param {string} event a custom event
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
        this.#draggable?.fakeRelease();
        return this;
    }

    #destroy() {
        if (!this.#isValid || !this.#actor) return;
        this.#isValid = false;
        this.#actor.remove_all_transitions();
        this.#setDragEvents(false);
        this.#notifySelf(ComponentEvent.Destroy);
        this.#actor.disconnectObject(this.#signalTracker);
        this.#themeContext?.disconnectObject(this.#signalTracker);
        this.#uiSettings?.disconnectObject(this.#signalTracker);
        this.#themeContext = null;
        this.#uiSettings = null;
        this.#actor._delegate = null;
        this.#actor = null;
        this.#parent = null;
        this.#signalTracker = null;
    }

    #setMappedHandler() {
        const handlerId = this.#actor?.connect(Event.Mapped, () => {
            if (handlerId) this.#actor?.disconnect(handlerId);
            this.#notifySelf(ComponentEvent.Mapped);
        });
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
        if (this.#dragMonitor) Dnd.removeDragMonitor(this.#dragMonitor);
        if (this.#draggable) this.#actor?.disconnectObject(this.#draggable);
        this.#draggable?.disconnectAll();
        this.#draggable = null;
        this.#dragMonitor = null;
        if (!enabled || !this.#actor) return;
        this.#dragMonitor = {};
        this.#draggable = Dnd.makeDraggable(this.#actor, DraggableParams);
        this.#draggable.connect(Event.DragBegin, () => this.#dragBegin());
        this.#draggable.connect(Event.DragEnd, () => this.#dragEnd());
        this.#dragMonitor.dragMotion = event => this.#dragMotion(event);
        this.#actor.connectObject(
            Event.ButtonPress, this.#draggable._onButtonPress.bind(this.#draggable),
            Event.Touch, this.#draggable._onTouchEvent.bind(this.#draggable),
        this.#draggable);
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

    #dragEnd() {
        if (!this.#dragMonitor) return;
        Dnd.removeDragMonitor(this.#dragMonitor);
        this.#notifySelf(ComponentEvent.DragEnd);
    }

    /**
     * @param {string} event a custom event
     * @param {*} [params]
     * @param {Component<St.Widget>} [sender]
     * @returns {this}
     */
    #notifyParents(event, params, sender = this) {
        if (typeof event !== 'string') return this;
        const parent = this.#parent ?? this.#getNearestParentComponent();
        if (!parent || parent.#notifySelf(event, parent, params, sender)) return this;
        parent.#notifyParents(event, params, sender);
        return this;
    }

    /**
     * @param {St.Widget|Component<St.Widget>|null} [parent]
     * @returns {Component<St.Widget>?}
     */
    #getNearestParentComponent(parent = this.parent) {
        if (!parent) return null;
        let nextParent = null;
        if (parent instanceof St.Widget) {
            nextParent = parent.get_parent();
            parent = nextParent?._delegate;
        }
        return parent instanceof Component ? parent :
               nextParent instanceof St.Widget ? this.#getNearestParentComponent(nextParent) : null;
    }

    /**
     * @param {string} event a custom event
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
            console.error(`${this.constructor.name} notify failed for event ${event}.`, e);
        }
        return null;
    }

}
