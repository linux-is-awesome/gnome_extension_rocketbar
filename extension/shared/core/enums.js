/**
 * @enum {string} Standard GObject, Shell and GTK events to handle
 */
export const Event = {
    Active: 'notify::active',
    AppStateChanged: 'app-state-changed',
    ButtonPress: 'button-press-event',
    ButtonRelease: 'button-release-event',
    Captured: 'captured_event',
    Changed: 'changed',
    Checked: 'notify::checked',
    Clicked: 'clicked',
    Closed: 'closed',
    CloseRequest: 'close-request',
    CountChanged: 'notify::count',
    Destroy: 'destroy',
    DragBegin: 'drag-begin',
    DragCancelled: 'drag-cancelled',
    DragEnd: 'drag-end',
    FocusIn: 'key-focus-in',
    FocusOut: 'key-focus-out',
    FocusWindow: 'notify::focus-window',
    FontNameChanged: 'notify::font-name',
    Hover: 'notify::hover',
    IconClicked: 'icon-clicked',
    IconThemeChanged: 'notify::gtk-icon-theme',
    InstalledChanged: 'installed-changed',
    KeyPress: 'key-press-event',
    Leave: 'leave-event',
    Mapped: 'notify::mapped',
    MenuClosed: 'menu-closed',
    Minimize: 'minimize',
    MonitorsChanged: 'monitors-changed',
    MoveX: 'notify::x',
    MoveY: 'notify::y',
    OpenStateChanged: 'open-state-changed',
    OverviewHidden: 'hidden',
    OverviewHiding: 'hiding',
    OverviewShowing: 'showing',
    OverviewShown: 'shown',
    Position: 'notify::position',
    Pressed: 'notify::pressed',
    QueueChanged: 'queue-changed',
    Repaint: 'repaint',
    SelectedItemChanged: 'notify::selected-item',
    ScaleFactor: 'notify::scale-factor',
    Scroll: 'scroll-event',
    SearchActive: 'notify::search-active',
    SourceAdded: 'source-added',
    SourceRemoved: 'source-removed',
    SourcesChanged: 'sources-changed',
    StartupComplete: 'startup-complete',
    SwitchWorkspace: 'switch-workspace',
    Touch: 'touch-event',
    TitleChanged: 'notify::title',
    Unminimize: 'unminimize',
    Unmanaged: 'unmanaged',
    Updated: 'updated',
    ValueChanged: 'notify::value',
    VisibleChanged: 'notify::visible',
    VisiblePageChanged: 'notify::visible-page',
    WindowAdded: 'window_added',
    WindowDemandsAttention: 'window-demands-attention',
    WindowMapped: 'map',
    WindowRemoved: 'window_removed'
};

/**
 * @enum {string}
 */
export const Property = {
    Name: 'name',
    Visible: 'visible',
    ShowBanners: 'showBanners'
};

/**
 * @enum {number}
 */
export const Delay = {
    Redraw: -1,
    Idle: 0,
    Queue: 100,
    Sleep: 300,
    Background: 500,
    Scheduled: 1000
};

/**
 * @enum {number}
 */
export const Progress = {
    Infinite: -1,
    Min: 0,
    Max: 1
};

/**
 * @enum {string}
 */
export const PseudoClass = {
    Hover: 'hover',
    Focus: 'focus',
    Active: 'active',
    Insensitive: 'insensitive'
};

/**
 * @enum {string}
 */
export const Alignment = {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
    Center: 'center',
    TopLeft: 'top-left',
    TopRight: 'top-right',
    BottomLeft: 'bottom-left',
    BottomRight: 'bottom-right'
};

/**
 * @enum {string} Shell session modes
 */
export const SessionMode = {
    Desktop: 'user',
    Locksreen: 'unlock-dialog'
};

/**
 * @enum {string}
 */
export const MetadataField = {
    Name: 'name',
    Url: 'url',
    SettingsSchema: 'settings-schema',
    VersionName: 'version-name'
};

/**
 * @enum {string}
 */
export const SettingsPath = {
    Panel: 'panel',
    Taskbar: 'taskbar',
    NotificationCounter: 'notification-counter'
};

/**
 * @enum {string}
 */
