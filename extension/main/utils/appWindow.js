import Meta from 'gi://Meta';

/**
 * @param {Meta.Window|Meta.WindowActor} source
 * @returns {Meta.Window?}
 */
export const AppWindow = source => {
    const window = source instanceof Meta.WindowActor ? source.get_meta_window() :
                   source instanceof Meta.Window ? source : null;
    if (!window) return null;
    const type = window.get_window_type();
    return type === Meta.WindowType.NORMAL ||
           type === Meta.WindowType.DIALOG ||
           type === Meta.WindowType.MODAL_DIALOG ? window : null;
};
