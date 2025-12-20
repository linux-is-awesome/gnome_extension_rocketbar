/**
 * @typedef {import('gi://Adw').PreferencesWindow} Adw.PreferencesWindow
 * @typedef {import('resource:///org/gnome/shell/dbusServices/extensions/extensionPrefsDialog.js').ExtensionPrefsDialog} ExtensionPrefsDialog
 * @typedef {Adw.PreferencesWindow & ExtensionPrefsDialog} PreferencesWindow
 * @typedef {import('resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js').ExtensionPreferences} Extension
 */

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import SharedContext from '../../shared/core/context.js';
import BasePage from '../pages/base/page.js';
import { PreferencesPage } from '../../shared/enums/general.js';

const DEFAULT_WINDOW_WIDTH = 600;
const DEFAULT_WINDOW_HEGIHT = 800;
const WINDOW_SIZE_THRESHOLD = 0.9;

const PAGE_ROOT_PATH = '../pages/';
const PAGE_FILE_TYPE = '.js';
const STYLES_PATH = '/assets/css/preferences.css';

export default class Context extends SharedContext {

    /** @type {Context?} store another context instance in this class to optimize the call path */
    static #instance = null;

    /**
     * @override
     * @type {Context}
     */
    static get instance() {
        if (!this.#instance) throw new Error(`${this.name} has no instance.`);
        return this.#instance;
    }

    /**
     * @param {PreferencesPage} targetPage
     */
    static navigateToPage(targetPage) {
        this.instance.#navigateToPage(targetPage);
    }

    /** @type {PreferencesWindow?} */
    #window = null;

    /** @type {Map<PreferencesPage, Promise|BasePage>} */
    #pages = new Map();

    /**
     * @param {Extension} extension
     * @param {PreferencesWindow} window
     */
    constructor(extension, window) {
        super(extension, () => this.#destroy());
        this.#window = window;
        Context.#instance = this;
    }

    /**
     * @returns {Promise<this>}
     */
    async initialize() {
        if (!this.#window) return this;
        this.#window.set_search_enabled(true);
        this.#setWindowSize(this.#window);
        this.#loadStyles();
        await this.#loadPages();
        return this;
    }

    /**
     * @override
     */
    destroy() {
        super.destroy();
        Context.#instance = null;
    }

    /**
     * @returns {boolean}
     */
    #destroy() {
        this.#pages.clear();
        this.#window = null;
        return true;
    }

    /**
     * @param {PreferencesWindow} window
     */
    #setWindowSize(window) {
        const display = Gdk.Display.get_default();
        const primaryMonitor = display?.get_monitors().get_item(0);
        if (primaryMonitor instanceof Gdk.Monitor === false) return;
        const monitorSize = primaryMonitor.get_geometry();
        const scale = primaryMonitor.get_scale();
        const maxHeight = (monitorSize.height / scale) * WINDOW_SIZE_THRESHOLD;
        const maxWidth = (monitorSize.width / scale) * WINDOW_SIZE_THRESHOLD;
        const windowHeight = Math.min(maxHeight, DEFAULT_WINDOW_HEGIHT);
        const windowWidth = Math.min(maxWidth, DEFAULT_WINDOW_WIDTH);
        window.set_default_size(windowWidth, windowHeight);
    }

    #loadStyles() {
        try {
            const display = Gdk.Display.get_default();
            const provider = new Gtk.CssProvider();
            const priority = Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION;
            provider.load_from_path(`${Context.path}${STYLES_PATH}`);
            Gtk.StyleContext.add_provider_for_display(display, provider, priority);
        } catch (e) {
            Context.logError('unable to load styles.', e);
        }
    }

    async #loadPages() {
        if (!this.#window) return;
        const pages = Object.values(PreferencesPage);
        for (const page of pages) this.#pages.set(page, this.#loadPage(page));
        await Promise.all([...this.#pages.values()]);
        for (const [_, page] of this.#pages) {
            if (page instanceof BasePage === false) continue;
            page.setParent(this.#window);
        }
    }

    /**
     * @param {PreferencesPage} page
     */
    async #loadPage(page) {
        try {
            const pageModule = await import(`${PAGE_ROOT_PATH}${page}${PAGE_FILE_TYPE}`);
            if (!this.#window) return;
            this.#pages.set(page, new pageModule.default());
        } catch (e) {
            Context.logError(`unable to load page: ${page}.`, e);
            this.#pages.delete(page);
        }
    }

    /**
     * @param {PreferencesPage} targetPage
     */
    #navigateToPage(targetPage) {
        if (!this.#window) return;
        const page = this.#pages.get(targetPage);
        if (page instanceof BasePage === false) return;
        page.show(this.#window);
    }

}
