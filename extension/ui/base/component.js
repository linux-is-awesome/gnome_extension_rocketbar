/* exported ComponentEvent, Component */

const Extension = imports.ui.extensionSystem.rocketbar;

const Dnd = imports.ui.dnd;
const { St } = imports.gi;
const { Type, Event } = Extension.imports.core.enums;

const DRAG_TIMEOUT_THRESHOLD = 200;

/** 
 * @enum {string}
 */
var ComponentEvent = {
    Notify: 'component::notify',
    Mapped: 'component::mapped',
    Destroy: 'component::destroy',
    PositionLock: 'component::position-lock',
    AcceptDrop: 'component::accept-drop',
    DragOver: 'component::drag-over',
    DragBegin: 'component::drag-begin',
    DragEnd: 'component::drag-end',
    DragMotion: 'component::drag-motion',
    DragActorRequest: 'component::drag-actor-request'
}

var Component = class {

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

    /** @type {Array<number>} */
    #dragHandlerIds = null;

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

    /** @type {boolean} */
    get isMapped() {
        return this.isValid && this.#actor.mapped === true && this.#actor.get_stage() !== null;
    }

    /** @type {boolean} */
    get isValid() {
        return this.#isValid && this.#actor instanceof St.Widget;
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
            throw new Error(`Unable to construct the component, ${actor} is not an instance of St.Widget.`);
        }
        this.#actor = actor;
        this.#actor._delegate = this;
        this.#actor.connect(Event.Destroy, () => this.#destroy());
    }

    destroy() {
        this.#actor?.destroy();
    }

    /**
     * @param {(component: this) => this} callback
     */
    configure(callback) {
        if (typeof callback === Type.Function) callback(this);
        return this;
    }

    /**
     * @param {St.Widget} parent Component instances are supported as well
     * @param {number} [position] 0..999
     * @returns {this}
     */
    setParent(parent, position = 0) {
        if (typeof position !== Type.Number) return this;
        if (this.#isComponent(parent)) {
            parent = parent.#actor;
        }
        if (parent instanceof St.Widget === false) return this;
        this.#defaultPosition = position;
        const currentParent = this.parentActor;
        const isParentChanged = currentParent !== parent;
        if (isParentChanged) {
            currentParent?.remove_child(this.#actor);
            this.#setMappedHandler();
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
     * @param {Component} child
     * @param {number} [position] 0..999
     * @returns {this}
     */
    addChild(child, position = 0) {
        if (!this.#isComponent(child)) {
            throw new Error(`Unable to add the child, ${child} is not an instance of Component.`);
        }
        child.setParent(this.#actor, position);
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
     * @param {number} position 0..999
     * @returns {boolean}
     */
    #setPosition(position) {
        if (typeof position !== Type.Number) return false;
        const parentActor = this.parentActor;
        if (!parentActor) return false;
        const maxPosition = parentActor.get_n_children();
        if (position > maxPosition) position = maxPosition;
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
        this.#dragHandlerIds?.forEach(handlerId => this.#actor?.disconnect(handlerId));
        this.#draggable?.disconnectAll();
        this.#draggable = null;
        this.#dragMonitor = null;
        this.#dragHandlerIds = null;
        if (!enabled || !this.#actor) return;
        this.#dragMonitor = {};
        this.#dragHandlerIds = new Set();
        this.#draggable = Dnd.makeDraggable(this.#actor, { manualMode: true, timeoutThreshold: DRAG_TIMEOUT_THRESHOLD });
        this.#draggable.connect(Event.DragBegin, () => this.#dragBegin());
        this.#draggable.connect(Event.DragEnd, () => this.#dragEnd());
        this.#dragMonitor.dragMotion = event => this.#dragMotion(event);
        this.#dragHandlerIds.add(this.#actor.connect(Event.ButtonPress, this.#draggable._onButtonPress.bind(this.#draggable)));
        this.#dragHandlerIds.add(this.#actor.connect(Event.Touch, this.#draggable._onTouchEvent.bind(this.#draggable)));
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
        return this.#notifyCallback({ event, target, params, sender });
    }

    /**
     * @param {*} source 
     * @returns {Component|null}
     */
    #isComponent(source) {
        return source instanceof Component ? source : null;
    }

}
