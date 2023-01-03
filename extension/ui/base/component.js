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
    PositionLock: 'component::position-lock',
    AcceptDrop: 'component::accept-drop',
    DragOver: 'component::drag-over',
    DragBegin: 'component::drag-begin',
    DragEnd: 'component::drag-end',
    DragMotion: 'component::drag-motion',
    DragActorRequest: 'component::drag-actor-request'
}

var Component = class {

    /** @type {St.Widget} */
    #actor = null;

    /** @type {Dnd._Draggable} */
    #draggable = null;

    /** @type {Function} { event, params, target, sender } => {...} */
    #notifyCallback = null;

    /** @type {Number} */
    #defaultPosition = 0;

    /** @type {Number} */
    #positionHandlerId = null;

    /** @type {Boolean} */
    #dropEvents = false;

    /** @type {Object} */
    #dragMonitor = null;

    /** @type {Array<Number>} */
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

    /** @type {Boolean} */
    get isMapped() {
        return this.isValid && this.#actor.mapped === true && this.#actor.get_stage() !== null;
    }

    /** @type {Boolean} */
    get isValid() {
        return this.#actor instanceof St.Widget;
    }

    /** @param {Number} value 0..999 */
    set position(value) {
        if (!this.#setPosition(value)) return;
        this.#defaultPosition = value;
    }

    /** @param {Boolean} enabled */
    set positionLock(enabled) {
        this.#setPositionLock(enabled);
    }

    /** @param {Boolean} enabled */
    set dropEvents(enabled) {
        this.#dropEvents = enabled;
    }

    /** @param {Boolean} enabled */
    set dragEvents(enabled) {
        this.#setDragEvents(enabled);
    }

    /**
     * @param {St.Widget} actor required
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
     * @param {Function} callback required
     */
    configure(callback) {
        if (typeof callback === Type.Function) callback(this);
        return this;
    }

    /**
     * @param {St.Widget} parent required, Component instances are supported as well
     * @param {Number} position optional, 0..999
     * @returns {Component} self
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
     * @param {Component} child required
     * @param {Number} position optional, 0..999
     * @returns {Component} self
     */
    addChild(child, position = 0) {
        if (!this.#isComponent(child)) {
            throw new Error(`Unable to add the child, ${child} is not an instance of Component.`);
        }
        child.setParent(this.#actor, position);
        return this;
    }

    /**
     * @returns {Component} self
     */
    resetSize() {
        return this.setSize(-1, -1);
    }

    /**
     * @param {Number} width
     * @param {Number} height
     * @returns {Component} self
     */
    setSize(width = -1, height = -1) {
        if (typeof width === Type.Number && typeof height === Type.Number) {
            this.#actor?.set_size(width, height);
        }
        return this;
    }

    /**
     * @param {Clutter.ActorAlign} x
     * @param {Clutter.ActorAlign} y
     * @returns {Component} self
     */
    setAlign(x, y) {
        this.#actor?.set_x_align(x);
        this.#actor?.set_y_align(y);
        return this;
    }

    /**
     * @param {Boolean} x
     * @param {Boolean} y
     * @returns {Component} self
     */
    setExpand(x, y) {
        this.#actor?.set_x_expand(x === true);
        this.#actor?.set_y_expand(y === true);
        return this;
    }

    /**
     * @param {String} event required
     * @param {Function} callback required
     * @returns {Number|String} handler id
     */
    connect(event, callback) {
        if (typeof event !== Type.String ||
            typeof callback !== Type.Function) return null;
        switch (event) {
            case ComponentEvent.Notify:
                this.#notifyCallback = callback;
                return event;
            default:
        }
        return this.#actor?.connect(event, callback);
    }

    /**
     * @param {Number|String} id required
     * @returns {Component} self
     */
    disconnect(id) {
        if (typeof id === Type.Number) {
            this.#actor?.disconnect(id);
            return this;
        }
        if (typeof id !== Type.String) return this;
        switch (id) {
            case ComponentEvent.Notify:
                this.#notifyCallback = null;
                break;
            default:
        }
        return this;
    }

    /**
     * @param {String} event required, a custom event
     * @param {Object} params optional
     * @returns {Component} self
     */
    notifyParents(event, params) {
        return this.#notifyParents(this, event, params);
    }

    /**
     * @param {String} event required, a custom event
     * @param {Object} params optional
     * @returns {Component} self
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
     * @param {Object} source required
     * @param {St.Widget} actor optional
     * @param {Number} x optional
     * @param {Number} y optional
     * @returns {Boolean} result
     */
    acceptDrop(source, actor, x, y) {
        if (!this.#dropEvents) return false;
        return this.#notifySelf(ComponentEvent.AcceptDrop, source, { actor, x, y }) ?? false;
    }

    /**
     * @param {Object} source required
     * @param {St.Widget} actor optional
     * @param {Number} x optional
     * @param {Number} y optional
     * @returns {Boolean} result
     */
    handleDragOver(source, actor, x, y) {
        if (!this.#dropEvents) return Dnd.DragMotionResult.CONTINUE;
        return this.#notifySelf(ComponentEvent.DragOver, source, { actor, x, y }) ?? Dnd.DragMotionResult.CONTINUE;
    }

    /**
     * @returns {St.Widget} result
     */
    getDragActor() {
        return this.#notifySelf(ComponentEvent.DragActorRequest) ?? this.#actor;
    }

    /**
     * @returns {St.Widget} this component's actor
     */
    getDragActorSource() {
        return this.#actor;
    }

    #destroy() {
        this.#setDragEvents(false);
        if (!this.#actor) return;
        this.#actor.remove_all_transitions();
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
     * @param {Boolean} enabled required
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
     * @param {Number} position required, 0..999
     * @returns {Boolean}
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
     * @param {Boolean} enabled required
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
     * @param {Component} sender required
     * @param {String} event required, a custom event
     * @param {Object} params optional
     * @returns {Component} self
     */
    #notifyParents(sender, event, params) {
        if (typeof event !== Type.String) return this;
        const parent = this.parent;
        if (!this.#isComponent(parent)) return this;
        if (parent.#notifySelf(event, parent, params, sender)) return this;
        return parent.#notifyParents(sender, event, params);
    }

    /**
     * @param {String} event required, a custom event
     * @param {Object} target required, this by default
     * @param {Object} params optional
     * @param {Component} sender optional, this by default
     * @returns {Object} result
     */
    #notifySelf(event, target, params, sender) {
        if (typeof this.#notifyCallback !== Type.Function) return null;
        return this.#notifyCallback({ event, target: target ?? this, params, sender: sender ?? this });
    }

    /**
     * @param {Object} source 
     * @returns {Component|null}
     */
    #isComponent(source) {
        return source instanceof Component ? source : null;
    }

}
