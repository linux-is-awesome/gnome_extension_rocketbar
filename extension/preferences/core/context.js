/**
 * @typedef {import('gi://Adw').PreferencesWindow} Adw.PreferencesWindow
 * @typedef {import('resource:///org/gnome/shell/dbusServices/extensions/extensionPrefsDialog.js').ExtensionPrefsDialog} ExtensionPrefsDialog
 * @typedef {Adw.PreferencesWindow & ExtensionPrefsDialog} PreferencesWindow
 * @typedef {import('resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js').ExtensionPreferences} Extension
 */

import Gdk from 'gi://Gdk';
import SharedContext from '../../shared/core/context.js';
import BasePage from '../pages/base/page.js';

const DEFAULT_WINDOW_WIDTH = 700;
const DEFAULT_WINDOW_HEGIHT = 800;
const WINDOW_SIZE_THRESHOLD = 0.9;

const PAGE_ROOT_PATH = '../pages/';
const PAGE_FILE_TYPE = '.js';

/** @enum {string} */
const Page = {
    About: 'about',
    Misc: 'misc'
};

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

    /** @type {PreferencesWindow?} */
    #window = null;

    /** @type {Map<Page, Promise|BasePage>} */
    #pages = new Map();

    /**
     * @param {Extension} extension
     * @param {PreferencesWindow} window
     */
    constructor(extension, window) {
        super(extension, () => this.#destroy());
        this.#window = window;
        Context.#instance = this;
        this.#initialize();
    }

    /**
     * @override
     */
    destroy() {
        super.destroy();
        Context.#instance = null;
    }

    #destroy() {
        this.#pages.clear();
        this.#window = null;
        return true;
    }

    #initialize() {
        if (!this.#window) return;
        this.#window.set_search_enabled(true);
        this.#setWindowSize(this.#window);
        this.#loadPages();
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

    async #loadPages() {
        if (!this.#window) return;
        this.#window._showErrorPage = () => {};
        try {
            for (const page in Page) this.#pages.set(page, this.#loadPage(page));
            await Promise.all([...this.#pages.values()]);
            for (const [_, page] of this.#pages) {
                if (page instanceof BasePage === false) continue;
                page.setParent(this.#window);
            }
        } catch (e) {
            this.#window.constructor.prototype._showErrorPage.call(this.#window, e);
        }
    }

    /**
     * @param {Page} page
     */
    async #loadPage(page) {
        try {
            const pageModule = await import(`${PAGE_ROOT_PATH}${Page[page]}${PAGE_FILE_TYPE}`);
            this.#pages.set(page, new pageModule.default());
        } catch (e) {
            Context.logError(`unable to load page: ${page}.`, e);
            throw e;
        }
    }

}
