import Gio from 'gi://Gio';
import Context from '../core/context.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

const ZENITY = 'zenity';

/** @enum {string} */
const ZenityMode = {
    FileSelection: '--file-selection'
};

/** @enum {string} */
const ZenityParam = {
    Modal: '--modal',
    Title: '--title'
};

/** @enum {string} */
const FileSelectorParam = {
    FileTypes: '--file-filter',
    FilePath: '--filename'
};

/**
 * @param {ZenityMode} mode
 * @param {string[]} params
 * @returns {Promise<string?>}
 */
const Zenity = async (mode, params) => {
    if (!mode) return null;
    try {
        params = [ZENITY, mode, ...params ?? []];
        const proc = Gio.Subprocess.new(params, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        const [result, error] = await proc.communicate_utf8_async(null, null);
        if (error) throw Error(error);
        return result;
    } catch (e) {
        Context.logError(`${Zenity.name} failed.`, e);
    }
    return null;
};

/**
 * @param {string} [title]
 * @param {string} [fileTypes] Name | *.type1 *.type2 ...
 * @param {string} [filePath]
 * @returns {Promise<string?>}
 */
export const FileSelector = async (title, fileTypes, filePath) => {
    const params = [];
    if (typeof title === 'string') params.push(`${ZenityParam.Title}=${title}`);
    if (typeof fileTypes === 'string') params.push(`${FileSelectorParam.FileTypes}=${fileTypes}`);
    if (typeof filePath === 'string') params.push(`${FileSelectorParam.FilePath}=${filePath}`);
    const result = await Zenity(ZenityMode.FileSelection, params);
    return result?.replaceAll('\n', '') ?? null;
};
