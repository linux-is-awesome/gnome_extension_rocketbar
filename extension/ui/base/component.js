/* exported Component */

const Extension = imports.misc.extensionUtils.getCurrentExtension();

const { St } = imports.gi;
const { Type, Event } = Extension.imports.ui.base.enums;

var Component = class {

    /** @type {St.Widget} */
    #actor = null;

    /** @type {Function} { event, params, target, sender } => {...} */
    #notifyCallback = null;

    /** @type {Number} */
    #defaultPosition = 0;

    /** @type {Number} */
    #positionHandlerId = null;

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
        return this.#isComponent(actorParent._delegate) ?? actorParent;
    }

    /** @type {Boolean} */
    get isMapped() {
        return this.isValid && this.#actor.mapped === true && this.#actor.get_stage() !== null;
    }

    /** @type {Boolean} */
    get isValid() {
        return this.#actor instanceof St.Widget;
    }

    /**
     * @param {St.Widget} actor required
     */
    constructor(actor) {
        if (actor instanceof St.Widget === false) {
            throw `Unable to construct the component, ${actor} is not an instance of St.Widget.`;
        }
        this.#actor = actor;
        this.#actor._delegate = this;
        this.#actor.connect(Event.Destroy, () => this.#destroy());
    }

    destroy() {
        this.#actor.remove_all_transitions();
        this.#actor?.destroy();
        this.#destroy();
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
     * @return {Component} self
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
     * @return {Component} self
     */
    addChild(child, position = 0) {
        if (!this.#isComponent(child)) {
            throw `Unable to add the child, ${child} is not an instance of Component.`;
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
     * @param {Number} position required, 0..999
     * @return {Component} self
     */
    setPosition(position = 0) {
        if (this.#setPosition(position)) {
            this.#defaultPosition = position;
        }
        return this;
    }

    /**
     * @param {Boolean} state required
     * @param {Function} callback optional
     * @returns {Component} self
     */
    setPositionLock(state, callback) {
        if (this.#positionHandlerId) this.disconnect(this.#positionHandlerId);
        this.#positionHandlerId = null;
        if (!state) return;
        this.#positionHandlerId = this.connect(Event.Position, () => {
            if (this.#setPosition(this.#defaultPosition) &&
                typeof callback === Type.Function) callback(this);
        });
        return this;
    }

    /**
     * @param {String} event required
     * @param {Function} callback required
     * @return {Number} handler id
     */
    connect(event, callback) {
        if (typeof event !== Type.String) return null;
        if (event === Event.ComponentNotify) {
            this.#notifyCallback = callback;
            return null;
        }
        return this.#actor?.connect(event, callback);
    }

    /**
     * @param {Number} id required
     * @return {Component} self
     */
    disconnect(id) {
        if (typeof id === Type.Number) this.#actor?.disconnect(id);
        return this;
    }

    /**
     * @param {String} event required, a custom event
     * @param {Object} params optional
     * @returns {Component} self
     */
    notifyParents(event, params) {
        if (typeof event !== Type.String) return this;
        const parent = this.parent;
        if (!this.#isComponent(parent)) return this;
        const notifyCallback = parent.#notifyCallback;
        if (typeof notifyCallback === Type.Function &&
            notifyCallback({ event, params, target: parent, sender: this })) return this;
        return parent.notifyParents(event, params);
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
            const notifyCallback = child.#notifyCallback;
            if (typeof notifyCallback === Type.Function &&
                notifyCallback({ event, params, target: child, sender: this })) return this;
        }
        return this;
    }

    #destroy() {
        if (!this.#actor) return;
        this.#actor._delegate = null;
        this.#actor = null;
    }

    /**
     * @param {Number} position required, 0..999
     * @return {Boolean}
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
     * @param {Object} source 
     * @returns {Component|null}
     */
    #isComponent(source) {
        return source instanceof Component ? source : null;
    }

    #setMappedHandler() {
        const handlerId = this.connect(Event.Mapped, () => {
            this.disconnect(handlerId);
            if (typeof this.#notifyCallback !== Type.Function) return;
            this.#notifyCallback({ event: Event.Mapped, target: this, sender: this });
        });
    }

}
