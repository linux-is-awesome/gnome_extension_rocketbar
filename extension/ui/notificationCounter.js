/* exported NotificationCounter */

//#region imports

const { GObject, St, Clutter } = imports.gi;
const Main = imports.ui.main;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { NotificationHandler } = Me.imports.utils.notificationService;
const { Timeout } = Me.imports.utils.timeout;
const { Connections } = Me.imports.utils.connections;

//#endregion imports

class NotificationCounterContainer {

    constructor(notificationCounter, dndCallback) {

        this._dateMenu = Main.panel.statusArea.dateMenu;
        this._notificationCounter = notificationCounter;
        this._dndCallback = dndCallback;
        this._connections = null;
        this._container = null;

        this._setNotificationCounter();
    }

    destroy() {
        this._removeNotificationCounter();
    }

    getDndState() {
        return this._dateMenu?._indicator?._settings?.get_boolean('show-banners') === false;
    }

    _setNotificationCounter() {

        if (this._container || !this._dateMenu || !this._dateMenu._clockDisplay) {
            return;
        }

        this._connections = new Connections();

        // hide the indicator and prevent it from displaying
        // also handle Do not disturb state
        this._connections.add(this._dateMenu._indicator, 'notify::visible', indicator => indicator.hide());
        this._connections.add(this._dateMenu._indicator?._settings, 'changed::show-banners', () => this._dndCallback());
        this._dateMenu._indicator?.hide();

        // remember the class of the clock display
        this._clockDisplayStyleClass = this._dateMenu._clockDisplay?.style_class;

        // remove extra padding
        this._dateMenu.style = '-natural-hpadding: 0; -minimum-hpadding: 0;';

        // create a container for the notification counter with a delay
        // the delay helps to avoid animations stuttering
        this._initTimeout = Timeout.init().run(() => this._createContainer());
    }

    _createContainer() {

        const dateMenuContainer = this._dateMenu.get_children()[0];

        if (!dateMenuContainer) {
            return;
        }

        // remove clock display from the original container
        dateMenuContainer.remove_child(Main.panel.statusArea.dateMenu._clockDisplay);

        // create a custom container and make it look as a panel button
        this._container = new St.BoxLayout({
            name: 'notification-counter_container',
            style_class: this._clockDisplayStyleClass
        });

        // add items to the container
        this._container.add_child(Main.panel.statusArea.dateMenu._clockDisplay);
        this._container.add_child(this._notificationCounter);

        // remove a css class from the clock display
        // don't want it to look like a button anymore
        this._dateMenu._clockDisplay.style_class = null;

        dateMenuContainer.add_child(this._container);
    }

    _removeNotificationCounter() {

        this._initTimeout?.destroy();

        this._connections?.destroy();

        // restore the indicator
        this._dateMenu?._indicator?._sync();

        if (!this._container || !this._dateMenu || !this._dateMenu._clockDisplay) {
            return;
        }       

        // remove children we don't want to destroy from the container
        // before destroying the container itself
        this._container.remove_all_children();
        this._container.destroy();

        const dateMenuContainer = this._dateMenu.get_children()[0];

        if (!dateMenuContainer) {
            return;
        }

        // restore the original css class for the clock display
        this._dateMenu._clockDisplay.style_class = this._clockDisplayStyleClass;

        // restore date menu padding
        this._dateMenu.style = null;

        // add the clock display into the original container
        dateMenuContainer.insert_child_at_index(this._dateMenu._clockDisplay, 1);       
    }

}

