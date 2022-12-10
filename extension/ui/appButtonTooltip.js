/* exported AppButtonTooltip */

//#region imports

const { Clutter, St, GObject } = imports.gi;
const Main = imports.ui.main;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Timeout } = Me.imports.utils.timeout;
const { IconProvider } = Me.imports.utils.iconProvider;

//#endregion imports

class WindowPreview {

    constructor(window) {
        this.actor = new St.Button({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true
        });

        this.actor.connect('clicked', () => Main.activateWindow(window));
                                         
        const mutterWindow = window.get_compositor_private();

        let [width, height] = mutterWindow.get_size();

        let scale = Math.min(1.0, 200 / width, 200 / height);

        this.actor.style = `width: ${width * scale}px; height: ${height * scale}px;`;

        const windowClone = new Clutter.Clone({
            source: window.get_compositor_private(),
            reactive: false
        });

        this.actor.set_child(windowClone);
    }

}

class WindowPreviewList {

    constructor(appButton) {
        this._appButton = appButton;

        this._initialize();
    }

    isEmpty() {
        return !this.actor;
    }

    _initialize() {

        this._createLayout();
    }

    _createLayout() {

        this.actor = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.NEVER,
            enable_mouse_scrolling: true
        });

        this._container = new St.BoxLayout({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-top: 5px; margin-bottom: 5px;'
        });

        this.actor.add_actor(this._container);

        const workspaceIndex = global.workspace_manager.get_active_workspace_index();

        const appWindows = this._appButton.app.get_windows().filter(window => window.get_workspace().index() === workspaceIndex);
        
        for (let window of appWindows) {
            this._container.add_actor(new WindowPreview(window).actor);
        }
    }

}

class TooltipCounter {

    constructor(iconName, minCount) {

        this._minCount = minCount || 0;

        // create layout

        this.actor = new St.BoxLayout({
            name: 'appButton-tooltip-counter',
            style_class: 'rocketbar__tooltip_counter'
        });

        this.actor.add_actor(new St.Icon({
            name: 'appButton-tooltip-counter-icon',
            gicon: IconProvider.instance().getIcon(iconName)
        }));

        this._label = new St.Label({
            name: 'appButton-tooltip-counter-text'
        });

        this.actor.add_actor(this._label);
    }

    setCount(count) {

        count = count || 0;

        this._label.text = count.toString();

        if (count < this._minCount) {
            this.actor.hide();
            return;
        }

        this.actor.show();
    }
}

