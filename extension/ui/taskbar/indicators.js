/* exported Indicators */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Main } from '../../core/legacy.js';
import { Context } from '../../core/context.js';
import { Event } from '../../core/enums.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Config } from '../../utils/config.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Indicator';
const ANIMATION_INTERVAL = 10;
const ANIMATION_FRAMES = 15;
const ANIMATION_STEP_MIN = 0.3;

/** @enum {string} */
const ConfigFields = {
    countLimit: 'indicator-display-limit',
    colorInactive: 'indicator-color-inactive',
    colorActive: 'indicator-color-active',
    sizeInactive: 'indicator-width-inactive',
    sizeActive: 'indicator-width-active',
    spacingInactive: 'indicator-spacing-inactive',
    spacingActive: 'indicator-spacing-active',
    weight: 'indicator-height-inactive'
};

/** @type {Object.<string, number|boolean|string>} */
const DefaultProps = {
    name: MODULE_NAME,
    x_expand: true,
    y_expand: true,
    x_align: Clutter.ActorAlign.FILL,
    y_align: Clutter.ActorAlign.FILL
};

/** @type {Object.<string, number|boolean|string>} */
const BackendParams = {
    count: 0,
    color: 'white',
    size: 0,
    weight: 2,
    spacing: 0
};

class Indicator {

    /** @type {number} */
    #index = 0;

    /** @type {number} */
    #weight = 0;

    /** @type {number} */
    #size = 0;

    /** @type {number} */
    #oldSize = 0;

    /** @type {number} */
    #targetSize = 0;

    /** @type {number} */
    #spacing = 0;

    /** @type {number} */
    #animationStep = 1;

