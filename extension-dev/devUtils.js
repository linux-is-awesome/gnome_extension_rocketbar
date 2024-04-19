import GLib from 'gi://GLib';

/**
 * @param {string} path
 * @returns {string?}
 */
export const RuntimeLocation = path => {
    if (!path) return null;
    const [success, output] = GLib.spawn_command_line_sync(`ls ${path}`);
    if (!success || !output) return null;
    const runtimeId = new TextDecoder().decode(output)?.trim() ?? null;
    if (!runtimeId) return null;
    return `/${runtimeId}`;
};
