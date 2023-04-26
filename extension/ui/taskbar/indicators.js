/* exported Indicators */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Main } from '../../core/legacy.js';
import { Context } from '../../core/context.js';
import { Event } from '../../core/enums.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Config } from '../../utils/config.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Indicators';
const ANIMATION_INTERVAL = 10;
const ANIMATION_FRAMES = 15;
const ANIMATION_STEP_MIN = 0.1;

/** @enum {string} */
const IndicatorsPosition = {
    Top: 'top',
    Bottom: 'bottom'
};

/** @enum {string} */
const ConfigFields = {
    limitInactive: 'indicator-display-limit',
    limitActive: 'indicator-display-limit-active',
    colorInactive: 'indicator-color-inactive',
    colorActive: 'indicator-color-active',
    dominantColorInactive: 'indicator-dominant-color-inactive',
    dominantColorActive: 'indicator-dominant-color-active',
    sizeInactive: 'indicator-width-inactive',
    sizeActive: 'indicator-width-active',
    spacingInactive: 'indicator-spacing-inactive',
    spacingActive: 'indicator-spacing-active',
    weightInactive: 'indicator-height-inactive',
    weightActive: 'indicator-height-active',
    offsetInactive: 'indicator-margin-inactive',
    offsetActive: 'indicator-margin-active',
    position: 'indicator-position'
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
    scale: 1,
    count: 0,
    color: 'white',
    size: 0,
    weight: 2,
    spacing: 0,
    offset: 0,
    position: IndicatorsPosition.Top
};

class IndicatorBase {

    /** @type {IndicatorBase} */
    #parent = null;

    /** @type {number} */
    #size = 0;

    /** @type {number} */
    #targetSize = 0;

    /** @type {number} */
    #animationStep = 1;

    /** @type {boolean} */
    get isValid() {
        return this.#size || this.#targetSize;
    }

    /** @type {number} */
    get size() {
        return this.#size;
    }

    /** @type {number} */
    get diff() {
        return this.#targetSize - this.#size;
    }

    /**
     * @param {IndicatorBase} [parent]
     * @param {number} [size]
     */
    constructor(parent = null, size = 0) {
        this.#parent = parent;
        this.#size = size ?? 0;
    }

    /**
     * @param {number} targetSize
     */
    update(targetSize) {
        this.#targetSize = targetSize ?? 0;
        this.#updateAnimationStep();
    }

    destroy() {
        this.#targetSize = 0;
        this.#updateAnimationStep();
    }

    /**
     * @returns {boolean}
     */
    animate() {
        const animationStep = this.#parent ? this.#parent.#animationStep : this.#animationStep;
        if (this.#targetSize < this.#size) {
            this.#size = Math.max(this.#size - animationStep, this.#targetSize);
        } else if (this.#targetSize > this.#size) {
            this.#size = Math.min(this.#size + animationStep, this.#targetSize);
        }
        return this.#targetSize !== this.#size;
    }

    #updateAnimationStep() {
        this.#animationStep = Math.max(Math.abs(this.diff) / ANIMATION_FRAMES, ANIMATION_STEP_MIN);
    }

}

class Indicator extends IndicatorBase {

    /** @type {number} */
    #index = 0;

    /** @type {number} */
    #weight = 0;

    /** @type {number} */
    #scale = 1;

    /** @type {IndicatorBase} */
    #spacer = null;

