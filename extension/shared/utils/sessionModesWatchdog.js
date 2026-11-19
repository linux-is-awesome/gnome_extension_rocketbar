import Gio from 'gi://Gio';
import Context from '../core/context.js';
import { MetadataField, SessionMode } from '../enums/general.js';
import { SettingsKey } from '../enums/settings.js';

const METADATA_FILE_NAME = 'metadata.json';

/**
 * @param {Gio.File} file
 * @returns {Promise<string>}
 */
const FileContentInput = file => new Promise((resolve, reject) => {
    file.load_contents_async(null, (_, result) => {
        try {
            const [success, contents] = file.load_contents_finish(result);
            if (!success) throw new Error(`${FileContentInput.name} failed to load ${file.get_basename()}.`);
            resolve(new TextDecoder().decode(contents));
        } catch (e) {
            reject(e);
        }
    });
});

/**
 * @param {Gio.File} file
 * @param {string} contents
 * @returns {Promise<void>}
 */
const FileContentOutput = (file, contents) => new Promise((resolve, reject) => {
    file.replace_contents_async(
        new TextEncoder().encode(contents),
        null, false, Gio.FileCreateFlags.NONE, null, (_, result) => {
            try {
                file.replace_contents_finish(result);
                resolve();
            } catch (e) {
                reject(e);
            }
        }
    );
});

/**
 * @returns {Gio.File?}
 */
export const MetadataFile = () => {
    const path = Context.path;
    if (!path) return null;
    return Gio.File.new_for_path(`${path}/${METADATA_FILE_NAME}`);
};

export const SessionModesWatchdog = async () => {
    try {
        const settings = Context.getSettings();
        const file = MetadataFile();
        if (!file || !settings) return;
        const metadata = JSON.parse(await FileContentInput(file));
        const sessionModesValue = metadata[MetadataField.SessionModes];
        const sessionModes = new Set(Array.isArray(sessionModesValue) ? sessionModesValue : []);
        const isLockscreenEnabled = !!settings.get(SettingsKey.SessionModeLockscreen);
        const hasLockscreenSessionMode = sessionModes.has(SessionMode.Locksreen);
        if (isLockscreenEnabled && !hasLockscreenSessionMode) sessionModes.add(SessionMode.Locksreen);
        else if (!isLockscreenEnabled && hasLockscreenSessionMode) sessionModes.delete(SessionMode.Locksreen);
        else return;
        sessionModes.add(SessionMode.Desktop);
        metadata[MetadataField.SessionModes] = [...sessionModes];
        await FileContentOutput(file, JSON.stringify(metadata, null, 4));
    } catch (e) {
        Context.logError(`${SessionModesWatchdog.name} failed to update session modes.`, e);
    }
};
