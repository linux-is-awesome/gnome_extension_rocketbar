const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var GeneralPage = GObject.registerClass(
    class Rocketbar__GeneralPage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: 'General',
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

            const taskbarEnabledSwitch = this.createSwitch('Enabled', 'taskbar-enabled');

            const taskbarGroup = [
                taskbarEnabledSwitch,
                this.createSwitch('Show Favorites', 'taskbar-show-favorites'),
                this.createSwitch('Isolate Workspaces', 'taskbar-isolate-workspaces'),
                this.createSwitch('Enable Tooltips', 'appbutton-enable-tooltips'),
                this.createSwitch('Enable Indicators', 'appbutton-enable-indicators'),
                this.createSwitch('Enable Notification Badges', 'appbutton-enable-notification-badges')
            ];

            const updateTaskbarGroup = () => {
                taskbarGroup.forEach(control => {

                    if (control === taskbarEnabledSwitch) {
                        return;
                    }

                    if (taskbarEnabledSwitch.activatable_widget.get_active()) {
                        control.show();
                    } else {
                        control.hide();
                    }

                });
            };

            taskbarEnabledSwitch.activatable_widget.connect('notify::active', updateTaskbarGroup);

            updateTaskbarGroup();

            this.addGroup('Taskbar', taskbarGroup);
        }

        _addOverviewOptions() {
            this.addGroup('Overview', [
                this.createSwitch('Kill the Dash', 'overview-kill-dash',
                                  'Hide the Dash in Overview and prevent it from rerendering behind the scene')
            ]);
        }

    }
);