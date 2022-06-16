const { St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const Main = imports.ui.main;

var AppButtonMenu = class AppButtonMenu extends AppMenu {

    constructor(parent, app) {

        super(parent, St.Side.TOP, {
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

    _updateWindowsSection() {
        
        // show windows from the current workspace only
        // using a trick to avoid complete overriding of the method

        const workspaceIndex = global.workspace_manager.get_active_workspace_index();

        const originalApp = this._app;

        this._app = {
            get_windows: () => originalApp.get_windows().filter(window => window.get_workspace().index() === workspaceIndex),
            get_name: () => originalApp.get_name()
        };

        super._updateWindowsSection();

        this._app = originalApp;
    }

}