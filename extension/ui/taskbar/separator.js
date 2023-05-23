/* exported Separator */

import St from 'gi://St';
import Meta from 'gi://Meta';
import { Component } from '../base/component.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';

export class Separator extends Component {

    /** @type {Meta.Rectangle} */
    get rect() {
        if (!this.isValid) return null;
        const width = 10;
        const height = 20;
        const scale = this.uiScale;
        const result = new Meta.Rectangle();
        [result.width, result.height] = [width * scale * this.globalScale, height * scale];
        [result.x, result.y] = this.actor.get_transformed_position();
        return result;
    }

    constructor() {
        super(new St.Bin({ width: 0 }));
    }

    show() {
        this.actor.remove_all_transitions();
        Animation(this, AnimationDuration.Fast, { width: 10 });
    }

    hide() {
        this.actor.remove_all_transitions();
        Animation(this, AnimationDuration.Fast, { width: 0 });
    }

}
