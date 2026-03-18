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
    CloseRequest: 'close-request',
    CountChanged: 'notify::count',
    Destroy: 'destroy',
    DndLeave: 'dnd-leave',
    DndPositionChange: 'dnd-position-change',
    DragBegin: 'drag-begin',
    DragCancelled: 'drag-cancelled',
    DragEnd: 'drag-end',
    EnableExpansionChanged: 'notify::enable-expansion',
    FocusIn: 'key-focus-in',
    FocusOut: 'key-focus-out',
    FocusWindow: 'notify::focus-window',
    FontNameChanged: 'notify::font-name',
    HeightChanged: 'notify::height',
    Hiding: 'hiding',
    Hover: 'notify::hover',
    IconClicked: 'icon-clicked',
    IconThemeChanged: 'notify::gtk-icon-theme',
    InstalledChanged: 'installed-changed',
    KeyPress: 'key-press-event',
    KeymapChanged: 'keymap-changed',
    Leave: 'leave-event',
    Mapped: 'notify::mapped',
    MenuClosed: 'menu-closed',
    Minimize: 'minimize',
    MonitorsChanged: 'monitors-changed',
    MoveX: 'notify::x',
    MoveY: 'notify::y',
    OpenStateChanged: 'open-state-changed',
    ParentChanged: 'parent-set',
    Pressed: 'notify::pressed',
    QueueChanged: 'queue-changed',
    Repaint: 'repaint',
    RgbaChanged: 'notify::rgba',
    ScaleFactor: 'notify::scale-factor',
    Scroll: 'scroll-event',
    SearchActive: 'notify::search-active',
    SelectedItemChanged: 'notify::selected-item',
    Showing: 'showing',
    Shutdown: 'shutdown',
    SourceAdded: 'source-added',
    SourceRemoved: 'source-removed',
    SourcesChanged: 'sources-changed',
    StartupComplete: 'startup-complete',
    StartupPrepared: 'startup-prepared',
    SwitchWorkspace: 'switch-workspace',
    TitleChanged: 'notify::title',
    Touch: 'touch-event',
    Unmanaged: 'unmanaged',
    Unminimize: 'unminimize',
    Updated: 'updated',
    ValueChanged: 'notify::value',
    VisibleChanged: 'notify::visible',
    VisiblePageChanged: 'notify::visible-page',
    WindowAdded: 'window_added',
    WindowCreated: 'window-created',
    WindowDemandsAttention: 'window-demands-attention',
    WindowEnteredMonitor: 'window-entered-monitor',
    WindowMapped: 'map',
    WindowMarkedUrgent: 'window-marked-urgent',
    WindowMaximized: 'notify::maximized-vertically',
    WindowMinimized: 'notify::minimized',
    WindowPositionChanged: 'position-changed',
    WindowRemoved: 'window_removed',
    WindowSizeChanged: 'size-changed'
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
    Debounce: 10,
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
    Insensitive: 'insensitive',
    Transparent: 'transparent'
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
    VersionName: 'version-name',
    SessionModes: 'session-modes',
    GettextDomain: 'gettext-domain'
};

/**
 * @enum {string}
 */
export const Module = {
    TweakOverviewHideDash: 'tweaks/overview/hideDash',
    TweakOverviewHideSearch: 'tweaks/overview/hideSearch',
    TweakOverviewClickActions: 'tweaks/overview/clickActions',
    TweakPopupsPreventFocus: 'tweaks/popups/preventFocus',
    TweakPopupsRemoveDelay: 'tweaks/popups/removeDelay',
    TweakInputSourcePrimaryForPasswords: 'tweaks/inputSource/primaryForPasswords',
    TweakInputSourceUpperCaseLabels: 'tweaks/inputSource/upperCaseLabels',
    TweakMenusClickToOpen: 'tweaks/menus/clickToOpen',
    TweakNotificationsSystemBypassDnd: 'tweaks/notifications/systemBypassDnd',
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
