import { SettingsPath, SettingsKey } from './settings.js';

/** @type {{[option: string]: *}} */
export const ConfigOptions = {
    path: SettingsPath.NotificationCounter
};

/** @enum {string} */
export const ConfigField = {
    hideEmpty: SettingsKey.HideEhenEmpty,
    centerClock: SettingsKey.CenterClockPosition,
    maxCount: SettingsKey.MaxCount,
    fontSize: SettingsKey.FontSize,
    roundness: SettingsKey.Roundness,
    offset: SettingsKey.VerticalOffset,
    colorEmpty: SettingsKey.ColorWhenEmpty,
    colorNotEmpty: SettingsKey.ColorWhenNotEmpty,
    textColor: SettingsKey.TextColor,
    colorEmptyDnd: SettingsKey.ColorWhenEmptyDnd,
    colorNotEmptyDnd: SettingsKey.ColorWhenNotEmptyDnd,
    textColorDnd: SettingsKey.TextColorDnd
};
