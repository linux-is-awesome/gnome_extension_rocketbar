/* exported AppButtonTooltip */

//#region imports

const { Clutter, St, GObject, Shell } = imports.gi;
const Main = imports.ui.main;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Timeout } = Me.imports.utils.timeout;
const { IconProvider } = Me.imports.utils.iconProvider;

//#endregion imports

class WindowPreview {

    constructor(window, settings, callback) {

        this.actor = new St.Button({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
            reactive: true,
            style_class: 'rocketbar__window-preview'
        });

        const layout = new St.BoxLayout({
            vertical: true
        });

        this.actor.set_child(layout);  

        const mutterWindow = window.get_compositor_private();

        let [width, height] = mutterWindow.get_size();

        const scale = Math.min(1, 200 / height, 200 / width);


        layout.add_actor(new St.Label({
            name: 'window-preview-text',
            text: window.title,
            style: `max-width: ${width * scale}px;`
        }));


        const windowClone = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            style: 'min-width: 200px; min-height: 112px;' // TODO: config aspect ratio!
        });
        
        windowClone.set_child(this.getClone(window));

        layout.add_actor(windowClone);

        if (window.has_focus()) {
            this.actor.add_style_pseudo_class('focus');
        }

        this.actor.connect('clicked', () => {

            const event = Clutter.get_current_event();

            const button = (
                event.type() === Clutter.EventType.BUTTON_RELEASE ?
                event.get_button() :
                null
            );

            const isMiddleButton = button === Clutter.BUTTON_MIDDLE;

            if (isMiddleButton) {
                const parent = this.actor.get_parent();

                if (parent.get_children().length === 1) {
                    //TODO
                    callback();
                    windowClone.get_child()?.destroy();
                } else {
                    this.actor.destroy();
                }

                parent.get_parent().get_parent().get_parent().queue_relayout();

                window?.delete(global.get_current_time());
                
                return;
            }

            Main.activateWindow(window);

            callback();
        });
    }

    getClone(metaWindow) {

        const clone = new Shell.WindowPreview({
            style: `box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2);`,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            //offscreen_redirect: Clutter.OffscreenRedirect.AUTOMATIC_FOR_OPACITY
        });

        const mutterWindow = metaWindow.get_compositor_private();

        let [width, height] = mutterWindow.get_size();

        const scale = Math.min(1, 112 / height, 200 / width);

        const windowContainer = new Clutter.Actor({
            width: width * scale,
            height: height * scale
        });

        clone.window_container = windowContainer;

        windowContainer.layout_manager = new Shell.WindowPreviewLayout();

        windowContainer.layout_manager.add_window(metaWindow);

        clone.add_child(windowContainer);

        return clone;
    }

}

class WindowPreviewContainer {

    constructor(appButton, settings, clickHandler) {

        this._appButton = appButton;
        this._settings = settings;
        this._clickHandler = clickHandler;

        this._createActor();
    }

    update() {

        // currently we don't need to support recreating windows previews
        if (this._layout.get_children().length) {
            return;
        }

        this._handleAppWindows();
    }

    _createActor() {

        this.actor = new St.ScrollView({
            name: 'appButton-tooltip-window-preview-container',
            enable_mouse_scrolling: true,
            clip_to_allocation: true,
            reactive: false
        });

        this.actor.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.NEVER);

