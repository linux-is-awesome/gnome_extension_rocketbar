const { Gio, Gvc, GLib } = imports.gi;
const Main = imports.ui.main;
const Volume = imports.ui.status.volume;

class SoundStream {

    constructor(stream) {

        this._stream = stream;

        this._volumeMax = this._stream?.get_base_volume();
    }

    /*
     * volume: negative or positive integer -100..-1, 1..100
     */
    addVolume(volume) {

        if (!volume || !this._stream) {
            return false;
        }

        return this.setVolume(this.getVolume() + (volume / 100));
    }

    /*
     * volume: positive double 0..0.1...0.8..0.9..1
     */
    setVolume(volume) {

        if (!this._stream) {
            return false;
        }

        volume = this._volumeMax * volume;

        volume = Math.min(volume, this._volumeMax);
        volume = Math.max(volume, 0);

        this._stream.volume = volume;
        this._stream.push_volume();

        return true;
    }

    toggleMute() {

        if (!this._stream) {
            return false;
        }

        this._stream.change_is_muted(!this.isMuted());

        return true;
    }

    // change_is_muted changes state of the stream with a delay
    // so we may need to pass the actual state manually
    getVolumeWithIcon(isMuted) {

        const volumeIcons = [
            'audio-volume-muted-symbolic',
            'audio-volume-low-symbolic',
            'audio-volume-medium-symbolic',
            'audio-volume-high-symbolic'
        ];

        const volumeLevel = this.getVolume(isMuted);

        let iconIndex = 0;

        if (volumeLevel > 0) {

            const iconIndexMax = volumeIcons.length - 1;

            iconIndex = parseInt(iconIndexMax * volumeLevel + 1);
            iconIndex = Math.max(1, iconIndex);
            iconIndex = Math.min(iconIndexMax, iconIndex);
        }

        return [volumeLevel, Gio.Icon.new_for_string(volumeIcons[iconIndex])];
    }

    getVolume(isMuted = this.isMuted()) {
        return (
            !this._stream || isMuted ? 0 :
            this._stream.volume / this._volumeMax
        );
    }

    isPlaying() {
        return this._stream?.state === Gvc.MixerStreamState.RUNNING;
    }

    isMuted() {
        return this._stream?.is_muted;
    }

    getName() {
        return this._stream?.get_port()?.human_port;
    }

}

class SoundVolumeControlBase {

    constructor() {
        this._notifyVolumeChangeTimeout = null;
    }

    destroy() {

        if (this._notifyVolumeChangeTimeout) {
            GLib.source_remove(this._notifyVolumeChangeTimeout);
        }

    }

    _addVolume(stream, volume, notify) {

        if (!stream) {
            return;
        }

        if (stream.isMuted()) {
            this._toggleMute(stream, notify);
            return;
        }

        if (!stream.addVolume(volume) || !notify) {
            return;
        }

        this._showOSD(stream);

        this._notifyVolumeChange(stream);
    }

    _toggleMute(stream, notify) {

        if (!stream) {
            return;
        }

        const isMuted = this._stream.isMuted();

        if (!this._stream.toggleMute() || !notify) {
            return;
        }

        this._showOSD(stream, !isMuted);

        // play sound when stream gets unmuted
        if (isMuted) {
            this._notifyVolumeChange(stream);
        }
    }

    _showOSD(stream, isMuted) {

        if (!stream) {
            return;
        }

        const [volumeLevel, volumeIcon] = stream.getVolumeWithIcon(isMuted);

        // pass -1 as monitor index to show on all monitors
        Main.osdWindowManager.show(-1, volumeIcon, stream.getName(), volumeLevel);
    }

    _notifyVolumeChange(stream) {

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
        if (!stream || stream.isPlaying())
            return;

        this._volumeCancellable = new Gio.Cancellable();

        const player = global.display.get_sound_player();

        player.play_from_theme('audio-volume-change', 'Volume changed', this._volumeCancellable);
    }

}

var SoundVolumeControl = class extends SoundVolumeControlBase {

    constructor() {
        super();

        this._mixerControl = Volume.getMixerControl();

        this._stream = null;

        this._handleMixerStream();

        this._mixerStreamHandler = this._mixerControl.connect(
            'default-sink-changed',
            (mixer, streamId) => this._handleMixerStream(streamId)
        );
    }

    destroy() {

        super.destroy();

        this._mixerControl.disconnect(this._mixerStreamHandler);
    }

    addVolume(volume) {
        this._addVolume(this._stream, volume, true);
    }

    toggleMute() {
        this._toggleMute(this._stream, true);
    }

    _handleMixerStream(streamId) {
        this._stream = new SoundStream(
            streamId ?
            this._mixerControl.lookup_stream_id(streamId) :
            this._mixerControl.get_default_sink()
        );
    }

}

class AppSoundVolumeService {

}

var AppSoundVolumeControl = class {

    static _service = null;

}