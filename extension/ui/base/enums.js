/**
 * @enum {string} Standard GObject events to handle
 */
var Event = {
    Hover: 'notify::hover',
    FocusIn: 'key-focus-in',
    FocusOut: 'key-focus-out',
    Destroy: 'destroy',
    Position: 'notify::position',
    Mapped: 'notify::mapped',
    DragBegin: 'drag-begin',
    DragEnd: 'drag-end',
    ButtonPress: 'button-press-event',
    Touch: 'touch-event'
}

/**
 * @enum {string} Standard javascript types
 */
var Type = {
    Function: 'function',
    String: 'string',
    Number: 'number'
}
