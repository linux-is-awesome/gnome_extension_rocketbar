const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

const _ = imports.misc.extensionUtils.gettext;

var GeneralPage = GObject.registerClass(
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

            // Overview
            this._addOverviewOptions();

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

        _addOverviewOptions() {
            this.addGroup(_('Overview'), [
                this.createSwitch(_('Kill the Dash'), 'overview-kill-dash',
                                  _('Hide the Dash from Overview and prevent it from rerendering behind the scene'))
            ]);
        }

    }
);
