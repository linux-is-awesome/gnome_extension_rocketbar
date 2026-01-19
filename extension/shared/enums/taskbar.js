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
    ActivationBehavior: 'activationBehavior',
    AttentionBehavior: 'attentionBehavior',
    AttentionNotificationsBehavior: 'attentionNotificationsBehavior',
    NotificationsBehavior: 'notificationsBehavior',
    PreferredMonitor: 'preferredMonitor',
    AppConfig: 'appConfig'
};

/** @enum {string} */
export const ConfigField = {
    enableSeparator: SettingsKey.Separator,
    maxLength: SettingsKey.MaxLength
};

/** @enum {string} */
export const ServiceConfigField = {
    favorites: SettingsKey.ShowFavorites,
    windowRouting: SettingsKey.WindowRouting,
    windowRoutingWatchdog: SettingsKey.WindowRoutnigWatchdog,
    showAllWindows: SettingsKey.ShowAllWindows,
    isolateWorkspaces: SettingsKey.IsolateWorkspaces,
    preferredMonitor: SettingsKey.PreferredMonitor,
    activationBehavior: SettingsKey.ActivationBehavior,
    attentionBehavior: SettingsKey.AttentionBehavior,
    attentionNotificationsBehavior: SettingsKey.AttentionNotificationsBehavior,
    notificationsBehavior: SettingsKey.NotificationsBehavior,
    appConfig: SettingsKey.AppButtonConfigOverride
};

/** @enum {string} */
export const AppConfigField = {
    isolateWorkspaces: SettingsKey.IsolateWorkspaces,
    windowRouting: SettingsKey.WindowRouting,
    preferredMonitor: SettingsKey.PreferredMonitor,
    attentionBehavior: SettingsKey.AttentionBehavior,
    attentionNotificationsBehavior: SettingsKey.AttentionNotificationsBehavior,
    notificationsBehavior: SettingsKey.NotificationsBehavior,
    activationBehavior: SettingsKey.ActivationBehavior
};

/** @enum {string} */
export const AppButtonConfigField = {
    enableIndicators: SettingsKey.AppButtonIndicators,
    enableTooltips: SettingsKey.AppButtonTooltips,
    enableNotificationBadges: SettingsKey.AppButtonNotificationBadges,
    enableProgressBars: SettingsKey.AppButtonProgressBars,
    enableMenus: SettingsKey.AppButtonMenus,
    enableSoundControl: SettingsKey.AppButtonSoundVolumeControl,
    enableMinimizeAction: SettingsKey.AppButtonMinimizeAction,
    enableDragAndDrop: SettingsKey.AppButtonDragAndDrop,
    scrollAction: SettingsKey.AppButtonScrollAction,
    iconSize: SettingsKey.AppButtonIconSize,
    iconPath: SettingsKey.AppButtonIconPath,
    iconHPadding: SettingsKey.AppButtonIconHPadding,
    iconVPadding: SettingsKey.AppButtonIconVPadding,
    spacingAfter: SettingsKey.AppButtonSpacing,
    roundness: SettingsKey.AppButtonRoundness,
    backlightColor: SettingsKey.AppButtonBacklightColor,
    backlightColorType: SettingsKey.AppButtonBacklightColorType,
    backlightIntensity: SettingsKey.AppButtonBacklightIntensity
};

/** @enum {string} */
export const IndicatorsConfigField = {
    limitInactive: SettingsKey.IndicatorLimitInactive,
    limitActive: SettingsKey.IndicatorLimitActive,
    colorInactive: SettingsKey.IndicatorColorInactive,
    colorActive: SettingsKey.IndicatorColorActive,
    colorTypeActive: SettingsKey.IndicatorColorTypeActive,
    colorTypeInactive: SettingsKey.IndicatorColorTypeInactive,
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
    maxLength: SettingsKey.TooltipMaxLength,
    shrinkWindowTitles: SettingsKey.TooltipShrinkWindowTitles,
    enableWindowPreviews: SettingsKey.TooltipWindowPreviews
};

/** @enum {string} */
export const ActivationBehavior = {
    Default: 'default',
    FindWindow: 'find-window',
    MoveWindows: 'move-windows'
};

/** @enum {string} */
export const AttentionBehavior = {
    Default: 'default',
    FocusActive: 'focus-active',
    FocusWorkspace: 'focus-workspace',
    FocusAll: 'focus-all'
};

/** @enum {string} */
export const NotificationsBehavior = {
    Default: 'default',
    Disable: 'disable',
    Hide: 'hide',
    Show: 'show',
    Critical: 'critical'
};

/** @enum {string} */
export const PreferredMonitor = {
    Default: 'default',
    ...Monitor
};

/** @enum {number} */
export const AppIconSize = {
    Min: 16,
    Max: 64
};

/** @enum {string} */
export const ColorType = {
    Static: 'static',
    Dominant: 'dominant'
};

/** @enum {string} */
export const ScrollAction = {
    None: 'none',
    CycleAllWindows: 'cycle-all-windows',
    CycleRecentWindows: 'cycle-recent-windows',
    ChangeOutputSoundVolume: 'change-output-sound-volume',
    ChangeInputSoundVolume: 'change-input-sound-volume'
};
