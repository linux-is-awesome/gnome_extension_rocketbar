import { SettingsKey, SettingsPath } from './settings.js';

/** @type {{path: string}} */
export const ConfigOptions = {
    path: SettingsPath.Panel
};

/** @enum {string} */
export const ConfigKey = {
    Items: 'items'
};

/** @enum {string} */
export const ConfigField = {
    [ConfigKey.Items]: SettingsKey.Items,
    position: SettingsKey.Position,
    heightAdjustment: SettingsKey.HeightAdjustment,
    height: SettingsKey.Height,
    transparency: SettingsKey.Transparency,
    dynamicTransparency: SettingsKey.DynamicTransparency,
    soundVolumeControl: SettingsKey.SoundVolumeControl,
    clickToHideOverview: SettingsKey.ClickToHideOverview
};
