/* exported Event, Type */

/**
 * @enum {string} Standard GObject events to handle
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
    Touch: 'touch-event',
    FontName: 'notify::gtk-font-name',
    FocusWindow: 'notify::focus-window',
    Scroll: 'scroll-event',
    Clicked: 'clicked',
    Captured: 'captured_event'
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
