import GLib from 'gi://GLib';

const RUNTIME_SEARCH_PATH = '.runtime';

/**
 * @param {string} path
 * @returns {string|null}
 */
export const RuntimeLocation = (path) => {
    if (!path) return null;
    const [result, output] = GLib.spawn_command_line_sync(`ls ${path}/${RUNTIME_SEARCH_PATH}`);
    if (!result || !output) return null;
    const runtimeId = new TextDecoder().decode(output)?.trim() ?? null;
    if (!runtimeId) return null;
    return `/${RUNTIME_SEARCH_PATH}/${runtimeId}`;
};
