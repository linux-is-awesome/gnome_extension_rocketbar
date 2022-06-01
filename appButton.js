//#region imports

const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;

//#endregion imports

var AppButton = GObject.registerClass(
    class AppButton extends St.Button {

        _init(app, isFavorite, settings, eventHandler) {

            // init the button
            super._init({
                reactive: true,
                can_focus: true,
                track_hover: true,
                button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO
            });

            // set public properties
            this.app = app;

            // set private properties
            this._isFavorite = isFavorite;
            this._settings = settings;
            this._eventHandler = eventHandler;

            this._createLayout();

            this._updateIcon();
        }

        _createLayout() {

            this._appIcon = new St.Bin({
                reactive: true,
                can_focus: true,
                track_hover: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL
            });

            this.bind_property('hover', this._appIcon, 'hover', GObject.BindingFlags.SYNC_CREATE);

            const container = new St.BoxLayout({
                vertical: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL,
            });

            container.add_child(this._appIcon);

            const layout = new Clutter.Actor({
                layout_manager: new Clutter.BinLayout(),
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL,
            });

            layout.add_actor(container);

            this.set_child(layout);
        }

        _updateIcon() {
            let iconSize = 20; // TODO: config

            this._appIcon.set_child(this.app.create_icon_texture(iconSize));
        }
    }
);