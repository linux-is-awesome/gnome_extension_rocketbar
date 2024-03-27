/**
 * @enum {string} Standard GObject and Shell events to handle
 */
export const Event = {
    Visible: 'notify::visible',
    Hover: 'notify::hover',
    FocusIn: 'key-focus-in',
    FocusOut: 'key-focus-out',
    Destroy: 'destroy',
    Position: 'notify::position',
    Mapped: 'notify::mapped',
    DragBegin: 'drag-begin',
    DragEnd: 'drag-end',
    ButtonPress: 'button-press-event',
    ButtonRelease: 'button-release-event',
    KeyPress: 'key-press-event',
    Touch: 'touch-event',
    Leave: 'leave-event',
    FontName: 'notify::font-name',
    IconTheme: 'notify::gtk-icon-theme',
    Scroll: 'scroll-event',
    Clicked: 'clicked',
    Pressed: 'notify::pressed',
    Checked: 'notify::checked',
    Captured: 'captured_event',
    StartupComplete: 'startup-complete',
    AppStateChanged: 'app-state-changed',
    SwitchWorkspace: 'switch-workspace',
    InstalledAppsChanged: 'installed-changed',
    FavoritesChanged: 'changed',
    OverviewShowing: 'showing',
    OverviewHiding: 'hiding',
    ScaleFactor: 'notify::scale-factor',
    Repaint: 'repaint',
    OpenStateChanged: 'open-state-changed',
    ValueChanged: 'notify::value',
    FocusWindow: 'notify::focus-window',
    WindowDemandsAttention: 'window-demands-attention',
    WindowAdded: 'window_added',
    WindowRemoved: 'window_removed',
    Minimize: 'minimize',
    Unminimize: 'unminimize',
    MenuClosed: 'menu-closed',
    MoveX: 'notify::x',
    MoveY: 'notify::y',
    AdjustmentChanged: 'changed',
    MonitorsChanged: 'monitors-changed'
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
