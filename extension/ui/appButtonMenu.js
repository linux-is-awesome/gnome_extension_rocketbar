/* exported AppButtonMenu */

//#region imports

const Main = imports.ui.main;
const BoxPointer = imports.ui.boxpointer;
const { Clutter, St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const { Slider } = imports.ui.slider;
const { PopupMenuSection,
        PopupSeparatorMenuItem,
        PopupSubMenuMenuItem,
        PopupBaseMenuItem,
        Ornament } = imports.ui.popupMenu;

const _ = imports.misc.extensionUtils.gettext;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Timeout } = Me.imports.utils.timeout;
const { IconProvider } = Me.imports.utils.iconProvider;

//#endregion imports

class SubMenuItem {

    constructor(title, parentMenu) {

        this._updateTimeout = null;

        this.actor = new PopupSubMenuMenuItem(title);

        parentMenu.addMenuItem(this.actor);
        parentMenu.addMenuItem(new PopupSeparatorMenuItem());
    }

    addMenuItem(menuItem) {
        this.actor.menu.addMenuItem(menuItem);
    }

    addAction(title, callback) {
        return this.actor.menu.addAction(title, callback);
    }

    queueUpdate(callback) {

        if (this._updateTimeout || !callback) {
            return;
        }

        this._updateTimeout = Timeout.redraw().run(() => {

            if (!this._updateTimeout) {
                return;
            }

            this._updateTimeout = null;

            callback();
            
        });
    }

    destroy() {
        this._updateTimeout?.destroy();
        this._updateTimeout = null;
    }

}

class AppButtonMenuBase extends AppMenu {

    constructor(appButton, settings) {

        super(appButton, St.Side.TOP, {
            favoritesSection: true,
            showSingleWindows: true,
        });

        this._appButton = appButton;
        this._settings = settings;

        this._hasValidAppId = this._appSystem.lookup_app(this._appButton.appId) !== null;

        this.blockSourceEvents = true;

        // override styles
        this.actor.remove_style_class_name('app-menu');
        this.actor.add_style_class_name('panel-menu aggregate-menu');

        // shrink menu width as much as possible
        this.actor.style = 'max-width: 0;';

        this._fixMenuSeparatorFontSize(this._openWindowsHeader);

        this._updateDetailsVisibility();

        Main.panel.menuManager.addMenu(this);
    }

    destroy() {

        this.close(false);

        this._app = null;

        super.destroy();
    }

    open() {

        if (!this._config) {

            this._setConfig();

            this.setApp(this._appButton.app);

            Main.uiGroup.add_actor(this.actor);

        } else {
            this._handleSettings();
        }

        // set correct position 
        this._setPosition();
        
        // animate open by default
        super.open(BoxPointer.PopupAnimation.FULL);
    }


    _handleSettings() {
        const oldConfig = this._config || {};

        this._setConfig();

        if (oldConfig.isolateWorkspaces !== this._config.isolateWorkspaces) {
            this._updateWindowsSection();
        }

        if (oldConfig.showFavorites !== this._config.showFavorites) {
            this._updateFavoriteItem();
        }
    }

