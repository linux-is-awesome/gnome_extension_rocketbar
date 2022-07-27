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

    _setNotificationCounter() {

        if (this._container || !this._dateMenu || !this._dateMenu._clockDisplay) {
            return;
        }

        this._connections = new Connections();

        // hide the indicator and prevent it from displaying
        // also handle Do not disturb state
        this._connections.add(this._dateMenu._indicator, 'notify::visible', indicator => indicator.hide());
        this._connections.add(this._dateMenu._indicator?._settings, 'changed::show-banners', () => this._handleDndState());
        this._dateMenu._indicator?.hide();

        // remember the class of the clock display
        this._clockDisplayStyleClass = this._dateMenu._clockDisplay?.style_class;

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
        this._container = new St.BoxLayout({ style_class: this._clockDisplayStyleClass });

        // create a spacer to display between the clock display and the counter
        const spacer = new St.Label({ text: '  ' });
        // the spacer visibility should be controlled by the counter visibility
        this._notificationCounter.bind_property('visible', spacer, 'visible', GObject.BindingFlags.SYNC_CREATE);

        // add items to the container
        this._container.add_child(Main.panel.statusArea.dateMenu._clockDisplay);
        this._container.add_child(spacer);
        this._container.add_child(this._notificationCounter);

        // remove a css class from the clock display
        // don't want it to look like a button anymore
        this._dateMenu._clockDisplay.style_class = null;

        dateMenuContainer.add_child(this._container);
    }

    _handleDndState() {

        if (!this._dndCallback) {
            return;
        }

        const dndState = this._dateMenu._indicator?._settings?.get_boolean('show-banners');

        this._dndCallback(dndState);
    }

    _removeNotificationCounter() {

        this._initTimeout?.destroy();

        this._connections?.destroy();

        // restore the indicator
        this._dateMenu._indicator?._sync();

        if (!this._container || !this._dateMenu || !this._dateMenu._clockDisplay) {
            return;
        }       

        // remove children we don't want to destroy from the container
        // before destroying the container itself
        this._container.remove_child(this._dateMenu._clockDisplay);
        this._container.remove_child(this._notificationCounter);

        this._container.destroy();

        const dateMenuContainer = this._dateMenu.get_children()[0];

        if (!dateMenuContainer) {
            return;
        }

        // restore the original css class for the clock display
        this._dateMenu._clockDisplay.style_class = this._clockDisplayStyleClass;

        // add the clock display into the original container
        dateMenuContainer.insert_child_at_index(this._dateMenu._clockDisplay, 1);       
    }

}

var NotificationCounter = GObject.registerClass(
    class Rocketbar__NotificationCounter extends St.Bin {

        _init() {

            super._init({ y_align: Clutter.ActorAlign.CENTER });

            this._count = 0;
            this._isDnd = false;

            this._createCounter();

            this._setConfig();

            this._createConnections();

            this._notificationHandler = new NotificationHandler(count => this._setCount(count), null);

            this._container = new NotificationCounterContainer(this);
        }

        _createCounter() {

            this._counter = new St.Label({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                text: '0',
                opacity: 0
            });

            this._counter.set_pivot_point(0.5, 0.5);

            this.set_child(this._counter);
        }

        _createConnections() {

            this.connect('destroy', () => this._destroy());

            this._counter.connect('notify::mapped', () => {
                this._updateStyle();
                this._update();
            });
        }

        _setConfig() {
            this._config = {
                fontSize: 10,
                maxCount: 999
            };
        }

        _destroy() {
            this._notificationHandler?.destroy();
            this._container?.destroy();
        }

        _setCount(count) {

            if (this._count === count) {
                return;
            }

            this._count = count;

            this._update();
        }

        _update() {

            this._counter.remove_all_transitions();

            // add a fancy animation
            this._counter.ease({
                scale_x: 0,
                scale_y: 0,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                
                    // update the counter when it's hidden

                    this._counter.text = (
                        this._count > this._config.maxCount ?
                        this._config.maxCount.toString() :
                        this._count.toString()
                    );

                    this._updateStyle();

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

        _updateStyle() {

            if (!this.mapped || this.get_stage() === null) {
                return;
            }

            const padding = this._count > 9 ? 3 : 0;
            const borderSize = this._count > 0 ? 0 : 2;
            const backgroundColor = this._count > 0 ? 'white' : 'transparent';
            const textColor = this._count > 0 ? 'black' : 'transparent';

            this._counter.style = (
                `font-size: ${this._config.fontSize}px;` +
                `font-weight: bold;` +
                `text-align: center;` +
                `padding: 0 ${padding}px;` +
                `border: ${borderSize}px solid white;` +
                `background-color: ${backgroundColor};` +
                `color: ${textColor};`
            );

            let height = this._counter.height;

            // do some kind of mathemagic
            height = height - borderSize * 4;

            this._counter.style += (
                `height: ${height}px;` +
                `min-width: ${height}px;` +
                `border-radius: ${height}px;`
            );
        }

    }
);
