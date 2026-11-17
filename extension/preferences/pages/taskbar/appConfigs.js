/**
 * @typedef {import('gi://Gio').AppInfo} Gio.AppInfo
 * @typedef {import('gi://Adw').ActionRow} Adw.ActionRow
 */

import Gtk from 'gi://Gtk';
import Context from '../../core/context.js';
import AppSettingsPage from '../base/appSettingsPage.js';
import { Event, Delay, PreferencesPage } from '../../../shared/enums/general.js';

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

export default class extends AppSettingsPage {

    /** @type {Adw.ActionRow[]} */
    #appRows = [];

    /** @type {string} */
    #searchString = '';

    constructor() {
        super(PreferencesPage.TaskbarAppConfigs, () => this.#initialize());
    }

    #initialize() {
        const defaultPageGroup = this.getGroup(Widget.NotCustomizedAppsGroup);
        defaultPageGroup.remove(this.getWidget(Widget.AppRowTemplate));
        Context.jobs.new(this, Delay.Background).destroy(() => this.#loadApps());
    }

    #loadApps() {
        try {
            const apps = [...this.appsById.values()]
                .filter(app => !!app.get_display_name())
                .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));
            if (!apps.length) return this.#showEmptyMessage();
            const search = this.getSearchEntry(Widget.Search);
            const searchContainer = this.getWidget(Widget.SearchContainer);
            for (const app of apps) this.#appRows.push(this.#createAppRow(app));
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
        this.setAppIcon(appRowIcon, app);
        defaultGroup.remove(appRow);
        appRow.connect(Event.Activated, () => (
        this.getAppConfig(appId, () => this.#enqueueUpdateAppGroups()),
        Context.navigateToPage(PreferencesPage.TaskbarAppConfig, { appId })));
        return appRow;
    }

    /**
     * @param {string?} appName
     */
    #search(appName) {
        if (!this.#appRows.length) return;
        this.#searchString = appName?.trim()?.toLowerCase() ?? '';
        this.#enqueueUpdateAppGroups();
    }

    #enqueueUpdateAppGroups() {
        Context.jobs.replace(this, Delay.Queue).destroy(() => this.#updateAppGroups());
    }

    #updateAppGroups() {
        if (!this.#appRows.length) return;
        const defaultAppsGroup = this.getGroup(Widget.NotCustomizedAppsGroup);
        const customizedAppsGroup = this.getGroup(Widget.CustomizedAppsGroup);
        this.#resetAppGroups();
        /** @type {Map<*, boolean>} */
        const groupResults = new Map();
        for (const appRow of this.#appRows) {
            const appId = appRow.get_name();
            if (!appId) continue;
            const app = this.appsById.get(appId);
            const hasConfigOverride = this.hasOverride(appId);
            const group = hasConfigOverride ? customizedAppsGroup : defaultAppsGroup;
            const isVisible = this.#searchString ?
                              appRow.get_title().toLowerCase().includes(this.#searchString) :
                              hasConfigOverride || !!app?.should_show();
            appRow.set_visible(isVisible);
            group.add(appRow);
            if (!isVisible) continue;
            groupResults.set(group, isVisible);
        }
        defaultAppsGroup.set_visible(groupResults.get(defaultAppsGroup) ?? false);
        customizedAppsGroup.set_visible(groupResults.get(customizedAppsGroup) ?? false);
        if (!groupResults.size) this.#showEmptyMessage();
        else this.#showApps();
    }

    #resetAppGroups() {
        for (const appRow of this.#appRows) {
            const parent = appRow.get_parent();
            if (parent instanceof Gtk.ListBox === false) continue;
            parent.remove(appRow);
        }
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
