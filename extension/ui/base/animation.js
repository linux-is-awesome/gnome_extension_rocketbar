/**
 * JSDoc types
 *
 * @typedef {import('resource:///org/gnome/shell/ui/boxpointer.js').BoxPointer} BoxPointer
 */

import St from 'gi://St';
import Context from '../../core/context.js';
import { Component } from './component.js';

/** @enum {number} */
export const AnimationDuration = {
    Disabled: 0,
    Faster: 100,
    Fast: 150,
    Default: 200,
    Slow: 250,
    Slower: 300
};

/** @enum {{[animation: string]: *}} */
export const AnimationType = {
    ScaleMax: { scale_x: 1, scale_y: 1 },
    ScaleDown: { scale_x: 0.85, scale_y: 0.85 },
    ScaleMin: { scale_x: 0, scale_y: 0 },
    ScaleXMin: { scale_x: 0 },
    OpacityMax: { opacity: 255 },
    OpacityDown: { opacity: 180 },
    OpacityMin: { opacity: 0 },
    TranslationReset: { translation_x: 0, translation_y: 0 }
};

/**
 * @param {St.Adjustment} actor
 * @param {number} duration
 * @param {{[param: string]: *}} params
 * @returns {Promise<void>}
 */
const AdjustmentAnimation = (actor, duration, params) => {
    const value = params.value ?? 0;
    delete params.value;
    const canAnimate = duration > AnimationDuration.Disabled && Context.systemSettings.enableAnimations;
    if (!canAnimate) return new Promise(resolve => (actor.set_value(value), resolve()));
    return new Promise(resolve => actor.ease(value, { ...params, duration, onComplete: resolve }));
};

/**
 * @param {St.Widget|BoxPointer} actor
 * @param {number} duration
 * @param {{[param: string]: *}} params
 * @returns {Promise<void>}
 */
const WidgetAnimation = (actor, duration, params) => {
    const canAnimate = duration > AnimationDuration.Disabled && Context.systemSettings.enableAnimations;
    if (!canAnimate) {
        delete params.delay;
        delete params.mode;
        return new Promise(resolve => (actor.set(params), resolve()));
    }
    return new Promise(resolve => actor.ease({ ...params, duration, onComplete: resolve }));
};

/**
 * @param {St.Widget|St.Adjustment|BoxPointer|Component<St.Widget>} actor
 * @param {number} [duration]
 * @param {{[param: string]: *}?} [params]
 * @returns {Promise<void>}
 */
export const Animation = (actor, duration, params) => {
    params ??= {};
    duration ??= AnimationDuration.Disabled;
    if (actor instanceof Component && actor.isValid) {
        actor = actor.actor ?? actor;
    }
    if (actor instanceof St.Widget) return WidgetAnimation(actor, duration, params);
    if (actor instanceof St.Adjustment) return AdjustmentAnimation(actor, duration, params);
    return new Promise(resolve => resolve());
};
