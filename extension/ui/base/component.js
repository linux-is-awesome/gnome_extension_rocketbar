/* exported ComponentEvent, ComponentLocation, Component */

import St from 'gi://St';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import { Dnd } from '../../core/legacy.js'; 
import { Type, Event } from '../../core/enums.js';

const DRAG_TIMEOUT_THRESHOLD = 200;
const UI_SETTINGS_SCHEMA_ID = 'org.gnome.desktop.interface';
const UI_SCALE_SETTINGS_KEY = 'text-scaling-factor';

/**
 * @enum {string}
 */
export const ComponentEvent = {
    Notify: 'component::notify',
    Mapped: 'component::mapped',
    Destroy: 'component::destroy',
    PositionLock: 'component::position-lock',
    Scale: 'component::scale',
    AcceptDrop: 'component::accept-drop',
    DragOver: 'component::drag-over',
    DragBegin: 'component::drag-begin',
    DragEnd: 'component::drag-end',
    DragMotion: 'component::drag-motion',
    DragActorRequest: 'component::drag-actor-request'
};

/**
 * @enum {number}
 */
export const ComponentLocation = {
    Top: 0,
    Bottom: 1
};

export class Component {

    /** @type {boolean} */
    #isValid = true;

    /** @type {St.Widget} */
    #actor = null;

    /** @type {Dnd._Draggable} */
    #draggable = null;

    /** @type {(args: { event: string, params: *, target: *, sender: * }) => *} */
    #notifyCallback = null;

    /** @type {number} */
    #defaultPosition = 0;

    /** @type {number} */
    #positionHandlerId = null;

    /** @type {boolean} */
    #dropEvents = false;

    /** @type {*} */
    #dragMonitor = null;

    /** @type {St.ThemeContext} */
    #themeContext = null;

    /** @type {Gio.Settings} */
    #uiSettings = null;

    /** @type {St.Widget} */
    get actor() {
        return this.#actor;
    }

    /** @type {St.Widget} */
    get parentActor() {
        const parent = this.parent;
        return this.#isComponent(parent) ? parent.#actor : parent;
    }

    /** @type {Component} may return an instance of St.Widget instead */
    get parent() {
        if (!this.isMapped) return null;
        const actorParent = this.#actor.get_parent();
        return this.#isComponent(actorParent?._delegate) ?? actorParent;
    }

    /** @type {ComponentLocation} */
    get location() {
        const monitorRect = this.monitorRect;
        if (!monitorRect) return null;
        const rect = this.rect;
        const monitorCenter = (monitorRect.y + monitorRect.height) / 2;
        if (rect.y < monitorCenter) return ComponentLocation.Top;
        else ComponentLocation.Bottom;
    }

    /** @type {Meta.Rect} */
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

    /** @type {Meta.Rect} */
    get rect() {
        if (!this.isMapped) return null;
        const result = new Meta.Rectangle();
        [result.x, result.y] = this.#actor.get_transformed_position();
        [result.width, result.height] = this.#actor.get_transformed_size();
        return result;
    }

    /** @type {boolean} */
    get isMapped() {
        return this.isValid && this.#actor.mapped === true && this.#actor.get_stage() !== null;
    }

    /** @type {boolean} */
    get isValid() {
        return this.#isValid && this.#actor instanceof St.Widget;
    }

