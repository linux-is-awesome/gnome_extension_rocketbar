const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var BehaviorPage = GObject.registerClass(
    class Rocketbar__BehaviorPage extends SettingsPageTemplate {

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
            this._addTaskbarOptions();

            // Panel
            this._addPanelOptions();

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

        _addTaskbarOptions() {

            const activateBehaviorOptions = [
                { label: 'New window', value: 'new_window' },
                { label: 'Move windows', value: 'move_windows' }, 
            ];

            const activateBehaviorPicklist = this.createPicklist(
                'Running apps activation behavior', 'appbutton-running-app-activate-behavior',
                activateBehaviorOptions,
                'Controls the behavior when an app is running but has not windows on the active workspace, applicable for isolated workspaces only'
            );

            const taskbarGroup = this.addGroup('Taskbar', [
                this.createSwitch('Allow Drag and Drop', 'appbutton-enable-drag-and-drop',
                                  'Reorder apps in the taskbar using Drag and Drop'),
                this.createSwitch('Scroll to cycle app windows', 'appbutton-enable-scroll'),
                activateBehaviorPicklist
            ]);

            if (!this._settings.get_boolean('taskbar-enabled')) {
                taskbarGroup.hide();
            }

            if (!this._settings.get_boolean('taskbar-isolate-workspaces')) {
                activateBehaviorPicklist.hide();
            }

            this._settings.connect('changed::taskbar-enabled', () => {
                if (!this._settings.get_boolean('taskbar-enabled')) {
                    taskbarGroup.hide();
                    return;
                }
                taskbarGroup.show();
            });

            this._settings.connect('changed::taskbar-isolate-workspaces', () => {
                if (!this._settings.get_boolean('taskbar-isolate-workspaces')) {
                    activateBehaviorPicklist.hide();
                    return;
                }
                activateBehaviorPicklist.show();
            });
        }

        _addPanelOptions() {

            const volumeChangeSpeedOptions = [
                { label: 'Slowest', value: 1 },
                { label: 'Slow', value: 2 }, 
                { label: 'Normal', value: 4 },
                { label: 'Fast', value: 6 },
                { label: 'Faster', value: 8 },
                { label: 'Turbo', value: 10 }
            ];

            const volumeSpeedPicklist = this.createPicklist(
                'Volume change speed', 'panel-scroll-volume-change-speed',
                volumeChangeSpeedOptions
            );

            const volumeSpeedCtrlPicklist = this.createPicklist(
                'Volume change speed when Ctrl pressed', 'panel-scroll-volume-change-speed-ctrl',
                volumeChangeSpeedOptions
            );

            const scrollSwitch = this.createSwitch('Scroll to change sound volume', 'panel-enable-scroll');

            scrollSwitch.activatable_widget.connect('notify::active', (widget) => {

                if (widget.get_active()) {
                    volumeSpeedPicklist.show();
                    volumeSpeedCtrlPicklist.show();
                    return;
                }

                volumeSpeedPicklist.hide();
                volumeSpeedCtrlPicklist.hide();
            });

            if (!scrollSwitch.activatable_widget.get_active()) {
                volumeSpeedPicklist.hide();
                volumeSpeedCtrlPicklist.hide();
            }
    
            this.addGroup('Panel', [
                this.createSwitch('Middle click to mute/unmute sound', 'panel-enable-middle-button',
                    'Press middle button on empty space of the panel to mute or unmute sound'),
                scrollSwitch,
                volumeSpeedPicklist,
                volumeSpeedCtrlPicklist
            ]);
        }

    }
);