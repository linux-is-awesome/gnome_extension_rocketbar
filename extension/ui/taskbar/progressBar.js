/* exported ProgressBar */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Context } from '../../core/context.js';
import { Event } from '../../core/enums.js';
import { Component, ComponentEvent } from '../base/component.js';

const MODULE_NAME = 'Rocketbar__Taskbar_ProgressBar';

/** @type {Object.<string, number|boolean|string>} */
const DefaultProps = {
    name: MODULE_NAME,
    x_expand: true,
    y_expand: true,
    x_align: Clutter.ActorAlign.FILL,
    y_align: Clutter.ActorAlign.FILL
};

export class ProgressBar extends Component {

    /**
     * @typedef {import('./appButton.js').AppButton} AppButton
     * @type {AppButton}
     */
    #appButton = null;

    #config = {
        width: 20,
        height: 4,
        margin: 1,
        borderSize: 0,
        backgroundColor: 'rgb(150, 150, 150)',
        progressColor: 'rgb(0, 150, 50)',
        position: 'bottom'
    };

    /** @type {number} 0..0.1...0.9..1 */
    #progress = 0;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.DrawingArea(DefaultProps));
        this.#appButton = appButton;
        //this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        this.connect(Event.Repaint, () => this.#draw());
    }

    rerender() {
        if (!this.isValid) return;
        const progress = this.#appButton?.progress;
        if (this.#progress === progress) return;
        this.#progress = progress;
        this.actor.queue_repaint();
    }

    #draw() {
        if (!this.#progress) return;
        const canvas = this.actor.get_context();
        if (!canvas) return;
        const { width, height, borderSize, margin, backgroundColor, progressColor, position } = this.#config;

        const [canvasWidth, canvasHeight] = this.actor.get_surface_size();

        let x = canvasWidth / 2;
        let y = margin;

        if (position === 'bottom') {
            y = canvasHeight - height - margin;
        }

        const angle = Math.PI / 2;
        const radius = height / 2;
        const drawWidth = width - height;
        const arcX = x - drawWidth / 2;
        const progressWidth = drawWidth * this.#progress;

        this.#setColor(canvas, backgroundColor);
        canvas.newSubPath();
        canvas.arc(arcX, y + radius, radius, angle, -angle);
        canvas.arc(arcX + drawWidth, y + radius, radius, -angle, angle);
        canvas.closePath();
        canvas.fillPreserve();
        canvas.setLineWidth(borderSize);
        canvas.stroke();
        this.#setColor(canvas, progressColor);
        canvas.newSubPath();
        canvas.arc(arcX, y + radius, radius, angle, -angle);
        canvas.arc(arcX + progressWidth, y + radius, radius, -angle, angle);
        canvas.closePath();
        canvas.fill();
        canvas.$dispose();
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
