import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

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

/**
 * @param {string} path
 * @returns {{[key: string]: *}}
 */
export const JSONConfig = path => {
    try {
        const configFile = Gio.File.new_for_path(path);
        const [success, contents] = configFile.load_contents(null);
        return success && contents ? JSON.parse(new TextDecoder().decode(contents)) : {};
    } catch (e) {
        console.error(e);
    }
    return {};
};
