const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var BehaviorPage = GObject.registerClass(
    class BehaviorPage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: 'Behavior',
                name: 'BehaviorPage',
                icon: 'applications-engineering-symbolic',
                settings: settings
            });

            this._populateOptions();
        }

        _populateOptions() {

            // Taskbar
            this.addGroup('Taskbar', [
                this.createSwitch('Allow Drag and Drop', 'appbutton-enable-drag-and-drop'),
                this.createSwitch('Scroll to cycle app windows', 'appbutton-enable-scroll')
            ]);
        }

    }
);