import { Monitor } from './general.js';
import { SettingsKey, SettingsPath } from './settings.js';

/** @type {{path: string}} */
export const ConfigOptions = {
    path: SettingsPath.Taskbar
};

/** @enum {string} */
export const ConfigKey = {
    IconSize: 'iconSize',
    IconPath: 'iconPath',
    IconSizeOffset: 'iconSizeOffset',
    ActivateBehavior: 'activateBehavior',
    AttentionBehavior: 'attentionBehavior',
    AttentionNotificationsBehavior: 'attentionNotificationsBehavior',
    PreferredMonitor: 'preferredMonitor',
    AppConfig: 'appConfig'
};

/** @enum {string} */
export const ConfigField = {
    enableSeparator: SettingsKey.Separator
};

/** @enum {string} */
export const ServiceConfigField = {
    favorites: SettingsKey.ShowFavorites,
    windowRouting: SettingsKey.WindowRouting,
    windowRoutingWatchdog: SettingsKey.WindowRoutnigWatchdog,
    showAllWindows: SettingsKey.ShowAllWindows,
    isolateWorkspaces: SettingsKey.IsolateWorkspaces,
    preferredMonitor: SettingsKey.PreferredMonitor,
    attentionBehavior: SettingsKey.AttentionBehavior,
    attentionNotificationsBehavior: SettingsKey.AttentionNotificationsBehavior,
    [ConfigKey.AppConfig]: SettingsKey.AppButtonConfigOverride
};

/** @enum {string} */
export const AppConfigField = {
    isolateWorkspaces: SettingsKey.IsolateWorkspaces,
    windowRouting: SettingsKey.WindowRouting,
    preferredMonitor: SettingsKey.PreferredMonitor,
    attentionBehavior: SettingsKey.AttentionBehavior,
    attentionNotificationsBehavior: SettingsKey.AttentionNotificationsBehavior,
    activateBehavior: SettingsKey.AppButtonActivateBehavior,
    enableIndicators: SettingsKey.AppButtonIndicators,
    enableMenus: SettingsKey.AppButtonMenus,
    enableTooltips: SettingsKey.AppButtonTooltips,
    enableNotificationBadges: SettingsKey.AppButtonNotificationBadges,
    enableProgressBars: SettingsKey.AppButtonProgressBars,
    enableSoundControl: SettingsKey.AppButtonSoundVolumeControl,
    enableMinimizeAction: SettingsKey.AppButtonMinimizeAction,
    enableDragAndDrop: SettingsKey.AppButtonDragAndDrop,
    enableScroll: SettingsKey.AppButtonScroll,
    iconSize: SettingsKey.AppButtonIconSize,
    iconPath: SettingsKey.AppButtonIconPath,
    iconHPadding: SettingsKey.AppButtonIconHPadding,
    iconVPadding: SettingsKey.AppButtonIconVPadding,
    spacingAfter: SettingsKey.AppButtonSpacing,
    roundness: SettingsKey.AppButtonRoundness,
    backlightColor: SettingsKey.AppButtonBacklightColor,
    backlightIntensity: SettingsKey.AppButtonBacklightIntensity,
    backlightDominantColor: SettingsKey.AppButtonBacklightDominantColor
};

/** @enum {string} */
export const IndicatorsConfigField = {
    limitInactive: SettingsKey.IndicatorLimitInactive,
    limitActive: SettingsKey.IndicatorLimitActive,
    colorInactive: SettingsKey.IndicatorColorInactive,
    colorActive: SettingsKey.IndicatorColorActive,
    dominantColorInactive: SettingsKey.IndicatorDominantColorInactive,
    dominantColorActive: SettingsKey.IndicatorDominantColorActive,
    sizeInactive: SettingsKey.IndicatorSizeInactive,
    sizeActive: SettingsKey.IndicatorSizeActive,
    spacingInactive: SettingsKey.IndicatorSpacingActive,
    spacingActive: SettingsKey.IndicatorSpacingActive,
    weightInactive: SettingsKey.IndicatorWeightInactive,
    weightActive: SettingsKey.IndicatorWeightActive,
    offsetInactive: SettingsKey.IndicatorOffsetInactive,
    offsetActive: SettingsKey.IndicatorOffsetActive,
    position: SettingsKey.IndicatorPosition
};

/** @enum {string} */
export const NotificationBadgeConfigField = {
    color: SettingsKey.NotificationBadgeColor,
    fontColor: SettingsKey.NotificationBadgeFontColor,
    borderColor: SettingsKey.NotificationBadgeBorderColor,
    position: SettingsKey.NotificationBadgePosition,
    size: SettingsKey.NotificationBadgeSize,
    offset: SettingsKey.NotificationBadgeOffset,
    roundness: SettingsKey.NotificationBadgeRoundness,
    maxCount: SettingsKey.NotificationBadgeMaxCount
};

/** @enum {string} */
export const ProgressBarConfigField = {
    position: SettingsKey.ProgressBarPosition,
    width: SettingsKey.ProgressBarWidth,
    height: SettingsKey.ProgressBarHeight,
    offset: SettingsKey.ProgressBarOffset,
    backgroundColor: SettingsKey.ProgressBarBackgroundColor,
    fillColor: SettingsKey.ProgressBarFillColor
};

/** @enum {string} */
export const TooltipConfigField = {
    showDelay: SettingsKey.TooltipShowDelay,
    hideDelay: SettingsKey.TooltipHideDelay,
    shrinkWindowTitles: SettingsKey.TooltipShrinkWindowTitles,
    enableWindowPreviews: SettingsKey.TooltipWindowPreviews
};

/** @enum {string} */
export const ActivateBehavior = {
    NewWindow: 'new_window',
    FindWindow: 'find_window',
    MoveWindows: 'move_windows'
};

/** @enum {string} */
export const AttentionBehavior = {
    Default: 'default',
    FocusActive: 'focus_active',
    FocusWorkspace: 'focus_workspace',
    FocusAll: 'focus_all'
};

/** @enum {string} */
export const AttentionNotificationsBehavior = {
    Default: 'default',
    Disable: 'disable',
    Hide: 'hide',
    Show: 'show',
    Critical: 'critical'
};

/** @enum {string} */
export const PreferredMonitor = {
    ...Monitor,
    Default: 'default'
};

/** @enum {number} */
export const AppIconSize = {
    Min: 16,
    Max: 64
};