var AppButtonTooltip = class {

    //#region public methods

    constructor(appButton, settings, showCallback = () => {}) {

        this._appButton = appButton;
        this._settings = settings;
        this._showCallback = showCallback;

        this._maxWidth = settings.get_int('tooltip-max-width');
        
        this._setConfig();

        this._showTimeout = Timeout.default(this._config.showDelay).run(() => {
            this._showTimeout = null;
            this.show();
        });
    }

    rerender() {
        this._update();
    }

    show() {

        this._hideTimeout?.destroy();
        this._hideTimeout = null;

        if (!this._tooltip) {
            this._createTooltip();
            this._update();
        }

        this._tooltipActor.remove_all_transitions();

        this._tooltipActor.ease({
            opacity: 255,
            translation_y: 0,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });

        this._showCallback(true);
    }

    hide() {

        if (!this._tooltip) {
            this.destroy();
            return;
        }

        this._hideTimeout = Timeout.default(this._config.hideDelay).run(() => {

            this._hideTimeout = null;

            this.destroy(true);
        });
    }

    destroy(animation) {

        this._showTimeout?.destroy();
        this._hideTimeout?.destroy();
        this._showTimeout = null;
        this._hideTimeout = null;

        if (!this._tooltip) {
            this._showCallback(false);
            return;
        }

        this._tooltipActor.remove_all_transitions();

        if (!animation) {

            this._tooltip.destroy();
            this._tooltip = null;

            this._showCallback(false);

            return;
        }

        this._tooltipActor.ease({
            opacity: 0,
            translation_y: -this._config.popupOffset,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy()
        });
    }

    //#endregion public methods

    //#region private methods

    _setConfig() {
        this._config = {
            showDelay: this._settings.get_int('tooltip-show-delay'),
            hideDelay: 200,
            windowPreview: true,
            popupOffset: 5
        }
    }

    _createTooltip() {

        this._tooltip = new St.Bin({
            name: 'appButton-tooltip',
            style_class: 'rocketbar__tooltip'
        });

        this._tooltipActor = new St.BoxLayout({
            name: 'appButton-tooltip-actor',
            style_class: 'dash-label',
            reactive: true,
            track_hover: true,
            translation_y: -this._config.popupOffset,
            opacity: 0
        });

        this._tooltip.set_child(this._tooltipActor);

        // create tooltip text

        this._tooltipText = new St.Label({
            name: 'appButton-tooltip-text',
            style: `max-width: 200px;` //TODO
            //style: `max-width: ${this._maxWidth}px;`
        });

        this._tooltipActor.add_actor(this._tooltipText);

        // create window previews

        if (this._config.windowPreview && this._appButton.windows) {
            this._tooltipActor.set_vertical(true);
            this._tooltipActor.style = 'border-radius: 8px;'
            this._tooltipActor.add_actor(new WindowPreviewList(this._appButton).actor);
        }

        // create counters

        this._createCounters();

        // handle hover

        if (this._appButton.windows) {
            this._tooltipActor.connect('notify::hover', () => this._hover());
        }

        // all ui elements created!

        Main.layoutManager.addChrome(this._tooltip);
    }

    _createCounters() {

        const counters = new St.BoxLayout({
            name: 'appButton-tooltip-counters',
            x_align: Clutter.ActorAlign.CENTER
        });

        // create windows counter

        this._windowsCounter = new TooltipCounter('window-symbolic', 2);

        counters.add_actor(this._windowsCounter.actor);

        // create notifications counter

        this._notificationsCounter = new TooltipCounter('notification-symbolic', 1);

        counters.add_actor(this._notificationsCounter.actor);

        // create sound icons

        this._soundOutputVolume = new TooltipCounter('audio-speakers-symbolic');
        this._soundInputVolume = new TooltipCounter('audio-input-microphone-symbolic');

        counters.add_actor(this._soundOutputVolume.actor);
        counters.add_actor(this._soundInputVolume.actor);

        this._tooltipActor.add_actor(counters);
    }

    _hover() {

        if (this._tooltipActor.hover) {
            this._hideTimeout?.destroy();
            this._hideTimeout = null;
            return;
        }

        // TODO
        this.hide()
    }

    _update() {

        if (!this._tooltip) {
            return;
        }

        this._updateAppTitle();
        this._updateWindowsCount();
        this._updateNotificationsCount();
        this._updateSoundVolumeIndicators();

        this._setPosition();
    }

    _updateAppTitle() {
        this._tooltipText.text = (
            this._appButton.activeWindow ?
            this._appButton.activeWindow.title :
            this._appButton.app.get_name()
        );
    }

    _updateWindowsCount() {
        this._windowsCounter.setCount(this._appButton.windows);
    }

    _updateNotificationsCount() {
        this._notificationsCounter.setCount(this._appButton.notifications);
    }

    _updateSoundVolumeIndicators() {

        if (this._appButton?.soundVolumeControl?.hasOutput()) {
            this._soundOutputVolume.setCount(
                Math.round(this._appButton.soundVolumeControl.getOutputVolume() * 100)
            );
            this._soundOutputVolume.actor.show();
        } else {
            this._soundOutputVolume.actor.hide();
        }

        if (this._appButton?.soundVolumeControl?.hasInput()) {
            this._soundInputVolume.setCount(
                Math.round(this._appButton.soundVolumeControl.getInputVolume() * 100)
            );
            this._soundInputVolume.actor.show();
        } else {
            this._soundInputVolume.actor.hide();
        }

    }

    _setPosition() {

        if (!this._tooltip) {
            return;
        }

        let [x, y] = this._appButton.get_transformed_position();

        const [appButtonWidth, appButtonHeight] = [
            this._appButton.allocation.get_width(),
            this._appButton.allocation.get_height()
        ];

        const [tooltipWidth, tooltipHeight] = this._tooltip.get_size();

        const xOffset = Math.floor((appButtonWidth - tooltipWidth) / 2);
        
        // define a static vertical offset
        const yOffset = 3;

        // if app button is on top of the screen
        if (y < 100) {
            y = y + appButtonHeight;
        } else {
            y = y - tooltipHeight;
        }

        x = Math.clamp(x + xOffset, 0, global.stage.width - tooltipWidth);

        this._tooltip.set_position(x, y);
    }

    //#endregion private methods

}