    _setConfig() {
        this._config = {
            showFavorites: this._settings.get_boolean('taskbar-show-favorites'),
            isolateWorkspaces: this._settings.get_boolean('taskbar-isolate-workspaces')
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

    _fixMenuSeparatorFontSize(separator) {
        separator.style = 'font-size: 0.8em;';
    }

    //#region default methods override

    _onKeyPress(actor, event) {

        let key = event?.get_key_symbol();

        // Space and Return keys are reserved for the app button
        if (key === Clutter.KEY_space || key === Clutter.KEY_Return) {
            return Clutter.EVENT_PROPAGATE;
        }

        return super._onKeyPress(actor, event);
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

        if (!this._app) {
            return;
        }
        
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

    _updateDetailsVisibility() {

        // hide the item for apps without valid app Id
        // For example: OpenOffice DesktopEditors
        if (!this._hasValidAppId) {
            this._detailsItem.visible = false;
            return;
        }

        super._updateDetailsVisibility();
    }

    //#endregion default methods override

}

var AppButtonMenu = class extends AppButtonMenuBase {

    //#region public methods

    constructor(appButton, settings) {
        super(appButton, settings);

        this._addSoundControlSection();

        this._addCustomizeSection();

        // move Quit item to the end of the app menu
        this.moveMenuItem(this._quitItem, this.numMenuItems);
    }

    destroy() {

        this._soundControlSection?.destroy();

        this._customizeSection?.destroy();

        this._stopApplyConfigOverride();

        super.destroy();
    }

    open() {
        this._updateSountControlSection();

        super.open();
    }


    setApp(app) {
        super.setApp(app);

        if (!app) {
            return;
        }

        this._customizeSection?.queueUpdate(() => this._populateCustomizeSection());
    }

    //#endregion public methods

    //#region private methods

    _handleSettings() {
        super._handleSettings();

        this._customizeSection?.queueUpdate(() => this._updateCustomizeSection());
    }

    _setConfig() {
        super._setConfig();

        this._config.defaultIconSize = this._settings.get_int('appbutton-icon-size');
        this._config.configOverride = this._appButton.configOverride.get();
    }

    _addSoundControlSection() {
        this._soundControlSection = new SubMenuItem(_('Sound Volume Control'), this);

        [this._soundOutputSliderItem, this._soundOutputSlider] = this._createSoundSliderMenuItem();
        [this._soundInputSliderItem, this._soundInputSlider] = this._createSoundSliderMenuItem(true);

        this._soundControlSection.addMenuItem(this._soundOutputSliderItem);
        this._soundControlSection.addMenuItem(this._soundInputSliderItem);
    }

    _addCustomizeSection() {

        // Don't allow customizations for app buttons without valid app Id
        // For example: OnlyOffice creates a separete window called DesktopEditors
        //              This window always has some random app Id
        //              and there is no simple way to workaround that weird behavior
        if (!this._hasValidAppId) {
            return;
        }

        // add Customize section to the app menu
        this._customizeSection = new SubMenuItem(_('Customize'), this);
    }

    _createSoundSliderMenuItem(isInput) {
        const menuItem = new PopupBaseMenuItem({
            activate: false
        });

        menuItem.setOrnament(Ornament.HIDDEN);

        menuItem.add_child(new St.Icon({
            icon_name: (
                isInput ?
                'audio-input-microphone-symbolic' :
                'audio-speakers-symbolic'
            ),
            style_class: 'popup-menu-icon'
        }));

        const slider = this._createSlider(menuItem, () => {
            
            if (!this._appButton.soundVolumeControl ||
                    this._soundControlSection._isUpdating) {
                return;
            }

            if (isInput) {
                this._appButton.soundVolumeControl.setInputVolume(slider.value);
            } else {
                this._appButton.soundVolumeControl.setOutputVolume(slider.value);
            }

        });

        menuItem.add_child(slider);

        return [menuItem, slider];
    }

    _updateSountControlSection() {

        this._soundControlSection.actor.hide();

        if (!this._appButton.soundVolumeControl) {            
            return;
        }

        if (this._appButton.soundVolumeControl.hasOutput()) {
            this._soundControlSection.actor.show();
            this._soundOutputSliderItem.show();
        } else {
            this._soundOutputSliderItem.hide();
        }

        if (this._appButton.soundVolumeControl.hasInput()) {
            this._soundControlSection.actor.show();
            this._soundInputSliderItem.show();
        } else {
            this._soundInputSliderItem.hide();
        }

        if (!this._soundControlSection.actor.visible) {
            return;
        }

        this._soundControlSection.queueUpdate(() => {

            if (!this._appButton.soundVolumeControl) {
                return;
            }

            this._soundControlSection._isUpdating = true;

            if (this._soundOutputSliderItem.visible) {
                this._soundOutputSlider.value = this._appButton.soundVolumeControl.getOutputVolume();
            }

            if (this._soundInputSliderItem.visible) {
                this._soundInputSlider.value = this._appButton.soundVolumeControl.getInputVolume();
            }

            this._soundControlSection._isUpdating = false;

        });
    }

    _populateCustomizeSection() {

        if (!this._customizeSection) {
            return;
        }

        // Add Activate Running Behavior items
        
        this._activateBehaviorSection = new PopupMenuSection();

        this._activateBehaviorSection.addMenuItem(this._createSeparator(_('Activation Behavior')));

        this._activateBehaviorNewWindowItem = this._activateBehaviorSection.addAction(
            _('New window'),
            () => this._setActivationBehaviorValue('new_window')
        );
        this._activateBehaviorMoveWindowsItem = this._activateBehaviorSection.addAction(
            _('Move windows'),
            () => this._setActivationBehaviorValue('move_windows')
        );

        this._customizeSection.addMenuItem(this._activateBehaviorSection);

        // add Icon customization section

        this._customIconSection = new PopupMenuSection();

        this._customIconSection.addMenuItem(this._createSeparator(_('Icon')));

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

        this._customizeSection.addMenuItem(this._customIconSection);

        // add Icon Size customization item

        this._customizeSection.addMenuItem(this._createSeparator(_('Icon Size')));
        this._customizeSection.addMenuItem(this._createIconSizeSliderMenuItem());

        // add Reset All item
        this._customizeSection.addMenuItem(this._createSeparator());
        this._resetAllItem = this._customizeSection.addAction(
            _('Reset all to default'),
            () => this._appButton.configOverride.reset()
        );

        this._updateCustomizeSection();
    }

    _updateCustomizeSection() {

        if (!this._customizeSection) {
            return;
        }

        this._customizeSection._isUpdating = true;

        this._setIconSizeSliderValue();

        this._setIconSizeSliderOverdrive();

        this._activateBehaviorSection.actor.visible = this._config.isolateWorkspaces;

        this._setActivationBehaviorValue();

        this._updateCustomIconSection();

        this._resetAllItem.actor.reactive = !this._appButton.configOverride.isEmpty();

        this._customizeSection._isUpdating = false;
    }

    _setActivationBehaviorValue(value) {

        if (!this._activateBehaviorSection.actor.visible) {
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

        const valueLabel = new St.Label({
            text: '0',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._iconSizeSlider = this._createSlider(menuItem, () => {

            const value = this._getIconSizeSliderValue();

            valueLabel.text = value.toString()

            this._config.configOverride.iconSize = value;

            this._applyConfigOverride();

        });

        menuItem.add_child(this._iconSizeSlider);
        menuItem.add_child(valueLabel);

        return menuItem;
    }

    _createSlider(menuItem, onchange) {
        const result = new Slider(0);

        menuItem.connect('key-press-event', (actor, event) => {
            return result.emit('key-press-event', event);
        });

        result.connect('notify::value', onchange);

        return result;
    }

    _createSeparator(title) {
        const separator = new PopupSeparatorMenuItem(title);

        if (!title) {
            return separator;
        }

        this._fixMenuSeparatorFontSize(separator);

        separator.style += 'margin-top: 10px;';

        return separator;
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
        this._customIconSection.actor.visible = !!this._config.configOverride.customIconPath;
        this._customIconResetItem.visible = this._customIconSection.actor.visible;

        this._customIconSetItem.hide();

        // check if there is a valid icon in the clipboard
        this._importIconFromClipboard().then(iconPath => {

            if (!this.isOpen || !iconPath ||
                    // no reason to import the same icon twice
                    iconPath === this._config.configOverride.customIconPath) {
                return;
            }

            this._customIconSection.actor.show();
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
            (clipboard, iconPath) => resolve(
                IconProvider.instance().getCustomIcon(iconPath) !== null ?
                iconPath : null
            )
        ));
    }

    _setCustomIcon(iconPath) {

        this._config.configOverride.customIconPath = iconPath;

        this._applyConfigOverride();
    }

    _applyConfigOverride() {

        // no need to apply the config override
        if (this._customizeSection?._isUpdating ||
                this._appButton.configOverride.equals(this._config.configOverride)) {
            return;
        }

        this._stopApplyConfigOverride();

        this._applyConfigOverrideTimeout = Timeout.idle(300).run(() => {

            this._applyConfigOverrideTimeout = null;

            this._appButton.configOverride.set(this._config.configOverride);

            this._resetAllItem.actor.reactive = true;
        });
    }

    _stopApplyConfigOverride() {
        this._applyConfigOverrideTimeout?.destroy();
        this._applyConfigOverrideTimeout = null;
    }

    //#endregion private methods

}
