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
    soundVolumeControl: SettingsKey.SoundVolumeControl,
    clickToHideOverview: SettingsKey.ClickToHideOverview
};