    /** @type {number} */
    get #size() {
        return super.size;
    }

    /** @type {number} */
    get #drawSize() {
        return Math.max(super.size - this.#weight, -(this.#weight - this.#scale));
    }

    /** @type {number} */
    get size() {
        return this.#index > 0 ? super.size + this.#spacer.size : this.#drawSize;
    }

    /** @type {number} */
    get diff() {
        return Math.abs(super.diff) + Math.abs(this.#spacer?.diff ?? 0);
    }

    /**
     * @param {number} index
     */
    constructor(index) {
        super();
        this.#index = index ?? 0;
    }

    destroy() {
        this.#spacer?.destroy();
        super.destroy();
    }

    /**
     * @param {Object.<string, number>} params
     */
    update(params = {}) {
        if (!params) return;
        const { size, weight, scale, spacing, count } = params;
        this.#weight = Math.max(weight ?? 0, 1);
        this.#scale = scale;
        if (count > 1 && !this.#spacer) {
            const spacerSize = this.#index === 0 && super.size ? spacing : 0;
            this.#spacer = new IndicatorBase(this, spacerSize);
        } else if (count === 1) {
            this.#spacer = null;
        }
        this.#spacer?.update(spacing);
        super.update(Math.max(size ?? 0, this.#weight));
    }

    /**
     * @returns {boolean}
     */
    animate() {
        const diff = super.diff;
        const spacerDiff = this.#spacer?.diff ?? 0;
        if (diff < 0 && spacerDiff < 0) {
            return this.#spacer.animate() || super.animate();
        } else if (diff > 0 && spacerDiff > 0) {
            return super.animate() || this.#spacer.animate();
        } else if ((diff < 0 || diff > 0) && spacerDiff) {
            const spacerResult = this.#spacer.animate();
            return super.animate() || spacerResult;
        }
        return super.animate() || this.#spacer?.animate();
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
        if (this.#index === 0 || super.size > 0) {
            const drawSize = this.#drawSize + (
                this.#index > 0 && !this.#spacer.size ?
                indicators[this.#index - 1].#size : 0
            );
            const arcX = x - drawSize;
            const angle = Math.PI / 2;
            const radius = this.#weight / 2;
            canvas.newSubPath();
            canvas.arc(arcX, y + radius, radius, angle, -angle);
            canvas.arc(arcX + drawSize, y + radius, radius, -angle, angle);
            canvas.closePath();
        }
        if (this.#index === 0) return;
        indicators[this.#index - 1].draw(canvas, x - this.size, y, indicators);
    }

}

class IndicatorsBackend {

    /** @type {St.DrawingArea} */
    #actor = null;

    /** @type {cairo.Context} */
    #canvas = null;

    /** @type {Clutter.Color} */
    #color = null;

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
        const { scale, count, size, weight, spacing } = params;
        if (count > this.#indicators.length) {
            this.#indicators.length = count;
        }
        if (!this.#indicators.length) return;
        for (let i = 0, l = this.#indicators.length; i < l; ++i) {
            if (!this.#indicators[i]) {
                this.#indicators[i] = new Indicator(i);
            }
            const indicator = this.#indicators[i];
            if (i < count) indicator.update({ scale, size, weight, spacing, count: l });
            else indicator.destroy();
        }
        this.#animate();
    }

    rerender() {
        this.#canvas = this.#actor?.get_context();
        if (!this.#canvas || !this.#indicators?.length) return this.#finish();
        const { color, weight, offset, position } = this.#params;
        this.#setColor(color);
        const [canvasWidth, canvasHeight] = this.#actor.get_surface_size();
        let x = canvasWidth / 2;
        let y = offset;
        if (position === IndicatorsPosition.Bottom) {
            y = canvasHeight - weight - offset;
        }
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
        this.#color = colorString ? Clutter.color_from_string(colorString)[1] : this.#color;
        if (!this.#color) return;
        Clutter.cairo_set_source_color(this.#canvas, this.#color);
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
            this.#job.reset().then(() => this.#triggerRerender());
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
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Scale]: this.rerender
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

    /** @type {string} */
    get #color() {
        const isActive = this.#isActive;
        const { colorActive, colorInactive,
                dominantColorActive, dominantColorInactive } = this.#config;
        const requiresDominantColor = (isActive && dominantColorActive) || (!isActive && dominantColorInactive);
        const dominantColor = requiresDominantColor ? this.#appButton?.dominantColor : null;
        if (isActive) return dominantColor ?? colorActive;
        return dominantColor ?? colorInactive;
    }

    /** @type {BackendParams} */
    get #backendParams() {
        const { limitActive, limitInactive, sizeActive, sizeInactive,
                spacingActive, spacingInactive, weightActive, weightInactive,
                offsetActive, offsetInactive, position } = this.#config;
        const scale = this.uiScale * this.globalScale;
        const isActive = this.#isActive;
        const count = Math.min(this.#appButton.windowsCount, isActive ? limitActive : limitInactive);
        const color = count > 0 ? this.#color : null;
        const size = (isActive ? sizeActive : sizeInactive) * scale;
        const spacing = (isActive ? spacingActive : spacingInactive) * scale;
        const weight = (isActive ? weightActive : weightInactive) * scale;
        const offset = (isActive ? offsetActive : offsetInactive) * scale;
        return { ...BackendParams, ...{ scale, count, color, size, spacing, weight, offset, position } };
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
