const Main = imports.ui.main;
const BoxPointer = imports.ui.boxpointer;
const { Clutter, St, GLib, Meta } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const { Slider } = imports.ui.slider;
const { PopupMenuSection,
        PopupSeparatorMenuItem,
        PopupSubMenuMenuItem,
        PopupBaseMenuItem,
        Ornament } = imports.ui.popupMenu;

const _ = imports.misc.extensionUtils.gettext;

var AppButtonMenu = class extends AppMenu {

    //#region public methods

    constructor(appButton, settings) {

        super(appButton, St.Side.TOP, {
            favoritesSection: true,
            showSingleWindows: true,
        });

        this._appButton = appButton;
        this._settings = settings;

        this.blockSourceEvents = true;

        // override styles
        this.actor.remove_style_class_name('app-menu');
        this.actor.add_style_class_name('panel-menu aggregate-menu');

        // shrink menu width as much as possible
        this.actor.style = 'max-width: 0';

        this._fixMenuSeparatorFontSize(this._openWindowsHeader);

        // Don't allow customizations for app buttons without valid app Id
        // For example: OnlyOffice creates a separete window called DesktopEditors
        //              This window always has some random app Id
        //              and there is no simple way to workaround that weird behavior
        if (!this._isCustomizeSectionVisible()) {
            return;
        }

        // add Customize section to the app menu
        this._customizeSection = new PopupSubMenuMenuItem(_('Customize'));
        this.addMenuItem(this._customizeSection);
        this.addMenuItem(new PopupSeparatorMenuItem());

        // move Quit item to the end of the app menu
        this.moveMenuItem(this._quitItem, this.numMenuItems);
    }

    open() {

        if (!this._config) {

            this._setConfig();

            this.setApp(this._appButton.app);

            Main.uiGroup.add_actor(this.actor);

            // populate Customize section with a delay
            if (this._customizeSection) {
                this._populateCustomizeSectionLaterId = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                    this._populateCustomizeSection();
                    return GLib.SOURCE_REMOVE;
                });
            }

        } else {
            this._handleSettings();
        }

        // set correct position 
        this._setPosition();
        
        // animate open by default
        super.open(BoxPointer.PopupAnimation.FULL);
    }

    destroy() {
        super.destroy();

        if (this._populateCustomizeSectionLaterId) {
            Meta.later_remove(this._populateCustomizeSectionLaterId);
        }

        this._stopApplyConfigOverride();
    }


    //#endregion public methods

    //#region private methods

    _handleSettings() {
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

    _setConfig() {
        this._config = {
            showFavorites: this._settings.get_boolean('taskbar-show-favorites'),
            isolateWorkspaces: this._settings.get_boolean('taskbar-isolate-workspaces'),
            defaultIconSize: this._settings.get_int('appbutton-icon-size'),
            configOverride: this._appButton.getConfigOverride()
        };
    }

    _setPosition() {

        const [x, y] = this._appButton.get_transformed_position();

        // set position based on location of app button
        this.actor._arrowSide = (
            y < 100 ?
            St.Side.TOP :
            St.Side.BOTTOM
        );
    }

    _onKeyPress(actor, event) {

        let key = event?.get_key_symbol();

        // Space and Return keys are reserved for the app button
        if (key === Clutter.KEY_space || key === Clutter.KEY_Return) {
            return Clutter.EVENT_PROPAGATE;
        }

        super._onKeyPress(actor, event);
    }

    _updateFavoriteItem() {
        super._updateFavoriteItem();

        if (!this._toggleFavoriteItem.visible) {
            return;
        }

        if (!this._config.showFavorites) {
            this._toggleFavoriteItem.hide();
            return;
        }

        const isFavorite = this._appFavorites.isFavorite(this._app.id);

        if (this._config.showFavorites && !isFavorite) {
            this._toggleFavoriteItem.label.text = _('Pin');
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

    _isCustomizeSectionVisible() {
        return this._appSystem.lookup_app(this._appButton.appId) !== null;
    }

    _populateCustomizeSection() {

        if (!this._customizeSection) {
            return;
        }

        const separatorStyle = 'margin-top: 10px;';

        // Add Activate Running Behavior items
        
        this._activateBehaviorSection = new PopupMenuSection();

        this._activateBehaviorSection.box.visible = this._config.isolateWorkspaces;

        const activateBehaviorTitle = new PopupSeparatorMenuItem(_('Activation Behavior'));
        this._fixMenuSeparatorFontSize(activateBehaviorTitle);
        activateBehaviorTitle.style += separatorStyle;

        this._activateBehaviorSection.addMenuItem(activateBehaviorTitle);

        this._activateBehaviorNewWindowItem = this._activateBehaviorSection.addAction(
            _('New window'),
            () => this._setActivationBehaviorValue('new_window')
        );
        this._activateBehaviorMoveWindowsItem = this._activateBehaviorSection.addAction(
            _('Move windows'),
            () => this._setActivationBehaviorValue('move_windows')
        );

        this._customizeSection.menu.addMenuItem(this._activateBehaviorSection);

        this._setActivationBehaviorValue();
        
        // add Icon customization section

        this._customIconSection = new PopupMenuSection();

        const customIconTitle = new PopupSeparatorMenuItem(_('Icon'));
        this._fixMenuSeparatorFontSize(customIconTitle);
        customIconTitle.style += separatorStyle;

        this._customIconSection.addMenuItem(customIconTitle);

        this._customIconSetItem = this._customIconSection.addAction(
            _('Import'),
            () => this._importIconFromClipboard().then(iconPath => {
            
                if (!iconPath) {
                    return;
                }

                this._setCustomIcon(iconPath);
            })
        );
        this._customIconResetItem = this._customIconSection.addAction(
            _('Reset to default'),
            () => this._setCustomIcon(null)
        );

        this._customizeSection.menu.addMenuItem(this._customIconSection);

        this._updateCustomIconSection();

        // add Icon Size customization item

        const iconSizeTitle = new PopupSeparatorMenuItem(_('Icon Size'));
        this._fixMenuSeparatorFontSize(iconSizeTitle);
        iconSizeTitle.style += separatorStyle;

        this._customizeSection.menu.addMenuItem(iconSizeTitle);
        this._customizeSection.menu.addMenuItem(this._createIconSizeSliderMenuItem());

        // add Reset item
        this._customizeSection.menu.addMenuItem(new PopupSeparatorMenuItem());
        this._customizeSection.menu.addAction(
            _('Reset all to default'),
            () => this._appButton.resetConfigOverride()
        );

        // remove later id
        this._populateCustomizeSectionLaterId = null;
    }

    _fixMenuSeparatorFontSize(separator) {
        separator.style = 'font-size: 0.8em;';
    }

    _updateCustomizeSection() {

        if (!this._customizeSection || this._populateCustomizeSectionLaterId) {
            return;
        }

        this._setIconSizeSliderValue();

        this._setIconSizeSliderOverdrive();

        this._activateBehaviorSection.box.visible = this._config.isolateWorkspaces;

        this._setActivationBehaviorValue();

        this._updateCustomIconSection();
    }

    _setActivationBehaviorValue(value) {

        if (!this._activateBehaviorSection.box.visible) {
            return;
        }

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

        menuItem.connect('key-press-event', (actor, event) => {
            return this._iconSizeSlider.emit('key-press-event', event);
        });

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

        this._setIconSizeSliderOverdrive();

        menuItem.add_child(this._iconSizeSlider);
        menuItem.add_child(valueLabel);

        return menuItem;
    }

    _setIconSizeSliderValue() {

        const [sliderMaxValue, sliderValueOffset] = this._getIconSizeSliderBounds();

        this._iconSizeSlider.value = (this._config.configOverride.iconSize - sliderValueOffset) / sliderMaxValue;
    }

    _setIconSizeSliderOverdrive() {

        const [sliderMaxValue, sliderValueOffset] = this._getIconSizeSliderBounds();

        this._iconSizeSlider.overdriveStart = (this._config.defaultIconSize - sliderValueOffset) / sliderMaxValue;
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

    _updateCustomIconSection() {

        // hide this section by default if no custom icon selected
        this._customIconSection.box.visible = !!this._config.configOverride.customIconPath;
        this._customIconResetItem.visible = this._customIconSection.box.visible;

        this._customIconSetItem.hide();

        // check if there is a valid icon in the clipboard
        this._importIconFromClipboard().then(iconPath => {

            if (!this.isOpen || !iconPath ||
                    // no reason to import the same icon twice
                    iconPath === this._config.configOverride.customIconPath) {
                return;
            }

            this._customIconSection.box.show();
            this._customIconSetItem.show();

            // replace label of the menu item

            if (this._customIconSetItem.label.text.includes(':')) {
                this._customIconSetItem.label.text = this._customIconSetItem.label.text.split(':')[0];
            }

            const iconPathParts = iconPath.split('/');

            this._customIconSetItem.label.text += ': ' + iconPathParts[iconPathParts.length - 1];

        });
    }

    _importIconFromClipboard() {
        return new Promise(resolve => St.Clipboard.get_default().get_text(
            St.ClipboardType.CLIPBOARD,
            (clipboard, iconPath) => resolve(this._appButton.isValidCustomIcon(iconPath) ? iconPath : null)
        ));
    }

    _setCustomIcon(iconPath) {

        this._config.configOverride.customIconPath = iconPath;

        this._applyConfigOverride();
    }

    _applyConfigOverride() {
        
        const oldConfigOverride = this._appButton.getConfigOverride();

        // no need to update the config override
        if (this._config.configOverride.iconSize === oldConfigOverride.iconSize &&
                this._config.configOverride.activateRunningBehavior === oldConfigOverride.activateRunningBehavior &&
                this._config.configOverride.customIconPath === oldConfigOverride.customIconPath) {
            return;
        }

        this._stopApplyConfigOverride();

        this._applyConfigOverrideTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {

            this._applyConfigOverrideTimeout = null;

            this._appButton.setConfigOverride(this._config.configOverride);

            return GLib.SOURCE_REMOVE;
        });
    }

    _stopApplyConfigOverride() {
        if (this._applyConfigOverrideTimeout) {
            GLib.source_remove(this._applyConfigOverrideTimeout);
            this._applyConfigOverrideTimeout = null;
        }
    }

    //#endregion private methods

}