const { St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const Main = imports.ui.main;

var AppButtonMenu = class AppButtonMenu extends AppMenu {

    constructor(actor, app) {

        super(actor, St.Side.TOP, {
            favoritesSection: true,
            showSingleWindows: true,
        });

        this.blockSourceEvents = true;
        this.setApp(app);

        Main.uiGroup.add_actor(this.actor);
    }

    _updateFavoriteItem() {
        super._updateFavoriteItem();

        if (!this._toggleFavoriteItem.visible) {
            return;
        }

        if (!this._appFavorites.isFavorite(this._app.id)) {
            this._toggleFavoriteItem.label.text = _('Pin');
        }
    }

}