// This class exports: SoundVolumeControl, AppSoundVolumeControl

//#region imports

const { Gio, Gvc, GLib, Shell } = imports.gi;
const Main = imports.ui.main;
const Volume = imports.ui.status.volume;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Connections } = Me.imports.utils.connections;

//#endregion imports

//#region base classes

class SoundStream {

    constructor(stream) {

        this._stream = stream;

        this.id = this._stream?.id;

        this._volumeMax = (
            this._stream?.get_base_volume() ||
            // for app streams get_base_volume returns 0
            // so we need this fallback
            Volume.getMixerControl().get_vol_max_norm()
        );
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
        return this._stream ? (
            this._stream.get_port() ?
            this._stream.get_port().human_port :
            this._stream.get_name()
        ) : null;
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

    _showOSD(stream, isMuted, name) {

        if (!stream) {
            return;
        }

        const [volumeLevel, volumeIcon] = stream.getVolumeWithIcon(isMuted);

        // pass -1 as monitor index to show on all monitors
        Main.osdWindowManager.show(-1, volumeIcon, name || stream.getName(), volumeLevel);
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

//#endregion base classes


//#region system wide control

var SoundVolumeControl = class extends SoundVolumeControlBase {

    constructor() {
        super();

        this._stream = null;

        this._connections = new Connections();

        const mixerControl = Volume.getMixerControl();

        this._connections.add(
            mixerControl, 'default-sink-changed',
            (mixerControl, streamId) => this._handleActiveStream(mixerControl, streamId)
        );

        this._handleActiveStream(mixerControl);
    }

    destroy() {

        super.destroy();

        this._connections.destroy();
    }

    addVolume(volume) {
        this._addVolume(this._stream, volume, true);
    }

    toggleMute() {
        this._toggleMute(this._stream, true);
    }

    _handleActiveStream(mixerControl, streamId) {
        this._stream = new SoundStream(
            streamId ?
            mixerControl.lookup_stream_id(streamId) :
            mixerControl.get_default_sink()
        );
    }

}

//#endregion system wide control

//#region app sound volume control

class AppSoundStream extends SoundStream {

    static isValidStream(stream) {
        return stream && stream.id && !stream.is_event_stream && (
            stream instanceof Gvc.MixerSinkInput ||
            stream instanceof Gvc.MixerSourceOutput
        );
    }

    constructor(stream) {
        super(stream);

        this.name = this._stream?.name;

        this.isInput = (
            this._stream &&
            this._stream instanceof Gvc.MixerSourceOutput
        );

        this._listeners = []; // [AppSoundVolumeControl...]
    }

    addListener(listener) {

        if (!this._listeners || (
                this._listeners.length &&
                this._listeners.indexOf(listener) >= 0
        )) {
            return;
        }

        this._listeners.push(listener);
    }

    removeListener(listener) {

        if (!this._listeners || !this._listeners.length) {
            return;
        }

        const index = this._listeners.indexOf(listener);

        if (index < 0) {
            return;
        }

        this._listeners.splice(index, 1);

    }

    destroy() {

        this._stream = null;

        if (this._listeners.length) {
            for (let listener of this._listeners) {
                listener.removeStream(this);
            }
        }

        this._listeners = null;
    }
}

class AppSoundVolumeService {

    constructor() {
        
        this._controls = [];

        const mixerControl = Volume.getMixerControl();
        
        this._setStreams(mixerControl);

        this._connections = new Connections();

        this._connections.add(
            mixerControl, 'stream-added',
            (mixerControl, streamId) => this._addStream(mixerControl, streamId)
        );

        this._connections.add(
            mixerControl, 'stream-removed',
            (mixerControl, streamId) => this._removeStream(streamId)
        );
    }

    destroy() {

        this._controls = null;
        this._streams = null;

        this._stopUpdateControls();

        this._connections.destroy();
    }

    isEmpty() {
        return !this._controls?.length;
    }

    addControl(control) {

        log('SERVICE Add control');

        if (!control || this._controls.indexOf(control) >= 0) {
            return;
        }

        this._controls.push(control);

        this._queueUpdateControls();
    }

    removeControl(control) {

        if (!control) {
            return;
        }

        const controlIndex = this._controls.indexOf(control);

        if (controlIndex >= 0) {
            this._controls.splice(controlIndex, 1);
        }

        log('SERVICE Remove control');
    }

    forceUpdate() {
        this._queueUpdateControls();
    }

    _setStreams(mixerControl) {

        this._streams = new Map(); // id => AppSoundStream

        for (let stream of mixerControl.get_streams()) {

            if (!AppSoundStream.isValidStream(stream)) {
                continue;
            }

            const appStream = new AppSoundStream(stream);

            if (!appStream.id) {
                continue;
            }

            log('SERVICE Add streams ' + appStream.name);

            this._streams.set(appStream.id, appStream);
        }
    }

    _addStream(mixerControl, streamId) {

        if (!mixerControl || !streamId || !this._streams) {
            return;
        }

        if (this._streams.has(streamId)) {
            return;
        }

        const stream = mixerControl.lookup_stream_id(streamId);

        if (AppSoundStream.isValidStream(stream)) {
            this._streams.set(streamId, new AppSoundStream(stream));

            log('SERVICE Add stream ' + stream.name);
        }

        this._queueUpdateControls();
    }

    _removeStream(streamId) {

        if (!streamId || !this._streams) {
            return;
        }

        const appStream = this._streams.get(streamId);

        if (appStream) {
            appStream.destroy();
            this._streams.delete(streamId);
        }

        log('SERVICE Remove stream ' + streamId);
    }

    _queueUpdateControls() {
        this._stopUpdateControls();

        if (this._skipUpdateControls()) {
            return;
        }

        this._updateControlsTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {

            this._updateControlsTimeout = null;

            this._updateControls();

            return GLib.SOURCE_REMOVE;
        });
    }

    _stopUpdateControls() {
        if (this._updateControlsTimeout) {
            GLib.source_remove(this._updateControlsTimeout);
            this._updateControlsTimeout = null;
        }
    }

    _updateControls() {

        if (this._skipUpdateControls()) {
            return;
        }

        const streams = [...this._streams.values()];

        for (let i = 0, l = this._controls.length; i < l; ++i) {

            const appControl = this._controls[i];

            for (let i = 0, l = streams.length; i < l; ++i) {
                // let the app control to validate the stream
                appControl.addStream(streams[i]);
            }
        }
    }

    _skipUpdateControls() {
        return !this._controls?.length || !this._streams?.size;
    }

}

var AppSoundVolumeControl = class extends SoundVolumeControlBase {

    static _service = null;

    constructor(app) {
        super();

        this._app = app;

        this._originalAppName = this._app.get_name();
        this._appName = null; // will be set later

        this._inputStreams = [];

        this._outputStreams = [];
    
        if (!AppSoundVolumeControl._service) {
            AppSoundVolumeControl._service = new AppSoundVolumeService();
        }

        AppSoundVolumeControl._service.addControl(this);
    }

    destroy() {

        super.destroy();

        if (this._inputStreams) {
            for (let appStream of this._inputStreams) {
                appStream.removeListener(this);
            }
            this._inputStreams = null;
        }

        if (this._outputStreams) {
            for (let appStream of this._outputStreams) {
                appStream.removeListener(this);
            }
            this._outputStreams = null;
        }

        if (!AppSoundVolumeControl._service) {
            return;
        }

        AppSoundVolumeControl._service.removeControl(this);

        if (AppSoundVolumeControl._service.isEmpty()) {
            AppSoundVolumeControl._service.destroy();
            AppSoundVolumeControl._service = null;
        }
    }

    addStream(appStream) {

        if (!this._inputStreams || !this._outputStreams ||
                !this._canAcceptStream(appStream)) {
            return;
        }

        const streams = (
            appStream.isInput ?
            this._inputStreams :
            this._outputStreams
        );

        if (streams.length && streams.indexOf(appStream) >= 0) {
            return;
        }

        streams.push(appStream);

        log('App Sound Control add stream ' + this._appName + ' ' + streams.length);

        appStream.addListener(this);
    }

    removeStream(appStream) {

        if (!appStream || !this._inputStreams || !this._outputStreams) {
            return;
        }

        const streams = (
            appStream.isInput ?
            this._inputStreams :
            this._outputStreams
        );

        const streamIndex = (
            streams.length ?
            streams.indexOf(appStream) :
            -1
        );

        if (streamIndex < 0) {
            return;
        }

        streams.splice(streamIndex, 1);

        log('App Sound Control remove stream ' + this._appName + ' ' + appStream.isInput);

        // no need to call appStream.removeListener because this method
        // will be called by the appStream itself when it gets removed
    }

    //#region functions to be called outside this module

    handleAppState() {

        // no need to set the name twice
        if (this._appName !== null) {
            return;
        }

        // try to set the app name
        this._setAppName();

        // if the name has changed and is not equal to the original name
        // force the service to update app controls
        if (this._appName && this._appName !== this._originalAppName) {
            AppSoundVolumeControl._service?.forceUpdate();
        }
    }

    hasInput() {
        return this._inputStreams?.length > 0;
    }

    hasOutput() {
        return this._outputStreams?.length > 0;
    }

    getInputVolume() {
        return this._getVolume(this._inputStreams);
    }

    getOutputVolume() {
        return this._getVolume(this._outputStreams);
    }

    setInputVolume(volume) {
        this._setVolume(this._inputStreams, volume);
    }

    setOutputVolume(volume) {
        this._setVolume(this._outputStreams, volume);
    }

    addOutputVolume(volume) {

    }

    toggleOutputMute() {

    }

    //#endregion functions to be called outside this module

    _canAcceptStream(stream) {

        if (!stream || !stream.name) {
            return false;
        }

        if (this._appName === null) {
            this._setAppName();
        }

        // Sometimes name of the app stream is not equal to the name of the app
        // But it contains name of the app
        // For ex: Google Chrome create input streams called 'Google Chrome input'
        return stream.name.includes(this._appName || this._originalAppName);
    }

    _setAppName() {

        if (!this._app) {
            // just in case set dummy name to avoid calling this method twice
            this._appName = '';
        }

        // A workaround to handle Chrome Apps and probably something else
        // Chrome Apps share Google Chrome's sound streams
        // To identify proper streams for such apps we need to get name of the parent app
        // So this class should be create for RUNNING apps only to function as expected

        const appWindows = this._app.get_windows();

        if (!appWindows || !appWindows.length) {
            return;
        }

        let appName = null;

        if (appWindows[0].wm_class) {
            
            let searchResult = Shell.AppSystem.search(appWindows[0].wm_class);

            // it's an array of arrays [[],[],[]]
            if (searchResult?.length && searchResult[0]?.length) {

                for (let appId of searchResult[0]) {

                    let app = Shell.AppSystem.get_default().lookup_app(appId);

                    if (!app || !app.get_windows()?.length) {
                        continue;
                    }

                    appName = app.get_name();

                    break;
                }
                
            }
        }

        this._appName = appName || this._originalAppName;
    }

    _getVolume(streams) {

        if (!streams || !streams.length) {
            return 0;
        }

        let result = 1;

        for (let appStream of streams) {
            result = Math.min(appStream.getVolume(), result);
        }

        return result;
    }

    _setVolume(streams, volume) {

        if (!streams || !streams.length) {
            return;
        }

        for (let appStream of streams) {

            if (appStream.isMuted()) {
                appStream.toggleMute();
            }

            appStream.setVolume(volume);
        }
    }

}

//#endregion app sound volume control