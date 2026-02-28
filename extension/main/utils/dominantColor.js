import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import Context from '../core/context.js';

const SAMPLE_SIZE = 20;
const RGB_STRING_SPLITTER = ',';

/**
 * @param {Gio.Icon} icon
 * @param {number} sampleSize
 * @returns {GdkPixbuf.Pixbuf?}
 */
const Pixbuf = (icon, sampleSize) => {
    try {
        if (icon instanceof Gio.FileIcon) {
            return GdkPixbuf.Pixbuf.new_from_file(icon.get_file().get_path() ?? '');
        }
        if (icon instanceof Gio.ThemedIcon) {
            return Context.desktop.iconTheme.lookup_by_gicon(icon, sampleSize, 0)?.load_icon() ?? null;
        }
    } catch (e) {
        Context.logError(`${Pixbuf.name} loading failed.`, e);
    }
    return null;
};

/**
 * Note: Converts rgb ([0-255, 0-255, 0-255]) to hsv ([0-1, 0-1, 0-1]).
 *       Following algorithm in https://en.wikipedia.org/wiki/HSL_and_HSV here with h = [0,1] instead of [0, 360].
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
    h /= 6;
    v = M / 255;
    s = M === 0 ? 0 : c / M;
    return [h, s, v];
};

/**
 * Note: Converts hsv ([0-1, 0-1, 0-1]) to rgb ([0-255, 0-255, 0-255]).
 *       Following algorithm in https://en.wikipedia.org/wiki/HSL_and_HSV here with h = [0,1] instead of [0, 360].
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
        [r, g, b] = [c + m, x + m, m];
    } else if (h1 <= 2) {
        [r, g, b] = [x + m, c + m, m];
    } else if (h1 <= 3) {
        [r, g, b] = [m, c + m, x + m];
    } else if (h1 <= 4) {
        [r, g, b] = [m, x + m, c + m];
    } else if (h1 <= 5) {
        [r, g, b] = [x + m, m, c + m];
    } else {
        [r, g, b] = [c + m, m, x + m];
    }
    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    return [r, g, b];
};

/**
 * Credit: Dash to Dock https://github.com/micheleg/dash-to-dock
 *
 * Note: The backlight color choosing algorithm was mostly ported to javascript from the Unity7 C++ source of Canonicals:
 *       https://bazaar.launchpad.net/~unity-team/unity/trunk/view/head:/launcher/LauncherIcon.cpp
 *
 * @param {Gio.Icon?} icon
 * @param {number} [sampleSize]
 * @returns {string?} `rgb(0-255, 0-255, 0-255)`
 */
export const DominantColor = (icon, sampleSize = SAMPLE_SIZE) => {
    if (icon instanceof Gio.Icon === false) return null;
    const pixbuf = Pixbuf(icon, sampleSize);
    if (!pixbuf) return null;
    const pixels = pixbuf.get_pixels();
    const width = pixbuf.get_width();
    const height = pixbuf.get_height();
    const resampleY = height >= 2 * sampleSize ? ~~(height / sampleSize) : 1;
    const resampleX = width >= 2 * sampleSize ? ~~(width / sampleSize) : 1;
    const step = resampleX * resampleY * 4;
    let total = 0;
    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;
    for (let i = 0, l = pixels.length; i < l; i += step) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        const relevance = 0.1 * 255 * 255 + 0.9 * a * saturation;
        rTotal += r * relevance;
        gTotal += g * relevance;
        bTotal += b * relevance;
        total += relevance;
    }
    total *= 255;
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
