const { Gio, Gvc, GLib } = imports.gi;
const Main = imports.ui.main;
const Volume = imports.ui.status.volume;

var SoundVolumeControl = class SoundVolumeControl {

    constructor() {

        this._mixerControl = Volume.getMixerControl();

        this._volumeMax = this._mixerControl.get_vol_max_norm();

        this._handleMixerStream();

        this._mixerStreamHandler = this._mixerControl.connect(
            'default-sink-changed',
            (control, streamId) => this._handleMixerStream(streamId)
        );
    }

    destroy() {

        if (this._notifyVolumeChangeTimeout) {
            GLib.source_remove(this._notifyVolumeChangeTimeout);
        }

        this._mixerControl.disconnect(this._mixerStreamHandler);
    }

    /*
     * volume: negative or positive integer
     */
    addVolume(volume) {

        if (!volume || !this._stream) {
            return;
        }

        // unmute the stream
        if (this._stream.is_muted) {
            this.toggleMute();
            return;
        }

        let resultVolume = this._stream.volume + (this._volumeMax / 100 * volume);

        resultVolume = Math.min(resultVolume, this._volumeMax);
        resultVolume = Math.max(resultVolume, 0);

        this._stream.volume = resultVolume;
        this._stream.push_volume();

        this._showOSD();

        this._notifyVolumeChange();
    }

    toggleMute() {

        if (!this._stream) {
            return;
        }

        const muteState = this._stream.is_muted;

        this._stream.change_is_muted(!muteState);

        // change_is_muted changes state of the stream with a delay
        // so we need to pass the actual state manually
        this._showOSD(!muteState);
    }

    _handleMixerStream(streamId) {
        this._stream = (
            streamId ?
            this._mixerControl.lookup_stream_id(streamId) :
            this._mixerControl.get_default_sink()
        );
    }

    _showOSD(isMuted) {

        const volumeIcons = [
            'audio-volume-muted-symbolic',
            'audio-volume-low-symbolic',
            'audio-volume-medium-symbolic',
            'audio-volume-high-symbolic'
        ];

        const volumeLevel = (
            isMuted ? 0 :
            this._stream.volume / this._volumeMax
        );

        let iconIndex = 0;

        if (volumeLevel > 0) {

            const iconIndexMax = volumeIcons.length - 1;

            iconIndex = parseInt(iconIndexMax * volumeLevel + 1);
            iconIndex = Math.max(1, iconIndex);
            iconIndex = Math.min(iconIndexMax, iconIndex);
        }

        const monitorIndex = -1; // display on all monitors
        const icon = Gio.Icon.new_for_string(volumeIcons[iconIndex]);
        const label = this._stream.get_port().human_port;

        Main.osdWindowManager.show(monitorIndex, icon, label, volumeLevel);
    }

    _notifyVolumeChange() {

        if (this._notifyVolumeChangeTimeout) {
            return;
        }

        // slow down notifications a bit
        this._notifyVolumeChangeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this._notifyVolumeChangeTimeout = null;
            return GLib.SOURCE_REMOVE;
        });

        if (this._volumeCancellable) {
            this._volumeCancellable.cancel();
        }

        this._volumeCancellable = null;

        // feedback not necessary while playing
        if (this._stream.state === Gvc.MixerStreamState.RUNNING)
            return;

        this._volumeCancellable = new Gio.Cancellable();

        const player = global.display.get_sound_player();

        player.play_from_theme('audio-volume-change', 'Volume changed', this._volumeCancellable);
    }

}