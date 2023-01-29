/* exported ScrollView */

import St from 'gi://St';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';

/** @type {Object.<string, boolean|number>} */
const DefaultProps = {
    clip_to_allocation: true,
    reactive: false,
    hscrollbar_policy: St.PolicyType.EXTERNAL,
    vscrollbar_policy: St.PolicyType.NEVER   
};

export class ScrollView extends Component {

    /** @type {Component} */
    #layout = new Component(new St.BoxLayout());

    /** @type {St.BoxLayout} */
    get actor() {
        return this.#layout?.actor;
    }

    /** @type {St.ScrollView} */
    get area() {
        return super.actor;
    }

    /**
     * @param {string} [name] 
     */
    constructor(name = null) {
        super(new St.ScrollView({ name, ...DefaultProps }));
        this.#layout.connect(Event.Destroy, () => this.#layout = null);
        this.#layout.setParent(super.actor);
        if (typeof name !== Type.String) return;
        this.#layout.setProps({ name: `${name}.Layout` });
    }

}
