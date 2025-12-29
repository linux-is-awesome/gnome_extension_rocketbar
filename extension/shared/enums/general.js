/**
 * @enum {string} Standard GObject, Shell and GTK events to handle
 */
export const Event = {
    ActiveChanged: 'notify::active',
    Activated: 'activated',
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
    EnableExpansionChanged: 'notify::enable-expansion',
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
    RgbaChanged: 'notify::rgba',
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
    WindowMarkedUrgent: 'window-marked-urgent',
    WindowRemoved: 'window_removed',
    WindowEnteredMonitor: 'window-entered-monitor'
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
 * @enum {string}
 */
export const Monitor = {
    Primary: 'primary',
    Left: 'left',
    Right: 'right',
    Above: 'above',
    Below: 'below'
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

/**
 * @enum {string}
 */
export const PreferencesPage = {
    About: 'about',
    Panel: 'panel',
    Tweaks: 'tweaks',
    Misc: 'misc',
    NotificationCounter: 'notificationCounter',
    Taskbar: 'taskbar',
    TaskbarAppButton: 'taskbar/appButton',
    TaskbarIndicators: 'taskbar/indicators',
    TaskbarNotificationBadges: 'taskbar/notificationBadges',
    TaskbarProgressBars: 'taskbar/progressBars',
    TaskbarTooltips: 'taskbar/tooltips'
};
