/**
 * @typedef {import('gi://Gio').Settings} Gio.Settings
 */

export default class Settings {

    /** @type {Gio.Settings?} */
    #source = null;

    /** @type {Gio.Settings?} */
    get source() {
        return this.#source;
    }

    /**
     * @param {Gio.Settings} source
     */
    constructor(source) {
        this.#source = source;
    }

    /**
     * @param {string} settingsKey
     * @returns {*}
     */
    get(settingsKey) {
        return this.#source?.get_value(settingsKey)?.unpack() ?? null;
    }

    /**
     * @param {string} settingsKey
     * @param {*} value
     */
    set(settingsKey, value) {
        if (!this.#source) return;
        value ??= null;
        if (value === null) return;
        if (typeof value === 'number') this.#source.set_int(settingsKey, value);
        else if (typeof value === 'boolean') this.#source.set_boolean(settingsKey, value);
        else if (typeof value === 'string') this.#source.set_string(settingsKey, value);
        else this.#source.set_string(settingsKey, JSON.stringify(value));
    }

}
