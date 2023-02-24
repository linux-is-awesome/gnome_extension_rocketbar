/* exported Indicators */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Context } from '../../core/context.js';
import { Component, ComponentEvent } from '../base/component.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Indicator';

const ANIMATION_INTERVAL = 10;
const DEGREES = Math.PI / 180;

/** @type {Object.<string, number|boolean|string>} */
const DefaultProps = {
    name: MODULE_NAME,
    x_expand: true,
    y_expand: true,
    x_align: Clutter.ActorAlign.FILL,
    y_align: Clutter.ActorAlign.FILL
};

class IndicatorsBackend {

    #actor = null;

    #canvas = null;

    get canvas() {
        return this.#canvas;
    }

    get canvasSize() {
        return this.#actor?.get_surface_size();
    }

    set color(value) {
        if (!this.#canvas) return;
        const color = Clutter.color_from_string(value)[1];
        Clutter.cairo_set_source_color(this.#canvas, color);
    }

    constructor(actor) {
        this.#actor = actor;
    }

    destroy() {
        this.#canvas = null;
    }

    update() {}

    rerender() {
        this.#canvas = this.#actor?.get_context();
    }

    finish() {
        this.#canvas.fill();
        this.#canvas.$dispose();
        this.#canvas = null;
    }

    triggerRerender() {
        this.#actor?.queue_repaint();
    }

}

class RoundedIndicator {

    #index = 0;

    #radius = 0;

    #size = 0;

    #oldSize = 0;

    #targetSize = 0;

    #spacing = 0;

    get #realSize() {
        if (this.#targetSize === this.#size) return this.#targetSize - this.#spacing;
        if (this.#targetSize > this.#size && !this.#oldSize) return Math.min(this.#size, this.#targetSize - this.#spacing);
        if (this.#size > this.#targetSize && this.#targetSize === 0) return Math.min(this.#size, this.#oldSize - this.#spacing);
        return this.#size - this.#spacing;
    }

    get #rawSize() {
        const d = this.#radius * 2;
        return Math.max(this.#realSize - d, -(d - 1));
    }

    constructor(params = {}) {
        const { index, radius, spacing, size } = params;
        this.#index = index ?? 0;
        this.#radius = Math.max(radius ?? 0, 1);
        this.#targetSize = Math.max(size ?? 0, this.#radius * 2);
        this.#spacing = this.#index > 0 ? spacing ?? 0 : 0;
        this.#targetSize += this.#spacing;
    }

    get isValid() {
        return this.#size || this.#targetSize;
    }

    get size() {
        return this.#index > 0 ? this.#size : this.#rawSize;
    }

    get diff() {
        return Math.abs(this.#targetSize - this.#size);
    }

    destroy() {
        this.#targetSize = 0;
        this.#oldSize = this.#size;
    }

    resize(size) {
        if (!size) return;
        this.#targetSize = size + this.#spacing;
    }

    animate(step) {
        if (this.#targetSize < this.#size) {
            this.#size = Math.max(this.#size - step, this.#targetSize);
        } else if (this.#targetSize > this.#size) {
            this.#size = Math.min(this.#size + step, this.#targetSize);
        } else {
            this.#size = this.#targetSize;
            this.#oldSize = this.#size;
            return false;
        }
        return true;
    }

    draw(canvas, x, y) {
        x += this.#size - this.#realSize;
        canvas.newSubPath();
        canvas.arc(x, y + this.#radius, this.#radius, 90 * DEGREES, -90 * DEGREES);
        canvas.arc(x + this.#rawSize, y + this.#radius, this.#radius, -90 * DEGREES, 90 * DEGREES);
        canvas.closePath();
        return this.#size;
    }

}

class FlexibleIndicators extends IndicatorsBackend {

    #indicators = [];

    #animationStep = 1;

    /** @type {Job} */
    #job = Context.jobs.new(this, ANIMATION_INTERVAL);

    destroy() {
        super.destroy();
        this.#job?.destroy();
        this.#job = null;
    }

    update(params = {}) {
        this.#job.reset();
 
        const { count, isActive } = params;

        const width = isActive ? 10 : 4;
        const height = 2;
        const spacing = 4;

        if (count > this.#indicators.length) {
            this.#indicators.length = count;
        }

        let diff = 0;
        for (let i = 0, l = this.#indicators.length; i < l; ++i) {
            if (!this.#indicators[i]) {
                this.#indicators[i] = new RoundedIndicator({
                    index: i,
                    size: width,
                    radius: height,
                    spacing
                });
            }

            const indicator = this.#indicators[i];

            if (i < count) {
                indicator.resize(width);
            } else {
                indicator.destroy();
            }

            diff = Math.max(indicator.diff, diff);
        }
        this.#animationStep = Math.max(diff / 15, 0.5);
        this.#animate();
    }

    rerender() {
        super.rerender();

        this.color = 'white';

        const canvas = this.canvas;
        const [canvasWidth] = this.canvasSize;
        const center = canvasWidth / 2;

        let y = 0;
        let totalWidth = 0;

        for (let i = 0, l = this.#indicators.length; i < l; ++i) {
            totalWidth += this.#indicators[i].size;
        }

        let x = center - totalWidth / 2;

        for (let i = 0, l = this.#indicators.length; i < l; ++i) {
            x += this.#indicators[i].draw(canvas, x, y);
        }

        this.finish();
    }

    #animate() {
        this.#job.reset().then(() => {
            this.triggerRerender();
            let animationComplete = true;
            for (let i = 0, l = this.#indicators.length; i < l; ++i) {
                if (!this.#indicators[i].animate(this.#animationStep)) continue;
                animationComplete = false;
            }
            if (!animationComplete) return this.#animate();
            const indicators = [];
            for (let i = 0, l = this.#indicators.length; i < l; ++i) {
                const indicator = this.#indicators[i];
                if (!indicator.isValid) continue;
                indicators.push(indicator);
            }
            this.#indicators = indicators;
            this.triggerRerender();
        }).catch();
    }

}

export class Indicators extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy
    })[data?.event]?.call(this);

    /**
     * @typedef {import('./appButton.js').AppButton} AppButton
     * @type {AppButton}
     */
    #appButton = null;

    /** @type {IndicatorsBackend} */
    #backend = new FlexibleIndicators(this.actor);

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.DrawingArea(DefaultProps));
        this.#appButton = appButton;
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.connect('repaint', () => this.#backend?.rerender());
    }

    rerender() {
        if (!this.isMapped) return;
        this.#backend?.update({
            count: this.#appButton.windowsCount,
            isActive: this.#appButton.isActive
        });
    }

    #destroy() {
        this.#backend?.destroy();
        this.#backend = null;
    }

}
