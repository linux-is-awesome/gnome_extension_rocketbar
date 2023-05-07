/* exported ProgressBar */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Event } from '../../core/enums.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';

const MODULE_NAME = 'Rocketbar__Taskbar_ProgressBar';
const PROGRESS_VALUE_MIN = 0;
const PROGRESS_VALUE_MAX = 1;

/** @enum {string} */
const ProgressBarPosition = {
    Top: 'top',
    Bottom: 'bottom'
};

/** @enum {Object.<string, *>} */
const ProgressBarAnimation = {
    Show: { ...AnimationType.OpacityMax, ...AnimationType.ScaleMax },
    Hide: { ...AnimationType.OpacityMin, ...AnimationType.ScaleXMin, mode: Clutter.AnimationMode.EASE_OUT_QUAD }
};

/** @type {Object.<string, number|boolean>} */
const DefaultProps = {
    name: MODULE_NAME,
    x_expand: true,
    y_expand: true,
    x_align: Clutter.ActorAlign.FILL,
    y_align: Clutter.ActorAlign.FILL,
    ...AnimationType.ScaleXMin,
    ...AnimationType.OpacityMin
};

export class ProgressBar extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Scale]: () => this.actor?.queue_repaint()
    })[data?.event]?.call(this);

    /**
     * @typedef {import('./appButton.js').AppButton} AppButton
     * @type {AppButton}
     */
    #appButton = null;

    /** @type {Object.<string, string|number|boolean>} */
    #config = {
        width: 20,
        height: 4,
        margin: 1,
        backgroundColor: 'rgb(150, 150, 150)',
        progressColor: 'rgb(0, 150, 50)',
        position: ProgressBarPosition.Bottom
    };

    /** @type {number} 0..0.1...0.9..1 */
    #progress = PROGRESS_VALUE_MIN;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.DrawingArea(DefaultProps));
        this.actor.set_pivot_point(0.5, 0.5);
        this.#appButton = appButton;
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.connect(Event.Repaint, () => this.#draw());
    }

    rerender() {
        if (!this.isValid) return;
        const progress = this.#appButton?.progress;
        if (this.#progress === progress) return;
        const oldProgress = this.#progress;
        this.#progress = progress;
        if (oldProgress && !progress) Animation(this, AnimationDuration.Default, ProgressBarAnimation.Hide);
        else this.actor.queue_repaint();
    }

    #destroy() {
        this.#progress = null;
        this.#appButton = null;
    }

    #draw() {
        if (!this.#progress) return;
        const actor = this.actor;
        const canvas = actor.get_context();
        if (!canvas) return;
        const { width, height, margin, backgroundColor, progressColor, position } = this.#config;
        const [canvasWidth, canvasHeight] = actor.get_surface_size();
        const scale = this.uiScale * this.globalScale;
        const angle = Math.PI / 2;
        const radius = height / 2 * scale;
        const drawWidth = (width - height) * scale;
        const x = canvasWidth / 2 - drawWidth / 2;
        const y = position === ProgressBarPosition.Bottom ? canvasHeight - (height + margin) * scale : margin * scale;
        const progressWidth = drawWidth * this.#progress - radius * (PROGRESS_VALUE_MAX - this.#progress);
        this.#setColor(canvas, backgroundColor);
        canvas.newSubPath();
        canvas.arc(x, y + radius, radius, angle, -angle);
        canvas.arc(x + drawWidth, y + radius, radius, -angle, angle);
        canvas.closePath();
        canvas.fillPreserve();
        canvas.setLineWidth(0);
        canvas.stroke();
        this.#setColor(canvas, progressColor);
        canvas.newSubPath();
        canvas.arc(x, y + radius, radius, angle, -angle);
        canvas.arc(x + progressWidth, y + radius, radius, -angle, angle);
        canvas.closePath();
        canvas.fill();
        canvas.$dispose();
        if (actor.opacity === ProgressBarAnimation.Show.opacity) return;
        actor.set(AnimationType.OpacityDown);
        Animation(this, AnimationDuration.Default, ProgressBarAnimation.Show);
    }

    /**
     * @param {string} colorString
     */
    #setColor(canvas, colorString) {
        const color = Clutter.color_from_string(colorString)[1];
        if (!color) return;
        Clutter.cairo_set_source_color(canvas, color);
    }

}