        this._layout = new St.BoxLayout({
            name: 'appButton-tooltip-window-preview-container-layout',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.actor.add_actor(this._layout);
    }

    _handleAppWindows() {
        let actorWidth = 0;

        const appWindows = this._getAppWindows();

        if (!appWindows.length) {
            return;
        }

        for (let i = 0, l = appWindows.length; i < l; ++i) {

            const windowPreviewActor = new WindowPreview(appWindows[i], this._settings, this._clickHandler).actor;

            this._layout.add_actor(windowPreviewActor);

            // calculate size for the actor

            // TODO: this should be configurable
            if (i > 2) {
                continue;
            }

            const [previewWidth, previewHeight] = windowPreviewActor.get_size();

            actorWidth += previewWidth;
        }

        // we set the initial max-width here
        // there is no need to update it later for now
        this.actor.style = `max-width: ${actorWidth}px;`;
    }

    _getAppWindows() {
        const workspaceIndex = global.workspace_manager.get_active_workspace_index();

        return this._appButton.app.get_windows().filter(window => window.get_workspace().index() === workspaceIndex);
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

    static _lastTooltip = null;

    //#region public methods

    constructor(appButton, settings, showCallback = () => {}) {

        this._appButton = appButton;
        this._settings = settings;
        this._showCallback = showCallback;
        
        this._setConfig();

        const showDelay = (
            AppButtonTooltip._lastTooltip ?
            this._config.hideDelay :
            this._config.showDelay
        );

        this._showTimeout = Timeout.default(showDelay).run(() => {
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

        if (AppButtonTooltip._lastTooltip && AppButtonTooltip._lastTooltip !== this) {
            AppButtonTooltip._lastTooltip.destroy();
        } else if (!AppButtonTooltip._lastTooltip) {
            this._tooltipActor.translation_y = -this._config.popupOffset;
            this._tooltipActor.opacity = 0;
        }

        AppButtonTooltip._lastTooltip = this;

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

            this._showCallback(false);

            if (AppButtonTooltip._lastTooltip === this) {
                AppButtonTooltip._lastTooltip = null;
            }

            this._tooltip.destroy();
            this._tooltip = null;

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
            maxWidth: this._settings.get_int('tooltip-max-width'),
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
            track_hover: true
        });

        this._tooltip.set_child(this._tooltipActor);

        this._tooltipActor.connect('notify::hover', () => this._hover());

        // create window previews or tooltip text

        if (!this._createWindowsPreviews()) {

            this._tooltipText = new St.Label({
                name: 'appButton-tooltip-text',
                style: `max-width: ${this._config.maxWidth}px;`
            });

            this._tooltipActor.add_actor(this._tooltipText);
        }

        // create counters

        this._createCounters();

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

        if (!this._appButton.windows) {
            return;
        }

        if (this._tooltipActor.hover) {
            this._hideTimeout?.destroy();
            this._hideTimeout = null;
            return;
        }

        // TODO
        this.hide()
    }

    _update() {

        // TODO: check that tooltip is not destroying
        if (!this._tooltip) {
            return;
        }

        this._updateAppTitle();
        this._updateWindowsCount();
        this._updateNotificationsCount();
        this._updateSoundVolumeIndicators();

        this._windowPreviewContainer?.update();

        this._setPositionAndSize();
    }

    _updateAppTitle() {

        if (!this._tooltipText) {
            return;
        }

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

    _createWindowsPreviews() {

        if (!this._config.windowPreview || !this._appButton.windows) {
            return false;
        }

        this._windowPreviewContainer = new WindowPreviewContainer(
            this._appButton, this._settings,
            () => this.destroy(true)
        );

        this._tooltipActor.add_actor(this._windowPreviewContainer.actor);

        this._tooltip.add_style_class_name('has-window-preview');
        this._tooltipActor.set_vertical(true);

        return true;
    }

    _setPositionAndSize() {

        if (!this._tooltip) {
            return;
        }

        const [lastX, lastWidth, lastHeight] = [
            AppButtonTooltip._lastTooltip?._tooltip?.x,
            AppButtonTooltip._lastTooltip?._tooltip?.width,
            AppButtonTooltip._lastTooltip?._tooltip?.height
        ];

        let [x, y] = this._appButton.get_transformed_position();

        const [appButtonWidth, appButtonHeight] = [
            this._appButton.allocation.get_width(),
            this._appButton.allocation.get_height()
        ];

        // reset width and height to make the tooltip handle it's size correctly
        this._tooltip.width = -1;
        this._tooltip.height = -1;

        let [tooltipWidth, tooltipHeight] = this._tooltip.get_size();

        const xOffset = Math.floor((appButtonWidth - tooltipWidth) / 2);

        // if app button is on top of the screen
        if (y < 100) {
            y = y + appButtonHeight;
        } else {
            y = y - tooltipHeight;
        }

        x = Math.clamp(x + xOffset, 0, global.stage.width - tooltipWidth);

        if (!AppButtonTooltip._lastTooltip) {
            this._tooltip.set_position(x, y);
            return;
        }

        this._tooltip.y = y;
        this._tooltip.x = lastX;
        this._tooltip.width = lastWidth;

        const heightDiff = (
            lastHeight > this._tooltip.height ?
            this._tooltip.height / lastHeight :
            lastHeight / this._tooltip.height
        );

        // check if the height difference is not too much to allow animate it
        if (heightDiff > 0.5) {
            this._tooltip.height = lastHeight;
        }

        // ease only when required

        if (this._tooltip.x !== x) {
            this._tooltip.ease({
                x: x,
                duration: 400
            });
        }

        if (this._tooltip.width !== tooltipWidth ||
                this._tooltip.height !== tooltipHeight) {
            this._tooltip.ease({
                width: tooltipWidth,
                height: tooltipHeight,
                duration: 300
            });
        }
    }

    //#endregion private methods

}
