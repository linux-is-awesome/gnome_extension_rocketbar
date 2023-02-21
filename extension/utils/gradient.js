/* exported GradientDirection, Gradient */

import { Type } from '../core/enums';

const COLOR_REGEXP_STRING = /[^\d,]/g;
const COLOR_STRING_SPLITTER = ',';
const COLOR_STRING_LENGTH = 3;
const GRADIENT_STRING_DIRECTION = 'background-gradient-direction';
const GRADIENT_STRING_START = 'background-gradient-start';
const GRADIENT_STRING_END = 'background-gradient-end';

/** @enum {string} */
export const GradientDirection = {
    Vertical: 'vertical',
    Horizontal: 'horizontal'
};

/**
 * @param {string} colorString
 * @param {number} [intensity] 0..10
 * @param {number} [ratio] 0..10
 * @param {GradientDirection} [direction]
 * @returns {string}
 */
export const Gradient = (colorString, intensity = 10, ratio = 0, direction = GradientDirection.Vertical) => {
    if (typeof colorString !== Type.String) return '';
    /** @type {string[]} */
    const color = colorString.replace(COLOR_REGEXP_STRING, '').split(COLOR_STRING_SPLITTER);
    color.length = COLOR_STRING_LENGTH;
    /** @type {number} */
    const startOpacity = Math.max(intensity - ratio, 0) / 10;
    /** @type {string} */
    const startColor = [...color, startOpacity].join(COLOR_STRING_SPLITTER);
    /** @type {number} */
    const endOpacity = intensity / 10;
    /** @type {string} */
    const endColor = [...color, endOpacity].join(COLOR_STRING_SPLITTER);
    return `${GRADIENT_STRING_DIRECTION}:${direction};${GRADIENT_STRING_START}:${startColor};${GRADIENT_STRING_END}:${endColor};`
};