    /** @type {number} */
    get #realSize() {
        if (this.#targetSize === this.#size) return this.#targetSize - this.#spacing;
        if (this.#targetSize > this.#size && !this.#oldSize) return Math.min(this.#size, this.#targetSize - this.#spacing);
        if (this.#size > this.#targetSize && !this.#targetSize) return Math.min(this.#size, this.#oldSize - this.#spacing);
        return this.#size - this.#spacing;
    }

    /** @type {number} */
    get #drawSize() {
        return Math.max(this.#realSize - this.#weight, -(this.#weight - 1));
    }

    /** @type {boolean} */
    get isValid() {
        return this.#size || this.#targetSize;
    }

    /** @type {number} */
    get size() {
        return this.#index > 0 ? this.#size : this.#drawSize;
    }

    /**
     * @param {number} index
     */
    constructor(index) {
        this.#index = index ?? 0;
    }

    /**
     * @param {Object.<string, number>} params
     */
    update(params = {}) {
        if (!params) return;
        const { size, weight, spacing } = params;
        this.#weight = Math.max(weight ?? 0, 1);
        this.#targetSize = Math.max(size ?? 0, this.#weight);
        this.#spacing = this.#index > 0 ? spacing ?? 0 : 0;
        this.#targetSize += this.#spacing;
        this.#updateAnimationStep();
    }

    destroy() {
        this.#targetSize = 0;
        this.#oldSize = this.#size;
        this.#updateAnimationStep();
    }

    /**
     * @returns {boolean}
     */
    animate() {
        if (this.#targetSize < this.#size) {
            this.#size = Math.max(this.#size - this.#animationStep, this.#targetSize);
        } else if (this.#targetSize > this.#size) {
            this.#size = Math.min(this.#size + this.#animationStep, this.#targetSize);
        } else {
            this.#size = this.#targetSize;
            this.#oldSize = this.#size;
            return false;
        }
        return true;
    }

    /**
     * Note: If spacing is 0, all indicators are drawn as a single line.
     *       It's not a bug!
     * 
     * @param {cairo.Context} canvas
     * @param {number} x
     * @param {number} y
     * @param {Indicator[]} indicators
     */
    draw(canvas, x, y, indicators) {
        const drawSize = this.#drawSize + (
            this.#index > 0 && this.#size - this.#realSize === 0 ?
            indicators[this.#index - 1].#realSize : 0
        );
        const arcX = x - drawSize;
        const angle = Math.PI / 2;
        const radius = this.#weight / 2;
        canvas.newSubPath();
        canvas.arc(arcX, y + radius, radius, angle, -angle);
        canvas.arc(arcX + drawSize, y + radius, radius, -angle, angle);
        canvas.closePath();
        if (this.#index === 0) return;
        indicators[this.#index - 1].draw(canvas, x - this.#size, y, indicators);
    }

    #updateAnimationStep() {
        const diff = Math.abs(this.#targetSize - this.#size);
        this.#animationStep = Math.max(diff / ANIMATION_FRAMES, ANIMATION_STEP_MIN);
    }

}

class IndicatorsBackend {

    /** @type {St.DrawingArea} */
    #actor = null;

    /** @type {cairo.Context} */
    #canvas = null;

    /** @type {Indicator[]} */
    #indicators = [];

    /** @type {BackendParams} */
    #params = BackendParams;

    /** @type {Job} */
    #job = Context.jobs.new(this, ANIMATION_INTERVAL);

    /**
     * @param {St.DrawingArea} actor
     */
    constructor(actor) {
        this.#actor = actor;
    }

    destroy() {
        this.#job?.destroy();
        this.#job = null;
        this.#indicators = null;
        this.#canvas = null;
    }

    /**
     * @param {BackendParams} params
     */
    update(params = BackendParams) {
        if (!this.#canUpdate(params)) return;
        this.#job.reset();
        const { count, size, weight, spacing } = params;
        if (count > this.#indicators.length) {
            this.#indicators.length = count;
        }
        if (!this.#indicators.length) return;
        for (let i = 0, l = this.#indicators.length; i < l; ++i) {
            if (!this.#indicators[i]) {
                this.#indicators[i] = new Indicator(i);
            }
            const indicator = this.#indicators[i];
            if (i < count) indicator.update({ size, weight, spacing });
            else indicator.destroy();
        }
        
        this.#animate();
    }

    rerender() {
        this.#canvas = this.#actor?.get_context();
        if (!this.#canvas || !this.#indicators?.length) return this.#finish();
        this.#setColor(this.#params.color);
        const [canvasWidth] = this.#actor.get_surface_size();
        let x = canvasWidth / 2;
        let y = 0;
        for (let i = 0, l = this.#indicators.length; i < l; ++i) {
            const indicator = this.#indicators[i];
            x += indicator.size / 2;
            if (i === l - 1) indicator.draw(this.#canvas, x, y, this.#indicators)
        }
        this.#finish();
    }

    /**
     * @param {Object.<string, *>} params
     * @returns {boolean}
     */
    #canUpdate(params) {
        if (!this.#job || !params) return false;
        if (JSON.stringify(params) === JSON.stringify(this.#params)) return false;
        this.#params = params;
        return true;
    }

    /**
     * @param {string} colorString
     */
    #setColor(colorString) {
        const color = Clutter.color_from_string(colorString)[1];
        Clutter.cairo_set_source_color(this.#canvas, color);
    }

    #animate() {
        this.#job.reset().then(() => {
            this.#triggerRerender();
            const validIndicators = [];
            let animationsCount = 0;
            for (let i = 0, l = this.#indicators.length; i < l; ++i) {
                const indicator = this.#indicators[i];
                if (indicator.animate()) animationsCount++;
                if (indicator.isValid) validIndicators.push(indicator);
            }
            if (animationsCount) return this.#animate();
            this.#indicators = validIndicators;
            this.#triggerRerender();
        }).catch();
    }

    #finish() {
        if (!this.#canvas) return;
        this.#canvas.fill();
        this.#canvas.$dispose();
        this.#canvas = null;
    }

    #triggerRerender() {
        this.#actor?.queue_repaint();
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

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, () => this.rerender());

    /** @type {IndicatorsBackend} */
    #backend = new IndicatorsBackend(this.actor);

    /** @type {boolean} */
    get #isActive() {
        return !Main.overview?._shown && this.#appButton.isActive;
    }

    /** @type {BackendParams} */
    get #backendParams() {
        const isActive = this.#isActive;
        const count = Math.min(this.#appButton.windowsCount, this.#config.countLimit);
        const color = isActive ? this.#config.colorActive : this.#config.colorInactive;
        const size = isActive ? this.#config.sizeActive : this.#config.sizeInactive;
        const spacing = isActive ? this.#config.spacingActive : this.#config.spacingInactive;
        const weight = this.#config.weight;
        return { ...BackendParams, ...{ count, color, size, spacing, weight } };
    };

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.DrawingArea(DefaultProps));
        this.#appButton = appButton;
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.connect(Event.Repaint, () => this.#backend?.rerender());
    }

    rerender() {
        if (!this.isMapped) return;
        this.#backend?.update(this.#backendParams);
    }

    #destroy() {
        this.#backend?.destroy();
        this.#backend = null;
    }

}
