/* exported Config */

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Context from '../core/context.js';
import { Type } from '../core/enums.js';

const DUMMY_FIELD_PREFIX = '~';

/**
 * @typedef {string} settingsKey
 * @typedef {string|number|boolean} value
 * 
 * @param {*} client
 * @param {Object.<string, string> & {fieldName: settingsKey}} fields
 * @param {(settingsKey: string) => void} [callback]
 * @param {Object.<string, string|boolean>} [options]
 * @returns {Object.<string, string|number|boolean> & {fieldName: value}}
 */
export const Config = (client, fields, callback, options = { schemaId: null, isAfter: false }) => {
    if (!client || !fields) return null;
    const { schemaId, isAfter } = options ?? {};
    /** @type {Gio.Settings} */
    const settings = Context.getSettings(schemaId);
    /** @type {boolean} */
    const isDummyConfig = settings instanceof Gio.Settings === false;
    /** @type {Object.<string, string|number|boolean>} */
    const values = {};
    /** @type {Array<string|((...args) => void)>} */
    const signals = [];
    /** @type {Map<string, string>}*/
    const valueMapping = new Map();
    /** @type {(...args) => void} */
    const valueHandler = isDummyConfig ? null : (_, key) => {
        values[valueMapping.get(key)] = settings.get_value(key)?.unpack();
        if (typeof callback === Type.Function) callback(key);
    }
    for (const fieldName in fields) {
        const settingsKey = fields[fieldName];
        if (typeof settingsKey !== Type.String) continue;
        if (settingsKey.startsWith(DUMMY_FIELD_PREFIX)) {
            values[fieldName] = null;
            continue;
        }
        if (isDummyConfig) {
            values[fieldName] = settings[settingsKey] ?? null;
            continue;
        }
        values[fieldName] = settings.get_value(settingsKey)?.unpack() ?? null;
        valueMapping.set(settingsKey, fieldName);
        signals.push(`changed::${settingsKey}`, valueHandler);
        if (isAfter) signals.push(GObject.ConnectFlags.AFTER);
    }
    if (signals.length) Context.signals.add(client, [settings, ...signals]);
    return values;
};
