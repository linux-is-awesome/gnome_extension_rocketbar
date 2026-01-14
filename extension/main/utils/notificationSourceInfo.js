/**
 * @typedef {import('../core/shell.js').MessageTray.Source} MessageTraySource
 * @typedef {{app: Shell.App?, window: Meta.Window?, isAttentionSource: boolean}} NotificationSourceInfo
 */

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

const WINDOW_ATTENTION_SOURCE_CLASS = 'WindowAttentionSource';

/**
 * @param {MessageTraySource} source
 * @param {Shell.WindowTracker?} [windowTracker]
 * @returns {NotificationSourceInfo}
 */
export const NotificationSourceInfo = (source, windowTracker) => {
    const isAttentionSource = source?.constructor.name === WINDOW_ATTENTION_SOURCE_CLASS;
    const sourceApp = source.app ?? source._app;
    const sourceWindow = source?._window;
    const window = sourceWindow instanceof Meta.Window ? sourceWindow : null;
    const app = sourceApp instanceof Shell.App ? sourceApp :
                window && windowTracker ? windowTracker.get_window_app(window) : null;
    return { app, window, isAttentionSource };
};