export const SettingsKey = {
    Modules: 'modules',
    LauncherApi: 'launcher-api',
    NotificationsLauncherApi: 'notifications-launcher-api',
    NotificationsCountAttentionSources: 'notifications-count-attention-sources',
    Items: 'items',
    SoundVolumeControl: 'sound-volume-control',
    ClickToHideOverview: 'click-to-hide-overview',
    ShowFavorites: 'show-favorites',
    IsolateWorkspaces: 'isolate-workspaces',
    ShowAllWindows: 'show-all-windows',
    Separator: 'separator',
    WindowRouting: 'window-routing',
    WindowsPreferredMonitor: 'windows-preferred-monitor',
    AppButtonMenus: 'appbutton-menus',
    AppButtonTooltips: 'appbutton-tooltips',
    AppButtonIndicators: 'appbutton-indicators',
    AppButtonNotificationBadges: 'appbutton-notification-badges',
    AppButtonProgressBars: 'appbutton-progress-bars',
    AppButtonSoundVolumeControl: 'appbutton-sound-volume-control',
    AppButtonDragAndDrop: 'appbutton-drag-and-drop',
    AppButtonScroll: 'appbutton-scroll',
    AppButtonIconSize: 'appbutton-icon-size',
    AppButtonIconPath: '~appbutton-icon-path',
    AppButtonIconHPadding: 'appbutton-icon-hpadding',
    AppButtonIconVPadding: 'appbutton-icon-vpadding',
    AppButtonSpacing: 'appbutton-spacing',
    AppButtonRoundness: 'appbutton-roundness',
    AppButtonBacklightColor: 'appbutton-backlight-color',
    AppButtonBacklightDominantColor: 'appbutton-backlight-dominant-color',
    AppButtonBacklightIntensity: 'appbutton-backlight-intensity',
    AppButtonActivateBehavior: 'appbutton-activate-behavior',
    AppButtonDemandsAttentionBehavior: 'appbutton-demands-attention-behavior',
    AppButtonMinimizeAction: 'appbutton-minimize-action',
    AppButtonConfigOverride: 'appbutton-config-override',
    IndicatorDominantColorActive: 'indicator-dominant-color-active',
    IndicatorColorActive: 'indicator-color-active',
    IndicatorDominantColorInactive: 'indicator-dominant-color-inactive',
    IndicatorColorInactive: 'indicator-color-inactive',
    IndicatorPosition: 'indicator-position',
    IndicatorSizeInactive: 'indicator-size-inactive',
    IndicatorSizeActive: 'indicator-size-active',
    IndicatorWeightInactive: 'indicator-weight-inactive',
    IndicatorWeightActive: 'indicator-weight-active',
    IndicatorSpacingInactive: 'indicator-spacing-inactive',
    IndicatorSpacingActive: 'indicator-spacing-active',
    IndicatorOffsetInactive: 'indicator-offset-inactive',
    IndicatorOffsetActive: 'indicator-offset-active',
    IndicatorLimitInactive: 'indicator-limit-inactive',
    IndicatorLimitActive: 'indicator-limit-active',
    NotificationBadgeColor: 'notification-badge-color',
    NotificationBadgeFontColor: 'notification-badge-font-color',
    NotificationBadgeBorderColor: 'notification-badge-border-color',
    NotificationBadgePosition: 'notification-badge-position',
    NotificationBadgeSize: 'notification-badge-size',
    NotificationBadgeRoundness: 'notification-badge-roundness',
    NotificationBadgeOffset: 'notification-badge-offset',
    NotificationBadgeMaxCount: 'notification-badge-max-count',
    TooltipShowDelay: 'tooltip-show-delay',
    TooltipHideDelay: 'tooltip-hide-delay',
    TooltipShrinkWindowTitles: 'tooltip-shrink-window-titles',
    TooltipWindowPreviews: 'tooltip-window-previews',
    ProgressBarPosition: 'progress-bar-position',
    ProgressBarWidth: 'progress-bar-width',
    ProgressBarHeight: 'progress-bar-height',
    ProgressBarOffset: 'progress-bar-offset',
    ProgressBarBackgroundColor: 'progress-bar-background-color',
    ProgressBarFillColor: 'progress-bar-fill-color',
    HideEhenEmpty: 'hide-when-empty',
    CenterClockPosition: 'center-clock-position',
    MaxCount: 'max-count',
    FontSize: 'font-size',
    Roundness: 'roundness',
    VerticalOffset: 'vertical-offset',
    ColorWhenEmpty: 'color-when-empty',
    ColorWhenNotEmpty: 'color-when-not-empty',
    ColorWhenEmptyDnd: 'color-when-empty-dnd',
    ColorWhenNotEmptyDnd: 'color-when-not-empty-dnd',
    TextColor: 'text-color',
    TextColorDnd: 'text-color-dnd'
};

/**
 * @enum {string}
 */
export const Module = {
    TweakOverviewKillDash: 'tweaks/overviewKillDash',
    TweakOverviewHideSearch: 'tweaks/overviewHideSearch',
    TweakOverviewClicks: 'tweaks/overviewClicks',
    TweakPopupsPreventFocus: 'tweaks/popupsPreventFocus',
    TweakPopupsNoDelay: 'tweaks/popupsNoDelay',
    TweakPrimaryInputSource: 'tweaks/primaryInputSource',
    TweakUpperCaseInputSource: 'tweaks/upperCaseInputSource',
    TweakMenusClickToOpen: 'tweaks/menusClickToOpen',
    TweakDndSystemNotifications: 'tweaks/dndSystemNotifications',
    Panel: 'ui/panel',
    NotificationCounter: 'ui/notificationCounter',
    Taskbar: 'ui/taskbar'
};
