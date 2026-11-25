/**
 * @typedef {import('gi://cairo').Context} cairo.Context
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 * @typedef {import('../../../shared/core/context/jobs.js').Jobs.Job} Job
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Context from '../../core/context.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { SharedConfig } from '../../../shared/utils/config.js';
import { Event, Progress, Alignment } from '../../../shared/enums/general.js';
import { ProgressBarConfigField as ConfigField,
         ConfigOptions } from '../../../shared/enums/taskbar.js';

const MODULE_NAME = 'Rocketbar__Taskbar_ProgressBar';
const INFINITE_PROGRESS_STEP = 0.01;
const INFINITE_PROGRESS_DELAY = 15;

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    name: MODULE_NAME,
    x_expand: true,
    y_expand: true,
    x_align: Clutter.ActorAlign.FILL,
    y_align: Clutter.ActorAlign.FILL
};

/**
 * @augments Component<St.DrawingArea>
 */
export class ProgressBar extends Component {

    /** @type {SharedConfig?} */
    static #sharedConfig = null;

    /** @type {{[event: string]: (instance: ProgressBar, data?: *) => *}} */
    static #events = {
        [ComponentEvent.Destroy]: instance => instance.#destroy()
    };

    static {
        this.notifyCallback = (instance, data) => this.#events[data?.event]?.(instance, data);
    }

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {number} */
    #progress = Progress.Min;

    /** @type {number} -1..0..1 */
    #infiniteProgress = Progress.Min;

    /** @type {Job?} */
    #infiniteProgressJob = null;

    /** @type {Cogl.Color?} */
    #backgroundColor = null;

    /** @type {Cogl.Color?} */
    #fillColor = null;

    /** @type {Config?} */
    #config = this.#configProvider.get(this, settingsKey => this.#handleConfig(settingsKey));

    /** @type {SharedConfig} */
    get #configProvider() {
        ProgressBar.#sharedConfig ??= new SharedConfig(ConfigField, ConfigOptions);
        return ProgressBar.#sharedConfig;
    }

    /** @type {{[param: string]: *}?} */
    get #drawParams() {
        if (!this.#config) return null;
        const { width, height, offset, backgroundColor, fillColor, position } = this.#config;
        const { fontScale, globalScale } = Context.desktop;
        const [canvasWidth, canvasHeight] = this.actor.get_surface_size();
        const scale = fontScale * globalScale;
        const isInfiniteProgress = this.#progress === Progress.Infinite;
        const progress = isInfiniteProgress ? Math.abs(this.#infiniteProgress) : this.#progress ?? Progress.Min;
        const angle = Math.PI / 2;
        const radius = height / 2 * scale;
        const drawWidth = (width - height) * scale;
        const x = (canvasWidth - drawWidth) / 2;
        const y = position === Alignment.Bottom ? canvasHeight - (height + offset) * scale : offset * scale;
        const drawHeight = y + radius;
        const progressWidth = drawWidth * progress - radius * (Progress.Max - progress);
        const progressX = x + (isInfiniteProgress && this.#infiniteProgress < 0 ? drawWidth - progressWidth : 0);
        return { x, drawWidth, drawHeight, progressX, progressWidth, radius, angle, backgroundColor, fillColor };
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.DrawingArea(DefaultProps));
        this.#appButton = appButton;
        this.actor.set_pivot_point(0.5, 0.5);
        this.connect(Event.Repaint, () => this.#draw());
        Context.desktop.connectScale(this, () => this.actor.queue_repaint());
    }

    /**
     * @returns {Promise<void>}
     */
    async rerender() {
        if (!this.isValid) return;
        const progress = this.#appButton?.progress ?? Progress.Min;
        if (this.#progress === progress) return;
        const isFinal = this.#progress && !progress;
        this.#progress = progress;
        if (this.#progress === Progress.Infinite) return this.#toggleInfiniteProgress();
        if (!isFinal) return this.actor.queue_repaint();
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const animationParams = { ...AnimationType.OpacityMin, ...AnimationType.ScaleXMin, mode };
        await Animation(this, AnimationDuration.Default, animationParams);
    }

    /**
     * @param {string} [settingsKey]
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            case ConfigField.backgroundColor:
                this.#backgroundColor = null;
                break;
            case ConfigField.fillColor:
                this.#fillColor = null;
                break;
        }
        this.actor.queue_repaint();
    }

    #destroy() {
        Context.desktop.disconnect(this);
        this.#progress = Progress.Min;
        this.#toggleInfiniteProgress();
        this.#backgroundColor = null;
        this.#fillColor = null;
        this.#appButton = null;
        this.#config = null;
        if (!ProgressBar.#sharedConfig?.destroy(this)) return;
        ProgressBar.#sharedConfig = null;
    }

    #toggleInfiniteProgress() {
        if (this.#progress !== Progress.Infinite) {
            this.#infiniteProgress = Progress.Min;
            this.#infiniteProgressJob?.destroy();
            this.#infiniteProgressJob = null;
            return;
        }
        this.#infiniteProgress *= ~~this.#infiniteProgress === Progress.Max ? -1 : 1;
        this.#infiniteProgress += INFINITE_PROGRESS_STEP;
        this.actor.queue_repaint();
        this.#infiniteProgressJob ??= Context.jobs.new(this, INFINITE_PROGRESS_DELAY);
        this.#infiniteProgressJob.enqueue(() => this.#toggleInfiniteProgress());
    }

    #draw() {
        if (!this.#progress) return;
        const actor = this.actor;
        const canvas = actor.get_context();
        if (!canvas) return;
        const drawParams = this.#drawParams;
        if (!drawParams) return;
        const { x, progressX, drawWidth, drawHeight,
                progressWidth, radius, angle,
                backgroundColor, fillColor } = drawParams;
        this.#backgroundColor ??= Cogl.Color.from_string(backgroundColor)[1];
        this.#fillColor ??= Cogl.Color.from_string(fillColor)[1];
        if (this.#backgroundColor) canvas.setSourceColor(this.#backgroundColor);
        canvas.newSubPath();
        canvas.arc(x, drawHeight, radius, angle, -angle);
        canvas.arc(x + drawWidth, drawHeight, radius, -angle, angle);
        canvas.closePath();
        canvas.fillPreserve();
        canvas.setLineWidth(0);
        canvas.stroke();
        if (this.#fillColor) canvas.setSourceColor(this.#fillColor);
        canvas.newSubPath();
        canvas.arc(progressX, drawHeight, radius, angle, -angle);
        canvas.arc(progressX + progressWidth, drawHeight, radius, -angle, angle);
        canvas.closePath();
        canvas.fill();
        canvas.$dispose();
        if (actor.opacity === AnimationType.OpacityMax.opacity) return;
        actor.remove_all_transitions();
        this.setProps({ ...AnimationType.OpacityMax, ...AnimationType.ScaleNormal });
    }

}
