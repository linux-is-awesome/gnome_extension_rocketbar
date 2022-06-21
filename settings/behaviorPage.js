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

            // Panel
            this.addGroup('Panel', [
                this.createSwitch('Middle click on empty space to mute/unmute sound volume', 'panel-enable-middle-button'),
                this.createSwitch('Scroll to change sound volume', 'panel-enable-scroll')
            ]);

            // Activities
            this.addGroup('Activities', [
                this.createSwitch('Right click to open Apps', 'activities-enable-click-override')
            ]);

            // Overview
            this.addGroup('Overview', [
                this.createSwitch('Click Overview empty space to close it or open Apps', 'overview-enable-empty-space-clicks')
            ]);

            // Hot Corner
            this.addGroup('Hot Corner', [
                this.createSwitch('Enable Fullscreen Hot Corner', 'hotcorner-enable-in-fullscreen')
            ]);
        }

    }
);