/**
 * @enum {string} Standard GObject, Shell and GTK events to handle
 */
export const Event = {
    AppStateChanged: 'app-state-changed',
    ButtonPress: 'button-press-event',
    ButtonRelease: 'button-release-event',
    Captured: 'captured_event',
    Changed: 'changed',
    Checked: 'notify::checked',
    Clicked: 'clicked',
    Closed: 'closed',
    CloseRequest: 'close-request',
    Destroy: 'destroy',
    DragBegin: 'drag-begin',
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
    Repaint: 'repaint',
    ScaleFactor: 'notify::scale-factor',
    Scroll: 'scroll-event',
    SearchActive: 'notify::search-active',
    SourcesChanged: 'sources-changed',
    StartupComplete: 'startup-complete',
    SwitchWorkspace: 'switch-workspace',
    Touch: 'touch-event',
    Unminimize: 'unminimize',
    Updated: 'updated',
    ValueChanged: 'notify::value',
    VisibleChanged: 'notify::visible',
    WindowAdded: 'window_added',
    WindowDemandsAttention: 'window-demands-attention',
    WindowMapped: 'map',
    WindowRemoved: 'window_removed'
};

/**
 * @enum {string} Standard GObject properties
 */
export const Property = {
    Visible: 'visible'
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
 * @enum {string} Shell session modes
 */
export const SessionMode = {
    Desktop: 'user',
    Locksreen: 'unlock-dialog'
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
export const MetadataField = {
    Name: 'name',
    Url: 'url',
    SettingsSchema: 'settings-schema',
    VersionName: 'version-name'
};