var NotificationCounter = GObject.registerClass(
    class Rocketbar__NotificationCounter extends St.BoxLayout {

        _init(settings) {

            super._init({ name: 'notification-counter' });

            this._settings = settings;
            this._totalCount = 0;
            this._count = 0;
            this._isDnd = false;

            this._setConfig();

            this._createCounter();

            this._createConnections();

            this._notificationHandler = new NotificationHandler(count => this._setCount(count), null);

            this._container = new NotificationCounterContainer(this, () => this._updateDndState());
        }

        _createCounter() {

            this._counter = new St.Label({
                name: 'notification-counter_counter',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                text: '0',
                opacity: 0,
                visible: false
            });

            this._counter.set_pivot_point(0.5, 0.5);

            // create a spacer to display between the clock display and the counter
            const spacer = new St.Label({
                name: 'notification-counter_spacer',
                text: '  '
            });
            // the spacer visibility should be controlled by the counter visibility
            this._counter.bind_property('visible', spacer, 'visible', GObject.BindingFlags.SYNC_CREATE);

            this.add_actor(spacer);
            this.add_actor(this._counter);
        }

        _createConnections() {

            this.connect('destroy', () => this._destroy());

            this._connections = new Connections();

            this._connections.add(this, 'notify::mapped', () => {

                // disconnect it to prevent from executing more than once
                this._connections.remove('notify::mapped');

                this._updateDndState();

                // let's wait for notification service a bit
                this._initTimeout = Timeout.idle(100).run(() => {
                    // means we don't need to call the update
                    // when the first update has been initiated by the notification service
                    if (!this._updateTimeout) {
                        this._update();
                    }
                });

            });

            // handle settings
            this._connections.addScope(this._settings, [
                'changed::notification-counter-hide-empty',
                'changed::notification-counter-center-clock',
                'changed::notification-counter-max-count',
                'changed::notification-counter-font-size',
                'changed::notification-counter-roundness',
                'changed::notification-counter-color-empty',
                'changed::notification-counter-color-not-empty',
                'changed::notification-counter-text-color',
                'changed::notification-counter-color-empty-dnd',
                'changed::notification-counter-color-not-empty-dnd',
                'changed::notification-counter-text-color-dnd'
            ], () => this._handleSettings());
        }

        _handleSettings() {
            const oldConfig = this._config || {};

            this._setConfig();

            if (this._config.hideEmpty !== oldConfig.hideEmpty ||
                    this._config.centerClock !== oldConfig.centerClock) {
                
                if (this._canShow()) {
                    this._counter.show();
                } else {
                    this._counter.hide()
                }

                this._updateClockMargin();
    
                return;
            }

            if (this._config.maxCount !== oldConfig.maxCount) {
                
                this._setCount(this._totalCount);

                return;
            }

            this._updateStyle();
        }

        _setConfig() {
            this._config = {
                hideEmpty: this._settings.get_boolean('notification-counter-hide-empty'),
                centerClock: this._settings.get_boolean('notification-counter-center-clock'),
                maxCount: this._settings.get_int('notification-counter-max-count'),
                fontSize: this._settings.get_int('notification-counter-font-size'),
                roundness: this._settings.get_int('notification-counter-roundness'),
                colorEmpty: this._settings.get_string('notification-counter-color-empty'),
                colorNotEmpty: this._settings.get_string('notification-counter-color-not-empty'),
                textColor: this._settings.get_string('notification-counter-text-color'),
                colorEmptyDnd: this._settings.get_string('notification-counter-color-empty-dnd'),
                colorNotEmptyDnd: this._settings.get_string('notification-counter-color-not-empty-dnd'),
                textColorDnd: this._settings.get_string('notification-counter-text-color-dnd')
            };
        }

        _destroy() {

            this._initTimeout?.destroy();
            this._updateTimeout?.destroy();

            this._connections.destroy();

            this._counter.remove_all_transitions();

            this._container?.destroy();
            this._container = null;

            this._notificationHandler?.destroy();
        }

        _setCount(count) {

            this._totalCount = count;

            if (count > this._config.maxCount) {
                count = this._config.maxCount;
            }

            if (this._count === count) {
                return;
            }

            this._count = count;

            this._update();
        }

        _update() {

            if (!this._container) {
                return;
            }

            this._updateTimeout?.destroy();

            if (!this._isValid()) {
                // a workaround for the first update
                this._updateTimeout = Timeout.idle(100).run(() => {
                    this._update();
                    this._updateTimeout = null;
                });
                return;
            }

            // the validation before calling the method is required
            if (this._canShow()) {
                this._updateClockMargin();
            }

            this._counter.remove_all_transitions();

            // add a fancy animation
            this._counter.ease({
                scale_x: 0,
                scale_y: 0,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                
                    // update the counter when it's hidden

                    this._counter.text = this._count.toString();

                    if (!this._canShow()) {
                        this._updateClockMargin();
                        this._counter.hide()
                        return;
                    }

                    this._counter.show();

                    this._updateStyle();

                    this._updateClockMargin();

                    this._counter.ease({
                        opacity: 255,
                        scale_x: 1,
                        scale_y: 1,
                        duration: 200,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD
                    });
                }
            });
        }

        _updateClockMargin() {

            const parent = this.get_parent();

            if (!parent) {
                return;
            }

            if (!this._config.centerClock || !this._canShow()) {
                parent.style = null;
                return;
            }

            if (this.width) {
                parent.style = `margin-left: ${this.width}px;`;
            }

        }

        _canShow() {
            return this._count || !this._config.hideEmpty;
        }

        _updateDndState() {

            this._isDnd = this._container?.getDndState();

            this._updateStyle();
        }

        _updateStyle() {

            if (!this._isValid()) {
                return;
            }

            const isNotEmpty = this._count > 0;
            const isShort = this._count < 10;

            const borderColor = (
                this._isDnd ?
                this._config.colorEmptyDnd :
                this._config.colorEmpty
            );

            const backgroundColor = isNotEmpty ? (
                this._isDnd ?
                this._config.colorNotEmptyDnd :
                this._config.colorNotEmpty
            ) : 'transparent';

            const textColor = isNotEmpty ? (
                this._isDnd ?
                this._config.textColorDnd :
                this._config.textColor
            ) : 'transparent';

            // use predefined values for now
            const padding = isShort ? 0 : 3;
            const borderSize = isNotEmpty ? 0 : 2;

            this._counter.style = (
                `font-size: ${this._config.fontSize}px;` +
                `font-weight: bold;` +
                `text-align: center;` +
                `padding: 0 ${padding}px;` +
                `border: ${borderSize}px solid ${borderColor};` +
                `border-radius: ${this._config.roundness}px;` +
                `background-color: ${backgroundColor};` +
                `color: ${textColor};`
            );

            let height = this._counter.height;

            // do some kind of mathemagic
            height = height - borderSize * 4;

            this._counter.style += (
                `height: ${height}px;` +
                `min-width: ${height}px;`
            );
        }

        _isValid() {
            return this.mapped && this.get_stage() !== null;
        }

    }
);
