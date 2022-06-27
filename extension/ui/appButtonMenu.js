const { Clutter, St, GLib } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const { PopupSeparatorMenuItem, PopupSubMenuMenuItem, PopupBaseMenuItem, Ornament } = imports.ui.popupMenu;
const { Slider } = imports.ui.slider;
const Main = imports.ui.main;

var AppButtonMenu = class AppButtonMenu extends AppMenu {

    //#region public methods

    constructor(appButton, settings) {

        super(appButton, St.Side.TOP, {
            favoritesSection: true,
            showSingleWindows: true,
        });

        this.actor.remove_style_class_name('app-menu');
        this.actor.add_style_class_name('panel-menu aggregate-menu');

        this._fixMenuSeparatorFontSize(this._openWindowsHeader);

        this._appButton = appButton;
        this._settings = settings;

        this.blockSourceEvents = true;

        this._setConfig();

        this.setApp(appButton.app);

        this._addCustomizeSection();

        Main.uiGroup.add_actor(this.actor);       
    }

    updateConfig() {
        const oldConfig = this._config || {};

        this._setConfig();

        if (oldConfig.isolateWorkspaces !== this._config.isolateWorkspaces) {
            this._updateWindowsSection();
        }

        if (oldConfig.showFavorites !== this._config.showFavorites) {
            this._updateFavoriteItem();
        }

        this._updateCustomizeSection();
    }

    //#endregion public methods

    //#region private methods

    _setConfig() {
        this._config = {
            showFavorites: this._settings.get_boolean('taskbar-show-favorites'),
            isolateWorkspaces: this._settings.get_boolean('taskbar-isolate-workspaces'),
            configOverride: this._appButton.getConfigOverride()
        };
    }

    _updateFavoriteItem() {
        super._updateFavoriteItem();

        if (!this._toggleFavoriteItem.visible) {
            return;
        }

        const isFavorite = this._appFavorites.isFavorite(this._app.id);

        if (this._config.showFavorites && !isFavorite) {
            this._toggleFavoriteItem.label.text = _('Pin');
        }

        if (!this._config.showFavorites && isFavorite) {
            this._toggleFavoriteItem.label.text = _('Unpin from Dash');
        }
    }

    _updateWindowsSection() {
        
        if (!this._config.isolateWorkspaces) {
            super._updateWindowsSection();
            return;
        }

        // show windows from the current workspace only
        // using a trick to avoid complete overriding of the method

        const originalApp = this._app;

        const workspaceIndex = global.workspace_manager.get_active_workspace_index();

        this._app = {
            get_windows: () => originalApp.get_windows().filter(window => window.get_workspace().index() === workspaceIndex),
            get_name: () => originalApp.get_name()
        };

        super._updateWindowsSection();

        this._app = originalApp;
    }

    _addCustomizeSection() {

        const customizeSubMenu = new PopupSubMenuMenuItem(_('Customize'));

        const separatorStyle = 'margin-top: 10px;';

        // Add Activate Running Behavior items
        
        const activateBehaviorTitle = new PopupSeparatorMenuItem(_('Activation Behavior'));
        this._fixMenuSeparatorFontSize(activateBehaviorTitle);
        activateBehaviorTitle.style += separatorStyle;

        customizeSubMenu.menu.addMenuItem(activateBehaviorTitle);

        this._activateBehaviorNewWindowItem = customizeSubMenu.menu.addAction(
            _('New window'),
            () => this._setActivationBehaviorValue('new_window')
        );
        this._activateBehaviorMoveWindowsItem = customizeSubMenu.menu.addAction(
            _('Move windows'),
            () => this._setActivationBehaviorValue('move_windows')
        );

        this._setActivationBehaviorValue();
        
        // add Icon Size customization item

        const iconSizeTitle = new PopupSeparatorMenuItem(_('Icon Size'));
        this._fixMenuSeparatorFontSize(iconSizeTitle);
        iconSizeTitle.style += separatorStyle;

        customizeSubMenu.menu.addMenuItem(iconSizeTitle);
        customizeSubMenu.menu.addMenuItem(this._createIconSizeSliderMenuItem());

        // add Reset item
        customizeSubMenu.menu.addMenuItem(new PopupSeparatorMenuItem());
        customizeSubMenu.menu.addAction(_('Reset to default'), () => this._appButton.resetConfigOverride());

        // add Customize sub menu to the app menu
        this.addMenuItem(customizeSubMenu);
        this.addMenuItem(new PopupSeparatorMenuItem());

        // move Quit item to the end of the app menu
        this.moveMenuItem(this._quitItem, this.numMenuItems);
    }

    _fixMenuSeparatorFontSize(separator) {
        separator.style = 'font-size: 0.8em;';
    }

    _updateCustomizeSection() {
        this._setIconSizeSliderValue();
        this._setActivationBehaviorValue();
    }

    _setActivationBehaviorValue(value) {

        if (value) {
            this._config.configOverride.activateRunningBehavior = value;
        }

        const menuItems = [
            this._activateBehaviorNewWindowItem,
            this._activateBehaviorMoveWindowsItem
        ];

        let selectedMenuItem = null;

        switch (this._config.configOverride.activateRunningBehavior) {
            case 'new_window':
                selectedMenuItem = this._activateBehaviorNewWindowItem;
                break;
            case 'move_windows':
                selectedMenuItem = this._activateBehaviorMoveWindowsItem;
                break
        }

        menuItems.forEach(item => {
            if (item === selectedMenuItem) {
                item.setOrnament(Ornament.DOT);
                return;
            }
            item.setOrnament(Ornament.NONE);
        });

        this._applyConfigOverride();
    }

    _createIconSizeSliderMenuItem() {

        const menuItem = new PopupBaseMenuItem({
            activate: false
        });

        this._iconSizeSlider = new Slider(0);

        const valueLabel = new St.Label({
            text: '0',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._iconSizeSlider.connect('notify::value', () => {

            const value = this._getIconSizeSliderValue();

            valueLabel.text = value.toString()

            this._config.configOverride.iconSize = value;

            this._applyConfigOverride();
        });

        this._setIconSizeSliderValue();

        menuItem.connect('key-press-event', (actor, event) => {
            return this._iconSizeSlider.emit('key-press-event', event);
        });

        menuItem.add_child(this._iconSizeSlider);
        menuItem.add_child(valueLabel);

        return menuItem;
    }

    _setIconSizeSliderValue() {

        const [sliderMaxValue, sliderValueOffset] = this._getIconSizeSliderBounds();

        this._iconSizeSlider.value = (this._config.configOverride.iconSize - sliderValueOffset) / sliderMaxValue;
        this._iconSizeSlider.overdriveStart = this._iconSizeSlider.value;
    }

    _getIconSizeSliderValue() {

        const [sliderMaxValue, sliderValueOffset] = this._getIconSizeSliderBounds();

        return Math.round(sliderMaxValue * this._iconSizeSlider.value) + sliderValueOffset;
    }

    _getIconSizeSliderBounds() {

        const iconSizeMax = 64;
        const iconSizeMin = 16;
        const sliderMaxValue = iconSizeMax - iconSizeMin;

        return [sliderMaxValue, iconSizeMin];
    }

    _applyConfigOverride() {
        
        const oldConfigOverride = this._appButton.getConfigOverride();

        // no need to update the config override
        if (this._config.configOverride.iconSize === oldConfigOverride.iconSize &&
                this._config.configOverride.activateRunningBehavior === oldConfigOverride.activateRunningBehavior) {
            return;
        }

        if (this._applyConfigOverrideTimeout) {
            GLib.source_remove(this._applyConfigOverrideTimeout);
        }

        this._applyConfigOverrideTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {

            this._applyConfigOverrideTimeout = null;

            this._appButton.setConfigOverride(this._config.configOverride);

            return GLib.SOURCE_REMOVE;
        });
    }

    //#endregion private methods

}