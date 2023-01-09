/* exported AnimationDuration, AnimationType, Animation */

const Extension = imports.ui.extensionSystem.rocketbar;

const { St, Clutter } = imports.gi;
const { Component } = Extension.imports.ui.base.component;

/** @enum {number} */
var AnimationDuration = {
    Faster: 100,
    Fast: 200,
    Normal: 300,
    Slow: 400,
    Slower: 500
};

/** @enum {*} */
var AnimationType = {
    ScaleMax: { scale_x: 1, scale_y: 1 },
    ScaleMin: { scale_x: 0, scale_y: 0 },
    OpacityMax: { opacity: 255 },
    OpacityMin: { opacity: 0 }
}

/**
 * @param {St.Widget|Component} actor
 * @param {number} [duration]
 * @param {*} [params]
 * @returns {Promise}
 */
var Animation = (actor, duration = 0, params = {}) => {
    if (actor instanceof Component) {
        actor = actor.actor;
    }
    if (actor instanceof St.Widget === false) return null;
    if (!duration) return new Promise(resolve => resolve());
    return new Promise(resolve => actor.ease({ ...params, duration, onComplete: resolve }));
};