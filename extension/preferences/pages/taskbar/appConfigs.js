import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Context from '../../core/context.js';
import SettingsPage from '../base/settingsPage.js';
import { AppConfig } from '../../../shared/utils/taskbar/appConfig.js';
import { Event, Delay, PreferencesPage } from '../../../shared/enums/general.js';
import { ConfigOptions } from '../../../shared/enums/taskbar.js';

const DEFAULT_APP_ICON_NAME = 'application-x-executable';

/** @enum {string} */
const Widget = {
    Search: 'search',
    SearchContainer: 'search-container',
    PageStack: 'page-stack',
    LoadingSpinner: 'loading-spinner',
    CustomizedAppsGroup: 'customized-apps-group',
    NotCustomizedAppsGroup: 'not-customized-apps-group',
    AppRowTemplate: 'app-row-template',
    AppIcon: 'app-icon',
    EmptyMessage: 'empty-message'
};

export default class extends SettingsPage {

    /** @type {Adw.ActionRow[]} */
    #appRows = [];

    /** @type {AppConfig} */
    #appConfig = new AppConfig();

    /** @type {string} */
    #searchString = '';

    constructor() {
        super(PreferencesPage.TaskbarAppConfigs, () => this.#initialize(), ConfigOptions.path);
    }

    #initialize() {
        const defaultPageGroup = this.getGroup(Widget.NotCustomizedAppsGroup);
        defaultPageGroup.remove(this.getWidget(Widget.AppRowTemplate));
        Context.jobs.new(this, Delay.Background).destroy(() => this.#loadApps());
    }

    #loadApps() {
        try {
            const apps = Gio.AppInfo.get_all();
            const sortedApps = apps.filter(app => app.should_show() && !!app.get_display_name() && !!app.get_id())
                                   .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));
            if (!sortedApps.length) return this.#showEmptyMessage();
            const search = this.getSearchEntry(Widget.Search);
            const searchContainer = this.getWidget(Widget.SearchContainer);
            for (const app of sortedApps) this.#appRows.push(this.#createAppRow(app));
            search.connect(Event.Changed, () => this.#search(search.get_text()));
            searchContainer.set_visible(true);
            this.#updateAppGroups();
        } catch (e) {
            Context.logError('failed to load apps', e);
            this.#showEmptyMessage();
        } finally {
            this.getSpinner(Widget.LoadingSpinner).stop();
        }
    }

    /**
     * @param {Gio.AppInfo} app
     * @returns {Adw.ActionRow}
     */
    #createAppRow(app) {
        const template = this.cloneTemplate();
        const defaultGroup = template.getGroup(Widget.NotCustomizedAppsGroup);
        const appRow = template.getActionRow(Widget.AppRowTemplate);
        const appRowIcon = template.getImage(Widget.AppIcon);
        const appId = app.get_id() ?? '';
        appRow.set_name(appId);
        appRow.set_title(app.get_display_name());
        const appIcon = app.get_icon();
        if (appIcon) appRowIcon.set_from_gicon(appIcon);
        else appRowIcon.set_from_icon_name(DEFAULT_APP_ICON_NAME);
        defaultGroup.remove(appRow);
        appRow.connect(Event.Activated, () =>
        Context.navigateToPage(PreferencesPage.TaskbarAppConfig, { appId }));
        return appRow;
    }

    /**
     * @param {string?} appName
     */
    #search(appName) {
        if (!this.#appRows.length) return;
        this.#searchString = appName?.trim()?.toLowerCase() ?? '';
        this.#updateAppGroups();
    }

    #updateAppGroups() {
        const defaultAppsGroup = this.getGroup(Widget.NotCustomizedAppsGroup);
        const customizedAppsGroup = this.getGroup(Widget.CustomizedAppsGroup);
        /** @type {Map<*, boolean>} */
        const groupResults = new Map();
        for (const appRow of this.#appRows) {
            const appId = appRow.get_name();
            if (!appId) continue;
            const hasConfigOverride = this.#appConfig.hasOverride(appId);
            const group = hasConfigOverride ? customizedAppsGroup : defaultAppsGroup;
            const isVisible = !this.#searchString ||
                              appRow.get_title().toLowerCase().includes(this.#searchString);
            appRow.set_visible(isVisible);
            this.#setAppRowParent(appRow, group);
            if (!isVisible) continue;
            groupResults.set(group, isVisible);
        }
        defaultAppsGroup.set_visible(groupResults.get(defaultAppsGroup) ?? false);
        customizedAppsGroup.set_visible(groupResults.get(customizedAppsGroup) ?? false);
        if (!groupResults.size) this.#showEmptyMessage();
        else this.#showApps();
    }

    /**
     * @param {Adw.ActionRow} row
     * @param {Adw.PreferencesGroup} parent
     */
    #setAppRowParent(row, parent) {
        const oldParent = row.get_parent();
        const isUnsupportedParent = !!oldParent && oldParent instanceof Adw.PreferencesGroup === false;
        if (isUnsupportedParent || oldParent === parent) return;
        if (oldParent) oldParent.remove(row);
        parent.add(row);
    }

    #showApps() {
        const pageStack = this.getStack(Widget.PageStack);
        pageStack.set_visible_child(this.instance);
    }

    #showEmptyMessage() {
        const pageStack = this.getStack(Widget.PageStack);
        pageStack.set_visible_child(this.getWidget(Widget.EmptyMessage));
    }

}
