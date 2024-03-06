/** @enum {string} */
const SoundOutputIcon = {
    Muted: 'audio-volume-muted-symbolic',
    Low: 'audio-volume-low-symbolic',
    Medium: 'audio-volume-medium-symbolic',
    High: 'audio-volume-high-symbolic'
};

/** @enum {string} */
const SoundInputIcon = {
    Muted: 'microphone-sensitivity-muted-symbolic',
    Low: 'microphone-sensitivity-low-symbolic',
    Medium: 'microphone-sensitivity-medium-symbolic',
    High: 'microphone-sensitivity-high-symbolic'
};

/** @enum {number} */
const SoundVolumeIconIndex = {
    Muted: 0,
    Low: 1,
    Medium: 2,
    High: 3
};

/**
 * @param {number} volumeLevel positive float values 0..0.1...0.8..0.9..1
 * @param {boolean} [isInput]
 * @returns {string}
 */
export const SoundVolumeIcon = (volumeLevel, isInput = false) => {
    const icons = isInput ? SoundInputIcon : SoundOutputIcon;
    if (typeof volumeLevel !== 'number' ||
        volumeLevel <= SoundVolumeIconIndex.Muted) return icons.Muted;
    let iconIndex = Math.trunc(SoundVolumeIconIndex.High * volumeLevel + SoundVolumeIconIndex.Low);
    iconIndex = Math.min(SoundVolumeIconIndex.High, Math.max(SoundVolumeIconIndex.Low, iconIndex));
    return Object.values(icons)[iconIndex];
};
