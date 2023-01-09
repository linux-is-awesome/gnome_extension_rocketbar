/* exported Config */

const Extension = imports.ui.extensionSystem.rocketbar;

const { GLib } = imports.gi;
const { Context } = Extension.imports.core.context;
const { Type } = Extension.imports.core.enums;

/**
 * @param {GLib.Variant} value 
 * @returns {string|number|boolean}
 */
const translateValue = (value) => ({
    s: () => value.get_string()?.toString()?.replace(/,[^,]+$/, ''),
    b: () => value.get_boolean(),
    i: () => value.get_int32()
})[value?.get_type_string()]?.call();

/**
 * @typedef {string} settingsKey
 * @typedef {string|number|boolean} value
 * 
 * @param {*} source
 * @param {Object.<string, string> & {fieldName: settingsKey}} fields
 * @param {(settingsKey: string) => void} [callback]
 * @returns {Object.<string, string|number|boolean> & {fieldName: value}}
 */
var Config = (source, fields, callback) => {
    if (!source || !fields) return null;
    /** @type {Gio.Settings} */
    const settings = Context.settings;
    /** @type {Object.<string, string|number|boolean>} */
    const values = {};
    /** @type {Array<string>} */
    const signals = [];
    /** @type {Map<string, string>}*/
    const valueMapping = new Map();
    for (const fieldName in fields) {
        const settingsKey = fields[fieldName];
        if (typeof settingsKey !== Type.String) continue;
        valueMapping.set(settingsKey, fieldName);
        values[fieldName] = translateValue(settings.get_value(settingsKey));
        signals.push(`changed::${settingsKey}`);
    }
    if (!signals.length) return values;
    Context.signals.add(source, [[settings, signals, (_, key) => {
        values[valueMapping.get(key)] = translateValue(settings.get_value(key));
        if (typeof callback === Type.Function) callback(key);
    }]]);
    return values;
};
