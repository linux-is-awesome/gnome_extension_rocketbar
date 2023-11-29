/* exported TooltipTrigger */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Context } from '../../core/context.js';
import { Event } from '../../core/enums.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';
import { Config } from '../../utils/config.js';

const DefaultProps = {

};

const LayoutProps = {

};

class Tooltip extends Component {

    #layout = new St.Widget(LayoutProps);

    #appButton = null;

    get actor() {
        return this.#layout;
    }

    constructor() {
        super(St.Bin(DefaultProps));
        super.actor.set_child(this.#layout);
        this.#appButton = appButton;
    }

    destroy() {
        this.#appButton = null;
    }

}

export class TooltipTrigger {

    static tooltip = null;

    #appButton = null;

    #tooltip = null;

    // TODO: lazy loading!
    #config = null;

    constructor(appButton) {
        if (!appButton) return;
        this.#appButton = appButton;
        Context.signals.add(this, [
            this.#appButton.actor,
            Event.Hover, () => { },
            Event.FocusIn, () => { },
            Event.FocusOut, () => { },
            Event.ButtonPress, () => { }
        ]); 
    }

    destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#appButton = null;
    }

}
