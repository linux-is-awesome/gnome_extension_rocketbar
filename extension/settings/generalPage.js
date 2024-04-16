import GObject from 'gi://GObject';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { SettingsPageTemplate } from './pageTemplate.js';

export const GeneralPage = GObject.registerClass(
    class Rocketbar__GeneralPage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: _('General'),
                name: 'GeneralPage',
                icon: 'preferences-system-symbolic',
                settings: settings
            });

            this._populateOptions();
        }

        _populateOptions() {

            // Taskbar
            this._addTaskbarOptions();

            // Notification Counter
            this.addGroup(_('Notification Counter'), [
                this.createSwitch(_('Enabled'), 'notification-counter-enabled')
            ]);

        }

        _addTaskbarOptions() {
            this.addGroup(_('Taskbar'), [
                this.createSwitch(_('Enabled'), 'taskbar-enabled'),
                ...this.addVisibilityControl([
                    this.createSwitch(_('Show Favorites'), 'taskbar-show-favorites'),
                    this.createSwitch(_('Isolate Workspaces'), 'taskbar-isolate-workspaces'),
                    this.createSwitch(_('Enable Indicators'), 'appbutton-enable-indicators'),
                    this.createSwitch(_('Enable Notification Badges'), 'appbutton-enable-notification-badges'),
                    this.createSwitch(_('Enable Tooltips'), 'appbutton-enable-tooltips'),
                    this.createSwitch(_('Enable Sound Volume Control'), 'appbutton-enable-sound-control',
                                      _('Experimental feature'))
                ], { 'taskbar-enabled': value => value })
            ]);
        }

    }
);
