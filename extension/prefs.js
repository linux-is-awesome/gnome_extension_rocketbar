/**
 * @typedef {import('gi://Adw').PreferencesWindow} Adw.PreferencesWindow
 * @typedef {import('resource:///org/gnome/shell/dbusServices/extensions/extensionPrefsDialog.js').ExtensionPrefsDialog} ExtensionPrefsDialog
 * @typedef {Adw.PreferencesWindow & ExtensionPrefsDialog} PreferencesWindow
 */

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { Event } from './shared/core/enums.js';
import Context from './preferences/core/context.js';

export default class extends ExtensionPreferences {

    /**
     * @override
     * @param {PreferencesWindow} window
     */
    fillPreferencesWindow(window) {
        const runtime = new Context(this, window);
        window.connect(Event.CloseRequest, () => runtime.destroy());
    }

}
