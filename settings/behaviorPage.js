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
                this.createSwitch('Allow Drag and Drop', 'appbutton-enable-drag-and-drop',
                                  'Reorder apps in the taskbar using Drag and Drop'),
                this.createSwitch('Scroll to cycle app windows', 'appbutton-enable-scroll')
            ]);

            // Panel

            const volumeChangeSpeedOptions = [
                { label: 'Slowest', value: 1 },
                { label: 'Slow', value: 2 }, 
                { label: 'Normal', value: 4 },
                { label: 'Fast', value: 6 },
                { label: 'Faster', value: 8 },
                { label: 'Turbo', value: 10 }
            ];

            this.addGroup('Panel', [
                this.createSwitch('Middle click to mute/unmute sound', 'panel-enable-middle-button',
                                  'Press middle button on empty space of the panel to mute or unmute sound'),
                this.createSwitch('Scroll to change sound volume', 'panel-enable-scroll'),
                this.createPicklist('Volume change speed', 'panel-scroll-volume-change-speed', volumeChangeSpeedOptions),
                this.createPicklist('Volume change speed when Ctrl pressed', 'panel-scroll-volume-change-speed-ctrl', volumeChangeSpeedOptions)
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