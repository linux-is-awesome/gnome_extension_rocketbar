const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

const _ = imports.misc.extensionUtils.gettext;

var BehaviorPage = GObject.registerClass(
    class Rocketbar__BehaviorPage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: _('Behavior'),
                name: 'BehaviorPage',
                icon: 'applications-engineering-symbolic',
                settings: settings
            });

            this._populateOptions();
        }

        _populateOptions() {

            // Taskbar
            this._addTaskbarOptions();

            // Notification Service
            this.addGroup(_('Notification Service'), [
                this.createSwitch(_('Enable Unity Launcher API support'), 'notification-service-enable-unity-dbus',
                                  _('Use Unity Launcher API DBus interface to count notifications for apps')),
                this.createSwitch(_('Count Window Demands Attention notifications for apps'), 'notification-service-count-attention-sources')
            ]);

            // Panel
            this._addPanelOptions();

            // Sound Volume Control
            this._addSoundControlOptions();

            // Activities
            this._addActivitiesOptions();

            // Overview
            this.addGroup(_('Overview'), [
                this.createSwitch(_('Enable empty space clicks in Overview'), 'overview-enable-empty-space-clicks',
                                  _('Left button click to close the Overview, Right button click to show the App Grid'))
            ]);

            // Hot Corner
            this.addGroup(_('Hot Corner'), [
                this.createSwitch(_('Enable Fullscreen Hot Corner'), 'hotcorner-enable-in-fullscreen')
            ]);

            // Lock Screen
            this.addGroup(_('Lock Screen'), [
                this.createSwitch(_('Force primary input source on Lock Screen'), 'lockscreen-primary-input',
                                  _('Experimental feature'))
            ]);

            // Switcher Popups
            this._addSwitcherPopupOptions();
        }

        _addTaskbarOptions() {

            const activateBehaviorOptions = [
                { label: _('New window'), value: 'new_window' },
                { label: _('Move windows'), value: 'move_windows' }, 
            ];

            this.addVisibilityControl([this.addGroup(_('Taskbar'), [
                this.createSwitch(_('Enable Drag and Drop'), 'appbutton-enable-drag-and-drop',
                                  _('Reorder apps in the taskbar using Drag and Drop')),
                this.createSwitch(_('Enable Minimize action'), 'appbutton-enable-minimize-action',
                                  _('Allow to minimize single app windows by clicking apps in the taskbar')),
                this.createSwitch(_('Require click to open context menus'), 'appbutton-menu-require-click'),
                ...this.addVisibilityControl([
                    this.createSwitch(_('Middle click to toggle app sound mute'), 'appbutton-middle-button-sound-mute',
                                      _('By default Middle click is used to open new app windows and to close the first app window when Ctrl is pressed')),
                    this.createSwitch(_('Scroll to change app sound volume'), 'appbutton-scroll-change-sound-volume')
                ], { 'appbutton-enable-sound-control': value => value }),
                ...this.addVisibilityControl(
                    [this.createSwitch(_('Scroll to cycle app windows'), 'appbutton-enable-scroll')], {
                    'appbutton-enable-sound-control': null,
                    'appbutton-scroll-change-sound-volume': value => (
                        this._settings.get_boolean('appbutton-enable-sound-control') ?
                        !value : true
                    )
                }),
                ...this.addVisibilityControl([this.createPicklist(
                    _('Running apps activation behavior'), 'appbutton-running-app-activate-behavior',
                    activateBehaviorOptions,
                    _('Controls the behavior when an app is running but has no windows on the active workspace, supports isolated workspaces only, ' +
                    'can be configured separately for each app via an app menu')
                )], { 'taskbar-isolate-workspaces': value => value })
            ])], { 'taskbar-enabled': value => value });
        }

        _addPanelOptions() {

            const scrollActionOptions = [
                { label: _('None'), value: 'none' },
                { label: _('Change Sound Volume'), value: 'change_sound_volume' },
                { label: _('Switch Workspace'), value: 'switch_workspace' }
            ];

            this.addGroup(_('Panel'), [
                this.createSwitch(_('Require click to activate menu buttons'), 'panel-menu-require-click'),
                this.createSwitch(_('Middle click to toggle sound mute'), 'panel-enable-middle-button',
                                  _('Press middle button on an empty space of the panel')),
                this.createPicklist(_('Scroll action'), 'panel-scroll-action', scrollActionOptions)
            ]);
        }

        _addSoundControlOptions() {

            const volumeChangeSpeedOptions = [
                { label: _('Slowest'), value: 1 },
                { label: _('Slow'), value: 2 },
                { label: _('Normal'), value: 4 },
                { label: _('Fast'), value: 6 },
                { label: _('Faster'), value: 8 },
                { label: _('Turbo'), value: 10 }
            ];

            this.addVisibilityControl([this.addGroup(_('Sound Volume Control'), [
                this.createPicklist(
                    _('Volume change speed'), 'sound-volume-control-change-speed',
                    volumeChangeSpeedOptions
                ),
                this.createPicklist(
                    _('Volume change speed when Ctrl pressed'), 'sound-volume-control-change-speed-ctrl',
                    volumeChangeSpeedOptions
                )
            ])], {
                'taskbar-enabled': null,
                'appbutton-enable-sound-control': null,
                'appbutton-scroll-change-sound-volume': value => (
                    this._settings.get_boolean('taskbar-enabled') &&
                        this._settings.get_boolean('appbutton-enable-sound-control') ?
                    value : false
                ),
                'panel-scroll-action': value => value === 'change_sound_volume'
            });
        }

        _addActivitiesOptions() {

            const clickOptions = [
                { label: _('None'), value: 'none' },
                { label: _('Left Button'), value: 'left_button' },
                { label: _('Right Button'), value: 'right_button' },
                { label: _('Middle Button'), value: 'middle_button' }
            ];

            this.addGroup(_('Activities'), [
                this.createPicklist(
                    _('Click Activities to show the App Grid'), 'activities-show-apps-button',
                    clickOptions
                )
            ]);
        }

        _addSwitcherPopupOptions() {
            this.addGroup(_('Switcher Popups'), [
                this.createSwitch(_('Override show delay'), 'switcherpopup-enable-show-delay'),
                ...this.addVisibilityControl([
                    this.createSpinButton(
                        _('Show Delay'), 'switcherpopup-show-delay',
                        { min: 0, max: 500, step: 50 }
                    )
                ], { 'switcherpopup-enable-show-delay': value => value }),
                this.createSwitch(_('Do not grab focus'), 'switcherpopup-enable-handler'),
            ]);
        }

    }
);
