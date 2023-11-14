//#region imports

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Connections } from './utils/connections.js';
import { ShellTweaks } from './shell/tweaks.js';
import { Taskbar } from './ui/taskbar.js';
import { NotificationCounter } from './ui/notificationCounter.js';
import { IconProvider } from './utils/iconProvider.js';
import { LauncherAPI } from './utils/launcherAPI.js';

//#endregion imports

//#region main

export default class RocketBarExtension extends Extension {
    enable() {
        // call instance() to initialize dbus interface
        // this should be done as soon as possible
        // to make apps use the interface correctly
        LauncherAPI.instance();

        this._settings = this.getSettings();

        this._iconProvider = new IconProvider(this.path);
        this._shellTweaks = new ShellTweaks(this._settings);

        this._handleSettings();

        this._connections = new Connections();
        this._connections.addScope(this._settings, [
            'changed::taskbar-enabled',
            'changed::notification-counter-enabled'
        ], () => this._handleSettings());    
    }

    disable() {
        // destroy all
        this._connections.destroy();
        this._taskbar?.destroy();
        this._notificationCounter?.destroy();
        this._shellTweaks?.destroy();
        LauncherAPI.destroy();
    
        // and nullify all
        this._taskbar = null;
        this._notificationCounter = null;
        this._shellTweaks = null;
        this._settings = null;
        this._connections = null;
        this._iconProvider = null;
    }

    _handleSettings() {

        const taskbarEnabled = this._settings.get_boolean('taskbar-enabled');
        const notificationCounterEnabled = this._settings.get_boolean('notification-counter-enabled');
    
        if (taskbarEnabled && !this._taskbar) {
            this._taskbar = new Taskbar(this._settings, this._iconProvider);
        } else if (!taskbarEnabled && this._taskbar) {
            this._taskbar.destroy();
            this._taskbar = null;
        }
    
        if (notificationCounterEnabled && !this._notificationCounter) {
            this._notificationCounter = new NotificationCounter(this._settings);
        } else if (!notificationCounterEnabled && this._notificationCounter) {
            this._notificationCounter.destroy();
            this._notificationCounter = null;
        }
    
    }
}


//#endregion main