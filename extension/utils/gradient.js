const INTENSITY_MIN = 0;
const INTENSITY_MAX = 10;
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
export const Gradient = (colorString, intensity = INTENSITY_MAX, ratio = INTENSITY_MIN, direction = GradientDirection.Vertical) => {
    if (typeof colorString !== 'string') return '';
    /** @type {string[]} */
    const color = colorString.replace(COLOR_REGEXP_STRING, '').split(COLOR_STRING_SPLITTER);
    color.length = COLOR_STRING_LENGTH;
    /** @type {number} */
    const startOpacity = Math.max(intensity - ratio, INTENSITY_MIN) / INTENSITY_MAX;
    /** @type {string} */
    const startColor = `rgba(${[...color, startOpacity].join(COLOR_STRING_SPLITTER)})`;
    /** @type {number} */
    const endOpacity = intensity / INTENSITY_MAX;
    /** @type {string} */
    const endColor = `rgba(${[...color, endOpacity].join(COLOR_STRING_SPLITTER)})`;
    return `${GRADIENT_STRING_DIRECTION}:${direction};${GRADIENT_STRING_START}:${startColor};${GRADIENT_STRING_END}:${endColor};`;
};
