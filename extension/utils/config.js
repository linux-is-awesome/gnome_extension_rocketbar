/* exported Config */

import { Context } from '../core/context.js';
import { Type } from '../core/enums.js';

/**
 * @typedef {string} settingsKey
 * @typedef {string|number|boolean} value
 * 
 * @param {*} client
 * @param {Object.<string, string> & {fieldName: settingsKey}} fields
 * @param {(settingsKey: string) => void} [callback]
 * @returns {Object.<string, string|number|boolean> & {fieldName: value}}
 */
export const Config = (client, fields, callback) => {
    if (!client || !fields) return null;
    /** @type {Gio.Settings} */
    const settings = Context.settings;
    /** @type {Object.<string, string|number|boolean>} */
    const values = {};
    /** @type {Array<string|((...args) => void)>} */
    const signals = [];
    /** @type {Map<string, string>}*/
    const valueMapping = new Map();
    /** @type {(...args) => void} */
    const valueHandler = (_, key) => {
        values[valueMapping.get(key)] = settings.get_value(key)?.unpack();
        if (typeof callback === Type.Function) callback(key);
    }
    for (const fieldName in fields) {
        const settingsKey = fields[fieldName];
        if (typeof settingsKey !== Type.String) continue;
        valueMapping.set(settingsKey, fieldName);
        values[fieldName] = settings.get_value(settingsKey)?.unpack();
        signals.push(`changed::${settingsKey}`, valueHandler);
    }
    if (!signals.length) return values;
    Context.signals.add(client, [settings, ...signals]);
    return values;
};
