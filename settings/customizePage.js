const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var CustomizePage = GObject.registerClass(
    class CustomizePage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: 'Customize',
                name: 'CustomizePage',
                icon: 'applications-utilities-symbolic',
                settings: settings
            });

            this._populateOptions();
        }

        _populateOptions() {

            const taskbarOptions = this._addTaskbarOptions();
            const appButtonOptions = this._addAppButtonOptions();

            this.addGroup('Indicators');
            this.addGroup('Notification Badges');
            this.addGroup('Tooltips');

            // handle settings changes in order to hide some options

            if (!this._settings.get_boolean('taskbar-enabled')) {
                taskbarOptions.hide();
                appButtonOptions.hide();
            }

            this._settings.connect('changed::taskbar-enabled', () => {
                if (!this._settings.get_boolean('taskbar-enabled')) {
                    taskbarOptions.hide();
                    appButtonOptions.hide();
                    return;
                }
                taskbarOptions.show();
                appButtonOptions.show();
            });
        }

        _addTaskbarOptions() {

            const positionOptions = [
                { label: 'Left', value: 'left' },
                { label: 'Center', value: 'center' },
                { label: 'Right', value: 'right' }
            ];

            return this.addGroup('Taskbar', [
                this.createPicklist(
                    'Position', 'taskbar-position',
                    positionOptions
                ),
                this.createSpinButton(
                    'Position Offset', 'taskbar-position-offset',
                    { min: 0, max: 15 }
                )
            ]);
        }

        _addAppButtonOptions() {
        
            return this.addGroup('App Buttons'/*, [
                this.createSlider(
                    'Icon Size', '',
                    { min: 16, max: 64, marks: [16, 24, 32, 48, 64] }
                )
            ]*/);
        }

    }
);