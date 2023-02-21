/* exported Event, Type, Property, Delay */

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
    Touch: 'touch-event',
    Leave: 'leave-event',
    FontName: 'notify::font-name',
    IconTheme: 'notify::gtk-icon-theme',
    FocusWindow: 'notify::focus-window',
    Scroll: 'scroll-event',
    Clicked: 'clicked',
    LongPress: 'long-press',
    Pressed: 'notify::pressed',
    Captured: 'captured_event',
    StartupComplete: 'startup-complete',
    AppStateChanged: 'app-state-changed',
    SwitchWorkspace: 'switch-workspace',
    WindowAdded: 'window_added',
    WindowRemoved: 'window_removed',
    Minimize: 'minimize',
    Unminimize: 'unminimize',
    InstalledAppsChanged: 'installed-changed',
    FavoritesChanged: 'changed',
    OverviewShowing: 'showing',
    OverviewHiding: 'hiding',
    ScaleFactor: 'notify::scale-factor'
};

/**
 * @enum {string} Standard GObject properties
 */
export const Property = {
    Visible: 'visible',
    Hover: 'hover'
};

/**
 * @enum {string} Standard javascript types
 */
export const Type = {
    Function: 'function',
    String: 'string',
    Number: 'number',
    Boolean: 'boolean'
};

/**
 * @enum {number}
 */
export const Delay = {
    Redraw: -1,
    Idle: 0,
    Queue: 100,
    Sleep: 300,
    Background: 500
};
