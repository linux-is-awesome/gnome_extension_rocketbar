import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

export const SettingsPageTemplate = GObject.registerClass(
    class Rocketbar__SettingsPageTemplate extends Adw.PreferencesPage {

        _init(params) {
            super._init({
                title: params.title,
                name: params.name,
                icon_name: params.icon
            });
            this._settings = params.settings;
        }

        addGroup(title, options) {

            const newGroup = new Adw.PreferencesGroup({
                title: title
            });

            this.add(newGroup);

            options?.forEach(option => newGroup.add(option));

            return newGroup;
        }

        createSwitch(title, settingsKey, subtitle) {

            const newSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });

            newSwitch.set_active(this._settings.get_boolean(settingsKey));

            newSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean(settingsKey, widget.get_active());
            });

            const switchRow = new Adw.ActionRow({
                title: title,
                subtitle: subtitle ? subtitle : null,
                activatable_widget: newSwitch
            });

            switchRow.add_suffix(newSwitch);

            return switchRow;
        }

        createPicklist(title, settingsKey, options, subtitle) {

            let stringOptions = false;
            let values = [];
            let picklistOptions = new Gtk.StringList();

            options.forEach((option) => {

                if (!stringOptions) {
                    stringOptions = !Number.isInteger(option.value);
                }

                values.push(option.value);

                picklistOptions.append(option.label)
            });

            const selectedIndex = values.indexOf(
                stringOptions ?
                this._settings.get_string(settingsKey) :
                this._settings.get_int(settingsKey)
            );

            const picklistRow = new Adw.ComboRow({
                title: title,
                subtitle: subtitle ? subtitle : null,
                model: picklistOptions,
                selected: selectedIndex >= 0 ? selectedIndex : 0
            });

            picklistRow.connect("notify::selected", (widget) => {

                const value = values[widget.selected];

                if (stringOptions) {
                    this._settings.set_string(settingsKey, value);
                    return;
                }
                
                this._settings.set_int(settingsKey, value);
            });

            return picklistRow;
        }

        createSpinButton(title, settingsKey, params, subtitle) {

            const spinButton = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: params.min || 0,
                    upper: params.max || 0,
                    step_increment: params.step || 1
                }),
                climb_rate: 1,
                digits: 0,
                numeric: true,
                valign: Gtk.Align.CENTER
            });

            spinButton.set_value(this._settings.get_int(settingsKey));

            spinButton.connect('value-changed', (widget) => {

                if (spinButton._changeTimeout) {
                    GLib.source_remove(spinButton._changeTimeout);
                }

                spinButton._changeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                    this._settings.set_int(settingsKey, widget.get_value());
                    spinButton._changeTimeout = null;
                    return GLib.SOURCE_REMOVE;
                });

            });

            const spinButtonRow = new Adw.ActionRow({
                title: title,
                subtitle: subtitle ? subtitle : null,
                activatable_widget: spinButton
            });

            spinButtonRow.add_suffix(spinButton);

            return spinButtonRow;
        }

        createSlider(title, settingsKey, params, subtitle) {
        
            const slider = new Gtk.Scale({
                adjustment: new Gtk.Adjustment({
                    lower: params.min || 0,
                    upper: params.max || 1,
                    step_increment: params.step || 1
                }),
                digits: 0,
                hexpand: true,
                draw_value: true,
                value_pos: (
                    params.marks && params.marks.length ?
                    Gtk.PositionType.BOTTOM :
                    Gtk.PositionType.RIGHT
                ),
                valign: Gtk.Align.CENTER
            });

            if (params.marks) {
                params.marks.forEach(mark => slider.add_mark(mark, Gtk.PositionType.TOP, mark.toString()));
            }

            slider.width_request = 200;

            slider.set_value(this._settings.get_int(settingsKey));

            slider.connect('value-changed', (widget) => {

                if (slider._changeTimeout) {
                    GLib.source_remove(slider._changeTimeout);
                }

                slider._changeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                    this._settings.set_int(settingsKey, widget.get_value());
                    slider._changeTimeout = null;
                    return GLib.SOURCE_REMOVE;
                });

            });

            const sliderRow = new Adw.ActionRow({
                title: title,
                subtitle: subtitle ? subtitle : null,
                activatable_widget: slider
            });

            sliderRow.add_suffix(slider);

            return sliderRow;
        }

        createColorButton(title, settingsKey, subtitle) {

            const color = new Gdk.RGBA();
            color.parse(this._settings.get_string(settingsKey));

            const colorButton = new Gtk.ColorButton({
                rgba: color,
                use_alpha: true,
                valign: Gtk.Align.CENTER
            });
    
            colorButton.connect('color-set', (widget) => {
                this._settings.set_string(settingsKey, widget.get_rgba().to_string());
            });
    
            const colorButtonRow = new Adw.ActionRow({
                title: title,
                subtitle: subtitle ? subtitle : null,
                activatable_widget: colorButton
            });

            colorButtonRow.add_suffix(colorButton);

            return colorButtonRow;
        }

        createLink(title, url) {

            const link = new Gtk.LinkButton({
                uri: url,
                opacity: 0
            });

            const linkRow = new Adw.ActionRow({
                title: title,
                activatable_widget: link
            });

            linkRow.add_suffix(link);

            return linkRow;
        }

        createLabel(title, text) {

            const label = new Gtk.Label({
                label: text
            });

            const labelRow = new Adw.ActionRow({
                title: title
            });

            labelRow.add_suffix(label);

            return labelRow;
        }

        createMessage(text) {
            return new Gtk.Label({
                label: `<span size="larger"><b>${text}</b></span>`,
                use_markup: true,
                vexpand: true,
                valign: Gtk.Align.FILL
            });
        }

        addVisibilityControl(widgets = [], settingsKeys = {}, callback) {

            if (!settingsKeys || !widgets.length) {
                return widgets;
            }

            const updateVisibility = () => {

                let visibilityState = false;

                for (let settingsKey in settingsKeys) {

                    const keyHandler = settingsKeys[settingsKey];

                    if (!keyHandler) {
                        continue;
                    }

                    let value = this._settings.get_value(settingsKey);

                    // only boolean and string values are supported for now
                    switch (value.get_type_string()) {
                        case 'b':
                            value = this._settings.get_boolean(settingsKey);
                            break; 
                        case 's':
                            value = this._settings.get_string(settingsKey);
                            break;
                        case 'i':
                            value = this._settings.get_int(settingsKey);
                            break;
                    }

                    if (keyHandler(value)) {
                        visibilityState = true;
                        break;
                    }
                }

                widgets.forEach(widget => {

                    widget.visible = visibilityState

                    if (callback) {
                        callback(widget);
                    }

                });

                if (callback) {
                    callback();
                }
            };

            updateVisibility();

            for (let settingsKey in settingsKeys) {
                this._settings.connect(`changed::${settingsKey}`, updateVisibility);
            }

            return widgets;
        }

    }
);
