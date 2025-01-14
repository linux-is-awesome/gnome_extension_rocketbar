/**
 * @typedef {import('resource:///org/gnome/shell/ui/boxpointer.js').BoxPointer} BoxPointer
 */

import St from 'gi://St';
import Context from '../../main/context.js';
import { Component } from './component.js';

/** @enum {number} */
export const AnimationDuration = {
    Disabled: 0,
    Faster: 100,
    Fast: 150,
    Default: 200,
    Slow: 250,
    Slower: 300,
    Crawl: 400
};

/** @enum {{[animation: string]: *}} */
export const AnimationType = {
    ScaleTriple: { scale_x: 2, scale_y: 2 },
    ScaleDouble: { scale_x: 2, scale_y: 2 },
    ScaleNormal: { scale_x: 1, scale_y: 1 },
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
 * @returns {Promise<boolean>}
 */
const AdjustmentAnimation = (actor, duration, params) => {
    const value = params.value ?? 0;
    delete params.value;
    const canAnimate = duration > AnimationDuration.Disabled && Context.systemSettings.enableAnimations;
    if (!canAnimate) return new Promise(resolve => (actor.set_value(value), resolve(true)));
    return new Promise(resolve => actor.ease(value, { ...params, duration, onStopped: resolve }));
};

/**
 * @param {St.Widget|BoxPointer} actor
 * @param {number} duration
 * @param {{[param: string]: *}} params
 * @returns {Promise<boolean>}
 */
const WidgetAnimation = (actor, duration, params) => {
    const canAnimate = actor.mapped &&
                       duration > AnimationDuration.Disabled &&
                       Context.systemSettings.enableAnimations;
    if (!canAnimate) return new Promise(resolve => (actor.set(params), resolve(true)));
    return new Promise(resolve => actor.ease({ ...params, duration, onStopped: resolve }));
};

/**
 * @param {St.Widget|St.Adjustment|BoxPointer|Component<St.Widget>} actor
 * @param {number} [duration]
 * @param {{[param: string]: *}?} [params]
 * @returns {Promise<boolean>}
 */
export const Animation = (actor, duration, params) => {
    params = { ...params ?? {} };
    duration ??= AnimationDuration.Disabled;
    if (actor instanceof Component && actor.isValid) {
        actor = actor.actor ?? actor;
    }
    if (actor instanceof St.Widget) return WidgetAnimation(actor, duration, params);
    else if (actor instanceof St.Adjustment) return AdjustmentAnimation(actor, duration, params);
    else throw new Error(`${Animation.name} failed, unsupported actor ${actor}.`);
};
