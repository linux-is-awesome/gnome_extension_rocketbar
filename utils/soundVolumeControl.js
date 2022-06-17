const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Volume = imports.ui.status.volume;

var SoundVolumeControl = class SoundVolumeControl {

    constructor() {

        this._mixerControl = Volume.getMixerControl();

        this._handleMixerSinc();

        this._volumeMax = this._mixerControl.get_vol_max_norm();

        this._mixerSincHandler = this._mixerControl.connect(
            'default-sink-changed',
            (control, sincId) => this._handleMixerSinc(sincId)
        );
    }

    destroy() {
        this._mixerControl.disconnect(this._mixerSincHandler);
    }

    /*
     * volume: negative or positive integer
     */
    addVolume(volume) {

        if (!volume) {
            return;
        }

        let resultVolume = this._sink.volume + volume;

        resultVolume = Math.min(resultVolume, this._volumeMax);
        resultVolume = Math.max(resultVolume, 0);

        this._sink.volume = resultVolume;
        this._sink.push_volume();

        this._showOSD();
    }

    getMaxVolume() {
        return this._volumeMax;
    }

    _handleMixerSinc(sincId) {
        this._sink = (
            sincId ?
            this._mixerControl.lookup_stream_id(sincId) :
            this._mixerControl.get_default_sink()
        );
    }

    _showOSD() {

        const volumeIcons = [
            'audio-volume-muted-symbolic',
            'audio-volume-low-symbolic',
            'audio-volume-medium-symbolic',
            'audio-volume-high-symbolic'
        ];

        const volumeLevel = this._sink.volume / this._volumeMax;

        let iconIndex = 0;

        if (this._sink.volume > 0) {

            const iconIndexMax = volumeIcons.length - 1;

            iconIndex = parseInt(iconIndexMax * volumeLevel + 1);
            iconIndex = Math.max(1, iconIndex);
            iconIndex = Math.min(iconIndexMax, iconIndex);
        }

        const monitorIndex = -1; // display on all monitors
        const icon = Gio.Icon.new_for_string(volumeIcons[iconIndex]);
        const label = this._sink.get_port().human_port;

        Main.osdWindowManager.show(monitorIndex, icon, label, volumeLevel);
    }

}