const { St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const Main = imports.ui.main;

var AppButtonMenu = class AppButtonMenu extends AppMenu {

    constructor(parent, app, settings) {

        super(parent, St.Side.TOP, {
            favoritesSection: true,
            showSingleWindows: true,
        });

        this._settings = settings;

        this.blockSourceEvents = true;

        this._setConfig();

        this.setApp(app);

        Main.uiGroup.add_actor(this.actor);
    }

    updateConfig() {
        const oldConfig = this._config;

        this._setConfig();

        if (oldConfig.isolateWorkspaces !== this._config.isolateWorkspaces) {
            this._updateWindowsSection();
        }
    }

    _setConfig() {
        this._config = {
            isolateWorkspaces: this._settings.get_boolean('taskbar-isolate-workspaces')
        };
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

}