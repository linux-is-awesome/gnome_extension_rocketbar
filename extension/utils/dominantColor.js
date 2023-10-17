/* exported DominantColor */

import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import { Context } from '../core/context.js';
import { Type } from '../core/enums.js';

const SAMPLE_SIZE = 20;
const RGB_STRING_SPLITTER = ',';

/**
 * Note: IconTheme.load_icon function is used for Gnome Shell versions prior to 44.
 * 
 * TODO: stop using IconTheme.load_icon function. 
 * 
 * @param {Gio.Icon} icon
 * @returns {GdkPixbuf.Pixbuf|null}
 */
const Pixbuf = (icon) => {
    if (icon instanceof Gio.Icon === false) return null;
    if (typeof icon.get_file === Type.Function) return GdkPixbuf.Pixbuf.new_from_file(icon.get_file().get_path());
    if (typeof icon.get_names !== Type.Function) return null;
    const iconNames = icon.get_names();
    if (!iconNames.length) return null;
    const iconName = iconNames[0];
    const iconTheme = Context.iconTheme;
    if (!iconTheme.has_icon(iconName)) return null;
    if (typeof iconTheme.load_icon === Type.Function) return iconTheme.load_icon(iconName, SAMPLE_SIZE, 0);
    const iconInfo = iconTheme.lookup_icon(iconName, null, SAMPLE_SIZE, 1, 1, 1);
    return GdkPixbuf.Pixbuf.new_from_file(iconInfo.get_file().get_path());
}

/**
 * Downsample large icons before scanning for the backlight color to improve performance.
 *
 * @param {GdkPixbuf.Pixbuf} pixbuf
 * @returns {number[]}
 */
const Pixels = (pixbuf) => {
    const pixels = pixbuf.get_pixels();
    const width = pixbuf.get_width();
    const height = pixbuf.get_height();
    let resampleY = 1;
    let resampleX = 1;
    if (height >= 2 * SAMPLE_SIZE) {
        resampleY = ~~(height / SAMPLE_SIZE);
    }
    if (width >= 2 * SAMPLE_SIZE) {
        resampleX = ~~(width / SAMPLE_SIZE);
    }
    if (resampleX === 1 && resampleY === 1) return pixels;
    const resampledPixels = [];
    const limit = pixels.length / (resampleX * resampleY) / 4;
    for (let i = 0; i < limit; ++i) {
        const pixel = i * resampleX * resampleY * 4;
        resampledPixels.push(pixels[pixel]);
        resampledPixels.push(pixels[pixel + 1]);
        resampledPixels.push(pixels[pixel + 2]);
        resampledPixels.push(pixels[pixel + 3]);
    }
    return resampledPixels;
};

/**
 * Convert rgb ([0-255, 0-255, 0-255]) to hsv ([0-1, 0-1, 0-1]).
 * Following algorithm in https://en.wikipedia.org/wiki/HSL_and_HSV
 * here with h = [0,1] instead of [0, 360].
 * 
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {[h: number, s: number, v: number]}
 */
const HSV = (r, g, b) => {
    const M = Math.max(r, g, b);
    const m = Math.min(r, g, b);
    const c = M - m;
    let h, s, v;
    if (c === 0) {
        h = 0;
    } else if (M === r) {
        h = ((g - b) / c) % 6;
    } else if (M === g) {
        h = (b - r) / c + 2;
    } else {
        h = (r - g) / c + 4;
    }
    h = h / 6;
    v = M / 255;
    s = M === 0 ? 0 : c / M;
    return [h, s, v];
};

/**
 * Convert hsv ([0-1, 0-1, 0-1]) to rgb ([0-255, 0-255, 0-255]).
 * Following algorithm in https://en.wikipedia.org/wiki/HSL_and_HSV
 * here with h = [0,1] instead of [0, 360].
 * 
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @returns {[r: number, g: number, b: number]}
 */
const RGB = (h, s, v) => {
    const c = v * s;
    const h1 = h * 6;
    const x = c * (1 - Math.abs(h1 % 2 - 1));
    const m = v - c;
    let r, g, b;
    if (h1 <= 1) {
        r = c + m, g = x + m, b = m;
    } else if (h1 <= 2) {
        r = x + m, g = c + m, b = m;
    } else if (h1 <= 3) {
        r = m, g = c + m, b = x + m;
    } else if (h1 <= 4) {
        r = m, g = x + m, b = c + m;
    } else if (h1 <= 5) {
        r = x + m, g = m, b = c + m;
    } else {
        r = c + m, g = m, b = x + m;
    }
    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    return [r, g, b];
};

/**
 * Credit: Dash to Dock https://github.com/micheleg/dash-to-dock
 * The backlight color choosing algorithm was mostly ported to javascript from the Unity7 C++ source of Canonicals:
 * https://bazaar.launchpad.net/~unity-team/unity/trunk/view/head:/launcher/LauncherIcon.cpp
 * 
 * @param {Gio.Icon} icon
 * @returns {string} `rgb(0-255, 0-255, 0-255)`
 */
export const DominantColor = (icon) => {
    if (icon instanceof Gio.Icon === false) return null;
    const pixbuf = Pixbuf(icon);
    if (!pixbuf) return null;
    const pixels = Pixels(pixbuf);
    let total = 0;
    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;
    for (let i = 0, l = pixels.length; i < l; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        const relevance  = 0.1 * 255 * 255 + 0.9 * a * saturation;
        rTotal += r * relevance;
        gTotal += g * relevance;
        bTotal += b * relevance;
        total += relevance;
    }
    total = total * 255;
    const r = rTotal / total * 255;
    const g = gTotal / total * 255;
    const b = bTotal / total * 255;
    let [h, s, v] = HSV(r, g, b);
    if (s > 0.15) {
        s = 0.65;
    }
    v = 0.90;
    return `rgb(${RGB(h, s, v).join(RGB_STRING_SPLITTER)})`;
};
