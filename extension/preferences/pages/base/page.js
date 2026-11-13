/**
 * @typedef {import('../../core/context.js').PreferencesWindow} PreferencesWindow
 */

import Adw from 'gi://Adw';
import PageTemplate from './pageTemplate.js';
import { Event } from '../../../shared/enums/general.js';

export default class Page extends PageTemplate {

    /** @type {Adw.PreferencesPage?} */
    #instance = null;

    /** @type {Adw.NavigationPage?} */
    #wrapper = null;

    /** @type {((isInitialized: boolean, params?: {[field: string]: *}) => boolean|void)?} */
    #callback = null;

    /** @type {boolean} */
    #isInitialized = false;

    /** @type {Adw.PreferencesPage} */
    get instance() {
        if (!this.#instance) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#instance;
    }

    /**
     * @param {string} name
     * @param {(isInitialized?: boolean, params?: {[field: string]: *}) => boolean|void} [callback]
     */
    constructor(name, callback) {
        super(name);
        let instance = this.getWidget(name);
        if (instance instanceof Adw.NavigationPage) {
            this.#wrapper = instance;
            instance = this.getWidget(`${name}-page`);
        }
        if (instance instanceof Adw.PreferencesPage === false) return;
        this.#instance = instance;
        this.#callback = callback ?? null;
    }

    /**
     * @param {PreferencesWindow} window
     */
    setParent(window) {
        if (!window || !this.#instance || this.#isInitialized || this.#wrapper) return;
        window.connect(Event.VisiblePageChanged, () => this.#initialize(window.get_visible_page()));
        window.add(this.#instance);
    }

    /**
     * @param {PreferencesWindow} window
     * @param {{[field: string]: *}} [params]
     */
    show(window, params) {
        if (!window || !this.#instance) return;
        if (!this.#wrapper) return window.set_visible_page(this.#instance);
        this.#initialize(this.#instance, params);
        window.push_subpage(this.#wrapper);
    }

    /**
     * @param {Adw.PreferencesPage?} visiblePage
     * @param {{[field: string]: *}} [params]
     */
    #initialize(visiblePage, params = {}) {
        if (visiblePage !== this.#instance) return;
        const isInitialized = this.#isInitialized;
        this.#isInitialized = true;
        if (typeof this.#callback !== 'function') return;
        const result = this.#callback(isInitialized, params) ?? true;
        if (!result) return;
        this.#callback = null;
    }

}
