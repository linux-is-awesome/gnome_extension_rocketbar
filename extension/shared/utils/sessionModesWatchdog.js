import Gio from 'gi://Gio';
import Context from '../core/context.js';
import { MetadataField, SessionMode } from '../enums/general.js';
import { SettingsKey } from '../enums/settings.js';

const METADATA_FILE_NAME = 'metadata.json';

export const SessionModesWatchdog = () => {
    try {
        const metadataFile = Gio.file_new_for_path(`${Context.path}/${METADATA_FILE_NAME}`);
        const [success, contents] = metadataFile.load_contents(null);
        if (!success) throw new Error(`Failed to load ${METADATA_FILE_NAME}.`);
        const settings = Context.getSettings();
        if (!settings) return;
        const metadata = JSON.parse(new TextDecoder().decode(contents));
        const sessionModesValue = metadata[MetadataField.SessionModes];
        const sessionModes = new Set(Array.isArray(sessionModesValue) ? sessionModesValue : []);
        const isLockscreenEnabled = !!settings.get(SettingsKey.SessionModeLockscreen);
        const hasLockscreenSessionMode = sessionModes.has(SessionMode.Locksreen);
        if (isLockscreenEnabled && !hasLockscreenSessionMode) sessionModes.add(SessionMode.Locksreen);
        else if (!isLockscreenEnabled && hasLockscreenSessionMode) sessionModes.delete(SessionMode.Locksreen);
        else return;
        sessionModes.add(SessionMode.Desktop);
        metadata[MetadataField.SessionModes] = [...sessionModes];
        const resultMetadata = new TextEncoder().encode(JSON.stringify(metadata, null, 4));
        metadataFile.replace_contents(resultMetadata, null, false, Gio.FileCreateFlags.NONE, null);
    } catch (e) {
        Context.logError('failed to watch session modes.', e);
    }
};