    /** @type {number} */
    get globalScale() {
        if (!this.#actor) return 0;
        if (this.#themeContext) return this.#themeContext.scale_factor;
        this.#themeContext = St.ThemeContext.get_for_stage(global.stage);
        this.#themeContext.connectObject(Event.ScaleFactor, () => this.notifySelf(ComponentEvent.Scale), this.#actor);
        return this.#themeContext.scale_factor;
    }

    /** @type {number} */
    get uiScale() {
        if (!this.#actor) return 0;
        if (this.#uiSettings) return this.#uiSettings.get_double(UI_SCALE_SETTINGS_KEY);
        this.#uiSettings = new Gio.Settings({ schema_id: UI_SETTINGS_SCHEMA_ID });
        this.#uiSettings.connectObject(`changed::${UI_SCALE_SETTINGS_KEY}`, () => this.notifySelf(ComponentEvent.Scale), this.#actor);
        return this.#uiSettings.get_double(UI_SCALE_SETTINGS_KEY);
    }

    /** @param {number} value 0..999 */
    set position(value) {
        if (!this.#setPosition(value)) return;
        this.#defaultPosition = value;
    }

    /** @param {boolean} enabled */
    set positionLock(enabled) {
        this.#setPositionLock(enabled);
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
     * @param {St.Widget} actor
     */
    constructor(actor) {
        if (actor instanceof St.Widget === false) {
            throw new Error(`Unable to construct the component, ${actor} is not an instance of St.Widget`);
        }
        this.#actor = actor;
        this.#actor._delegate = this;
        this.#actor.connect(Event.Destroy, () => this.#destroy());
    }

    destroy() {
        this.#actor?.destroy();
    }

    /**
     * @param {Object.<string, *>} props
     * @returns {this}
     */
    setProps(props) {
        this.#actor?.set(props ?? {});
        return this;
    }

    /**
     * @param {St.Widget} parent Component instances are supported as well
     * @param {number} [position] -1..0..999
     * @returns {this}
     */
    setParent(parent, position = -1) {
        if (!this.isValid || typeof position !== Type.Number) return this;
        if (this.#isComponent(parent)) {
            parent = parent.actor;
        }
        if (parent instanceof St.Widget === false) return this;
        this.#defaultPosition = position;
        const oldParent = this.parentActor;
        const isParentChanged = oldParent !== parent;
        if (isParentChanged) {
            oldParent?.remove_actor(this.#actor);
            this.#setMappedHandler();
        }
        if (parent instanceof St.ScrollView) {
            if (isParentChanged) parent.add_actor(this.#actor);
            return this;
        }
        if (parent instanceof St.Bin) {
            if (isParentChanged) parent.set_child(this.#actor);
            return this;
        }
        if (isParentChanged) parent.insert_child_at_index(this.#actor, position);
        else this.#setPosition(position);
        return this;
    }

    /**
     * @returns {this}
     */
    resetSize() {
        return this.setSize(-1, -1);
    }

    /**
     * @param {number} width
     * @param {number} height
     * @returns {this}
     */
    setSize(width = -1, height = -1) {
        if (typeof width === Type.Number &&
            typeof height === Type.Number) this.#actor?.set_size(width, height);
        return this;
    }

    /**
     * @param {Clutter.ActorAlign} x
     * @param {Clutter.ActorAlign} y
     * @returns {this}
     */
    setAlign(x, y) {
        this.#actor?.set_x_align(x);
        this.#actor?.set_y_align(y);
        return this;
    }

    /**
     * @param {boolean} x
     * @param {boolean} y
     * @returns {this}
     */
    setExpand(x, y) {
        this.#actor?.set_x_expand(x === true);
        this.#actor?.set_y_expand(y === true);
        return this;
    }

    /**
     * @param {string} event
     * @param {(...args) => *} callback
     * @returns {number|string}
     */
    connect(event, callback) {
        if (typeof event !== Type.String ||
            typeof callback !== Type.Function) return null;
        if (event === ComponentEvent.Notify) {
            this.#notifyCallback = callback;
            return event;
        }
        return this.#actor?.connect(event, callback);
    }

    /**
     * @param {number|string} id
     * @returns {this}
     */
    disconnect(id) {
        if (typeof id === Type.Number) {
            this.#actor?.disconnect(id);
            return this;
        }
        if (typeof id !== Type.String) return this;
        if (id === ComponentEvent.Notify) {
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
        if (typeof event !== Type.String) return this;
        const children = this.#actor?.get_children();
        if (!children?.length) return this;
        for (let i = 0, l = children.length; i < l; ++i) {
            /** @type {Component} */
            const child = children[i]._delegate;
            if (!this.#isComponent(child)) continue;
            if (child.#notifySelf(event, child, params, this)) break;
        }
        return this;
    }

    /**
     * @param {string} event a custom event
     * @param {*} [params]
     * @returns {this}
     */
    notifySelf(event, params) {
        return this.#notifySelf(event, this, params);
    }

    /**
     * @param {*} source
     * @param {St.Widget} [actor]
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
     * @param {St.Widget} [actor]
     * @param {number} [x]
     * @param {number} [y]
     * @returns {Dnd.DragMotionResult}
     */
    handleDragOver(source, actor, x, y) {
        if (!this.#dropEvents) return Dnd.DragMotionResult.CONTINUE;
        return this.#notifySelf(ComponentEvent.DragOver, source, { actor, x, y }) ?? Dnd.DragMotionResult.CONTINUE;
    }

    /**
     * @returns {St.Widget}
     */
    getDragActor() {
        return this.#notifySelf(ComponentEvent.DragActorRequest) ?? this.#actor;
    }

    /**
     * @returns {St.Widget}
     */
    getDragActorSource() {
        return this.#actor;
    }

    #destroy() {
        this.#isValid = false;
        this.#actor?.remove_all_transitions();
        this.#setDragEvents(false);
        this.#notifySelf(ComponentEvent.Destroy);
        if (!this.#actor) return;
        this.#themeContext?.disconnectObject(this.#actor);
        this.#uiSettings?.disconnectObject(this.#actor);
        this.#uiSettings?.run_dispose();
        this.#themeContext = null;
        this.#uiSettings = null;
        this.#actor._delegate = null;
        this.#actor = null;
    }

    #setMappedHandler() {
        const handlerId = this.#actor?.connect(Event.Mapped, () => {
            this.#actor?.disconnect(handlerId);
            this.#notifySelf(ComponentEvent.Mapped);
        });
    }

    /**
     * @param {boolean} enabled
     */
    #setPositionLock(enabled) {
        if (this.#positionHandlerId) this.#actor?.disconnect(this.#positionHandlerId);
        this.#positionHandlerId = null;
        if (!enabled) return;
        this.#positionHandlerId = this.#actor?.connect(Event.Position, () => {
            if (!this.#setPosition(this.#defaultPosition)) return;
            this.#notifySelf(ComponentEvent.PositionLock);
        });
    }

    /**
     * @param {number} position -1..0...999
     * @returns {boolean}
     */
    #setPosition(position) {
        if (typeof position !== Type.Number) return false;
        const parentActor = this.parentActor;
        if (!parentActor) return false;
        const maxPosition = parentActor.get_n_children() - 1;
        if (position < 0 || position > maxPosition) {
            position = maxPosition;
        }
        const actorAtIndex = parentActor.get_child_at_index(position);
        if (actorAtIndex === this.#actor) return false;
        const componentAtIndex = this.#isComponent(actorAtIndex?._delegate);
        if (componentAtIndex && componentAtIndex.#positionHandlerId) return false;
        parentActor.set_child_at_index(this.#actor, position);
        return true;
    }

    /**
     * @param {boolean} enabled
     */
    #setDragEvents(enabled) {
        if (this.#dragMonitor) Dnd.removeDragMonitor(this.#dragMonitor);
        if (this.#draggable) this.#actor.disconnectObject(this.#draggable);
        this.#draggable?.disconnectAll();
        this.#draggable = null;
        this.#dragMonitor = null;
        if (!enabled || !this.#actor) return;
        this.#dragMonitor = {};
        this.#draggable = Dnd.makeDraggable(this.#actor, { manualMode: true, timeoutThreshold: DRAG_TIMEOUT_THRESHOLD });
        this.#draggable.connect(Event.DragBegin, () => this.#dragBegin());
        this.#draggable.connect(Event.DragEnd, () => this.#dragEnd());
        this.#dragMonitor.dragMotion = event => this.#dragMotion(event);
        this.#actor.connectObject(
            Event.ButtonPress, this.#draggable._onButtonPress.bind(this.#draggable),
            Event.Touch, this.#draggable._onTouchEvent.bind(this.#draggable),
        this.#draggable);
    }

    /**
     * @param {{ x: number, y: number, source: *, dragActor: *,  targetActor: * }} event
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
     * @param {Component} [sender=this]
     * @returns {this}
     */
    #notifyParents(event, params, sender = this) {
        if (typeof event !== Type.String) return this;
        const parent = this.parent;
        if (!this.#isComponent(parent)) return this;
        if (parent.#notifySelf(event, parent, params, sender)) return this;
        return parent.#notifyParents(event, params, sender);
    }

    /**
     * @param {string} event a custom event
     * @param {*} [target=this]
     * @param {*} [params]
     * @param {Component} [sender=this]
     * @returns {*}
     */
    #notifySelf(event, target = this, params, sender = this) {
        if (typeof this.#notifyCallback !== Type.Function) return null;
        try {
            return this.#notifyCallback({ event, target, params, sender });
        } catch (e) {
            logError(e, `Component notify failed for event ${event}`);
            return null;
        }
    }

    /**
     * @param {*} source 
     * @returns {Component|null}
     */
    #isComponent(source) {
        return source instanceof Component ? source : null;
    }

}
