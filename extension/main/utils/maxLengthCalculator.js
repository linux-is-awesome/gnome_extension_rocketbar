/** @type {{Min: number, Max: number}} */
export const MaxLengthBounds = {
    Min: 10,
    Max: 100
};

/**
 * @param {number} length
 * @param {number} percent
 * @returns {number}
 */
export const MaxLengthCalculator = (length, percent) => {
    percent = Math.max(MaxLengthBounds.Min, Math.min(MaxLengthBounds.Max, percent));
    return Math.round(length * (percent / 100));
};
