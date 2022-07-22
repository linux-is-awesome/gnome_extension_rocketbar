/* exported DominantColorExtractor */

const { Gio, St, Gtk, GdkPixbuf } = imports.gi;

const DOMINANT_COLOR_ICON_SIZE = 16;

/**
* Credit: Dash to Dock
* https://github.com/micheleg/dash-to-dock
*/
var DominantColorExtractor = class {

    constructor(icon) {
        this._icon = icon;
    }

    /**
     * The backlight color choosing algorithm was mostly ported to javascript from the
     * Unity7 C++ source of Canonicals:
     * https://bazaar.launchpad.net/~unity-team/unity/trunk/view/head:/launcher/LauncherIcon.cpp
     * so it more or less works the same way.
     */
    getColor() {
        let pixBuf = this._getIconPixBuf();

        if (pixBuf === null) {
            // return white color in edge cases
            return {
                r: 255,
                g: 255,
                b: 255
            };
        }

        let pixels = pixBuf.get_pixels();

        let total  = 0,
            rTotal = 0,
            gTotal = 0,
            bTotal = 0;

        let resample_y = 1,
            resample_x = 1;

        // Resampling of large icons
        // We resample icons larger than twice the desired size, as the resampling
        // to a size s
        // DOMINANT_COLOR_ICON_SIZE < s < 2*DOMINANT_COLOR_ICON_SIZE,
        // most of the case exactly DOMINANT_COLOR_ICON_SIZE as the icon size is tipycally
        // a multiple of it.
        let width = pixBuf.get_width();
        let height = pixBuf.get_height();

        // Resample
        if (height >= 2 * DOMINANT_COLOR_ICON_SIZE) {
            resample_y = Math.floor(height/DOMINANT_COLOR_ICON_SIZE);
        }

        if (width >= 2 * DOMINANT_COLOR_ICON_SIZE) {
            resample_x = Math.floor(width/DOMINANT_COLOR_ICON_SIZE);
        }

        if (resample_x !==1 || resample_y !== 1) {
            pixels = this._resamplePixels(pixels, resample_x, resample_y);
        }

        // computing the limit outside the for (where it would be repeated at each iteration)
        // for performance reasons
        let limit = pixels.length;

        for (let offset = 0; offset < limit; offset+=4) {
            let r = pixels[offset],
                g = pixels[offset + 1],
                b = pixels[offset + 2],
                a = pixels[offset + 3];

            let saturation = (Math.max(r, g, b) - Math.min(r, g, b));
            let relevance  = 0.1 * 255 * 255 + 0.9 * a * saturation;

            rTotal += r * relevance;
            gTotal += g * relevance;
            bTotal += b * relevance;

            total += relevance;
        }

        total = total * 255;

        let r = rTotal / total,
            g = gTotal / total,
            b = bTotal / total;

        let hsv = this._RGBtoHSV(r * 255, g * 255, b * 255);

        if (hsv.s > 0.15) {
            hsv.s = 0.65;
        }

        hsv.v = 0.90;

        return this._HSVtoRGB(hsv.h, hsv.s, hsv.v);
    }

    /**
     * Try to get the pixel buffer for the current icon, if not fail gracefully
     */
    _getIconPixBuf() {

        // Unable to load the icon texture, use fallback
        if (!this._icon || this._icon instanceof St.Icon === false) {
            return null;
        }

        const iconTexture = this._icon.get_gicon();

        // Unable to load the icon texture, use fallback
        if (iconTexture === null) {
            return null;
        }

        if (iconTexture instanceof Gio.FileIcon) {
            // Use GdkPixBuf to load the pixel buffer from the provided file path
            return GdkPixbuf.Pixbuf.new_from_file(iconTexture.get_file().get_path());
        }

        // for some applications iconTexture.get_gicon() returns St.ImageContent
        // it doesn have get_names function
        // for ex: Open Office
        // TODO: no solution as of now
        if (!iconTexture.get_names) {
            return null;
        }

        const iconTheme = new Gtk.IconTheme();
        iconTheme.set_custom_theme(St.Settings.get().gtkIconTheme);

        // Get the pixel buffer from the icon theme
        let icon_info = iconTheme.lookup_icon(iconTexture.get_names()[0], DOMINANT_COLOR_ICON_SIZE, 0);

        if (icon_info !== null) {
            return icon_info.load_icon();
        }
        
        return null;
    }

    /**
     * Downsample large icons before scanning for the backlight color to
     * improve performance.
     *
     * @param pixBuf
     * @param pixels
     * @param resampleX
     * @param resampleY
     *
     * @return [];
     */
    _resamplePixels (pixels, resampleX, resampleY) {
        let resampledPixels = [];

        // computing the limit outside the for (where it would be repeated at each iteration)
        // for performance reasons
        let limit = pixels.length / (resampleX * resampleY) / 4;

        for (let i = 0; i < limit; ++i) {
            let pixel = i * resampleX * resampleY;

            resampledPixels.push(pixels[pixel * 4]);
            resampledPixels.push(pixels[pixel * 4 + 1]);
            resampledPixels.push(pixels[pixel * 4 + 2]);
            resampledPixels.push(pixels[pixel * 4 + 3]);
        }

        return resampledPixels;
    }

    // Convert hsv ([0-1, 0-1, 0-1]) to rgb ([0-255, 0-255, 0-255]).
    // Following algorithm in https://en.wikipedia.org/wiki/HSL_and_HSV
    // here with h = [0,1] instead of [0, 360]
    // Accept either (h,s,v) independently or  {h:h, s:s, v:v} object.
    // Return {r:r, g:g, b:b} object.
    _HSVtoRGB(h, s, v) {

        if (arguments.length === 1) {
            s = h.s;
            v = h.v;
            h = h.h;
        }

        let r, g, b;
        let c = v * s;
        let h1 = h * 6;
        let x = c * (1 - Math.abs(h1 % 2 - 1));
        let m = v - c;

        if (h1 <=1) {
            r = c + m, g = x + m, b = m;
        } else if (h1 <=2) {
            r = x + m, g = c + m, b = m;
        } else if (h1 <=3) {
            r = m, g = c + m, b = x + m;
        } else if (h1 <=4) {
            r = m, g = x + m, b = c + m;
        } else if (h1 <=5) {
            r = x + m, g = m, b = c + m;
        } else {
            r = c + m, g = m, b = x + m;
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // Convert rgb ([0-255, 0-255, 0-255]) to hsv ([0-1, 0-1, 0-1]).
    // Following algorithm in https://en.wikipedia.org/wiki/HSL_and_HSV
    // here with h = [0,1] instead of [0, 360]
    // Accept either (r,g,b) independently or {r:r, g:g, b:b} object.
    // Return {h:h, s:s, v:v} object.
    _RGBtoHSV(r, g, b) {

        if (arguments.length === 1) {
            r = r.r;
            g = r.g;
            b = r.b;
        }

        let h, s, v;

        let M = Math.max(r, g, b);
        let m = Math.min(r, g, b);
        let c = M - m;

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

        if (M !== 0) {
            s = c / M;
        } else {
            s = 0;
        }

        return {
            h: h,
            s: s,
            v: v
        };
    }

};