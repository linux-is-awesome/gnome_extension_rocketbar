/* exported AnimationDuration, AnimationType, Animation */

import St from 'gi://St';
import { Component } from './component.js';

/** @enum {number} */
export const AnimationDuration = {
    Faster: 100,
    Fast: 150,
    Default: 200,
    Slow: 250,
    Slower: 300
};

/** @enum {*} */
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
 * @param {St.Widget|St.Adjustment|Component} actor
 * @param {number} [duration]
 * @param {*} [params]
 * @returns {Promise|null}
 */
export const Animation = (actor, duration = 0, params = {}) => {
    const canAnimate = St.Settings.get()?.enable_animations ?? false;
    if (actor instanceof St.Adjustment) {
        const value = params?.value ?? 0;
        delete params?.value;
        if (!canAnimate) return new Promise(resolve => actor.set_value(value) ?? resolve());
        return new Promise(resolve => actor.ease(value, { ...params, duration, onComplete: resolve }));
    }
    if (actor instanceof Component) {
        actor = actor.actor;
    }
    if (actor instanceof St.Widget === false) return null;
    if (!canAnimate) {
        delete params.delay;
        delete params.mode;
        return new Promise(resolve => actor.set(params) ?? resolve());
    }
    return new Promise(resolve => actor.ease({ ...params, duration, onComplete: resolve }));
};
