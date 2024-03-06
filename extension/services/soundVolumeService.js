/**
 * JSDoc types
 *
 * @typedef {import('gi://Meta').Window} Meta.Window
 * @typedef {import('../core/context/jobs.js').Jobs.Job} Job
 */

import Gvc from 'gi://Gvc';
import Shell from 'gi://Shell';
import { getMixerControl as MixerControl } from 'resource:///org/gnome/shell/ui/status/volume.js';
import Context from '../core/context.js';
import { Delay } from '../core/enums.js';

const SOUND_STREAM_MIN_VOLUME = 0;
const SOUND_STREAM_MAX_VOLUME = 1;

/** @enum {string} */
const MixerControlEvent = {
    StreamAdded: 'stream-added',
    StreamRemoved: 'stream-removed'
};

class SoundStream {

    /** @type {Gvc.MixerStream?} */
    #stream = null;

    /** @type {number} */
    #volumeMax = SOUND_STREAM_MIN_VOLUME;

    /** @type {number?} */
    get id() {
        return this.#stream?.id ?? null;
    }

    /** @type {boolean} */
    get isValid() {
        return !!this.#stream;
    }

    /** @type {boolean} */
    get isMuted() {
        return this.#stream?.is_muted ?? true;
    }

    /** @type {boolean} */
    get isPlaying() {
        return this.#stream?.state === Gvc.MixerStreamState.RUNNING;
    }

    /** @type {string?} */
    get name() {
        if (!this.#stream) return null;
        const portName = this.#stream.get_ports()?.length ? this.#stream.get_port().human_port : null;
        return portName ?? this.#stream.name;
    }

    /** @type {number} positive float values 0..0.1...0.8..0.9..1 */
    get volume() {
        if (!this.#stream || !this.#volumeMax) return SOUND_STREAM_MIN_VOLUME;
        return this.#stream.volume / this.#volumeMax;
    }

    /** @param {number} volume positive float values 0..0.1...0.8..0.9..1 */
    set volume(volume) {
        if (!this.#stream || typeof volume !== 'number') return;
        volume *= this.#volumeMax;
        volume = Math.min(volume, this.#volumeMax);
        volume = Math.max(volume, SOUND_STREAM_MIN_VOLUME);
        this.#stream.volume = volume;
        this.#stream.push_volume();
    }

    /**
     * @param {Gvc.MixerStream?} stream
     */
    constructor(stream) {
        if (!this.#isValidStream(stream)) return;
        this.#stream = stream;
        this.#volumeMax = this.#stream?.get_base_volume() || MixerControl().get_vol_max_norm();
    }

    destroy() {
        this.#stream = null;
    }

    toggleMute() {
        this.#stream?.change_is_muted(!this.isMuted);
    }

    #isValidStream(stream) {
        return stream instanceof Gvc.MixerStream && stream.id && !stream.is_event_stream;
    }

}

class AppSoundStream extends SoundStream {

    /** @type {boolean} */
    #isInput = false;

    /** @type {string?} */
    #appId = null;

    get appId() {
        return this.#appId;
    }

    /** @type {boolean} */
    get isInput() {
        return this.#isInput;
    }

    /**
     * @param {Gvc.MixerStream} stream
     */
    constructor(stream) {
        super(stream instanceof Gvc.MixerSinkInput ||
              stream instanceof Gvc.MixerSourceOutput ? stream : null);
        this.#appId = stream.get_application_id() ?? null;
        this.#isInput = stream instanceof Gvc.MixerSourceOutput;
    }

}

class AppSoundVolumeService {

    /** @type {Set<AppSoundVolumeControl>?} */
    #controls = new Set();

    /** @type {Map<number, AppSoundStream>?} */
    #streams = new Map();

    /** @type {Job?} */
    #updateJob = Context.jobs.new(this, Delay.Background);

    constructor() {
        const mixer = MixerControl();
        Context.signals.add(this, [
            mixer,
            MixerControlEvent.StreamAdded, (_, streamId) => this.#addStream(mixer, streamId),
            MixerControlEvent.StreamRemoved, (_, streamId) => this.#removeStream(streamId)
        ]);
        this.#addStreams(mixer);
    }

    /**
     * @returns {boolean}
     */
    destroy() {
        if (this.#controls?.size) return false;
        this.#updateJob?.destroy();
        Context.signals.removeAll(this);
        this.#controls = null;
        this.#streams = null;
        this.#updateJob = null;
        return true;
    }

    /**
     * @param {AppSoundVolumeControl} control
     */
    addControl(control) {
        if (!this.#controls || this.#controls.has(control)) return;
        this.#controls.add(control);
        this.#queueUpdate();
    }

    /**
     * @param {AppSoundVolumeControl} control
     */
    removeControl(control) {
        if (!this.#controls?.has(control)) return;
        this.#controls.delete(control);
    }

    update() {
        this.#queueUpdate();
    }

    /**
     * @param {Gvc.MixerControl} mixer
     */
    #addStreams(mixer) {
        const mixerStreams = mixer.get_streams();
        if (!mixerStreams?.length) return;
        for (let i = 0, l = mixerStreams.length; i < l; ++i) {
            const appStream = new AppSoundStream(mixerStreams[i]);
            if (!appStream.isValid || !appStream.id) continue;
            this.#streams?.set(appStream.id, appStream);
        }
    }

    /**
     * @param {Gvc.MixerControl} mixer
     * @param {number} streamId
     */
    #addStream(mixer, streamId) {
        if (!this.#streams || this.#streams.has(streamId)) return;
        const mixerStream = mixer?.lookup_stream_id(streamId);
        if (!mixerStream) return;
        const appStream = new AppSoundStream(mixerStream);
        if (!appStream.isValid || !appStream.id) return;
        this.#streams.set(appStream.id, appStream);
        this.#queueUpdate();
    }

    /**
     * @param {number} streamId
     */
    #removeStream(streamId) {
        if (!this.#streams?.has(streamId)) return;
        this.#streams.get(streamId)?.destroy();
        this.#queueUpdate();
    }

    #queueUpdate() {
        if (!this.#updateJob) return;
        this.#updateJob.reset().queue(() => this.#update());
    }

    #update() {
        if (!this.#streams?.size || !this.#controls?.size) return;
        const validStreams = new Map();
        for (const control of this.#controls) {
            for (const [id, stream] of this.#streams) {
                if (!stream.isValid) {
                    control.removeStream(stream);
                    continue;
                }
                control.addStream(stream);
                validStreams.set(id, stream);
            }
        }
        this.#streams = validStreams;
    }

}

export class AppSoundVolumeControl {

    /** @type {AppSoundVolumeService?} */
    static #service = null;

    /** @type {Shell.App?} */
    #app = null;

    /** @type {string?} */
    #appName = null;

    /** @type {string?} */
    #appId = null;

    /** @type {string?} */
    #parentAppName = null;

    /** @type {Set<AppSoundStream>?} */
    #inputStreams = new Set();

    /** @type {Set<AppSoundStream>?} */
    #outputStreams = new Set();

    /** @type {boolean} */
    get hasInput() {
        return !!this.#inputStreams?.size;
    }

    /** @type {boolean} */
    get hasOutput() {
        return !!this.#outputStreams?.size;
    }

    /** @type {number} positive float values 0..0.1...0.8..0.9..1 */
    get inputVolume() {
        return this.#getVolume(this.#inputStreams);
    }

    /** @type {number} positive float values 0..0.1...0.8..0.9..1 */
    get outputVolume() {
        return this.#getVolume(this.#outputStreams);
    }

    /** @param {number} volume positive float values 0..0.1...0.8..0.9..1 */
    set inputVolume(volume) {
        this.#setVolume(this.#inputStreams, volume);
    }

    /** @param {number} volume positive float values 0..0.1...0.8..0.9..1 */
    set outputVolume(volume) {
        this.#setVolume(this.#outputStreams, volume);
    }

    /**
     * @param {Shell.App} app
     */
    constructor(app) {
        if (app instanceof Shell.App === false) return;
        this.#app = app;
        this.#appId = app.get_id();
        this.#appName = app.get_name().toLowerCase();
        AppSoundVolumeControl.#service ??= new AppSoundVolumeService();
        AppSoundVolumeControl.#service.addControl(this);
    }

    destroy() {
        this.#app = null;
        this.#inputStreams = null;
        this.#outputStreams = null;
        if (!AppSoundVolumeControl.#service) return;
        AppSoundVolumeControl.#service.removeControl(this);
        if (!AppSoundVolumeControl.#service.destroy()) return;
        AppSoundVolumeControl.#service = null;
    }

    update() {
        if (this.#parentAppName) return;
        this.#setParentAppName();
        if (!this.#parentAppName || this.#parentAppName === this.#appName) return;
        AppSoundVolumeControl.#service?.update();
    }

    /**
     * @param {AppSoundStream} stream
     */
    addStream(stream) {
        if (!this.#canAcceptStream(stream)) return;
        const isInputStream = stream.isInput;
        if (isInputStream && !this.#inputStreams?.has(stream)) this.#inputStreams?.add(stream);
        else if (!isInputStream && !this.#outputStreams?.has(stream)) this.#outputStreams?.add(stream);
    }

    /**
     * @param {AppSoundStream} stream
     */
    removeStream(stream) {
        if (!stream) return;
        if (this.#inputStreams?.has(stream)) this.#inputStreams.delete(stream);
        else if (this.#outputStreams?.has(stream)) this.#outputStreams.delete(stream);
    }

    /**
     * @param {number} volume negative or positive integer -100..-1, 1..100
     */
    addOutputVolume(volume) {
        if (!volume || !this.hasOutput) return;
        volume = this.#getVolume(this.#outputStreams) + (volume / 100);
        this.#setVolume(this.#outputStreams, volume);
    }

    toggleOutputMute() {
        if (!this.hasOutput) return;
        this.#toggleMute(this.#outputStreams);
    }

    /**
     * Note: Sometimes name of the app stream is not equal to the name of the app but it contains name of the app.
     *       For example: Google Chrome create input streams called 'Google Chrome input'.
     *       So using String.includes() function to identify app streams.
     *
     * @param {AppSoundStream} stream
     * @returns {boolean}
     */
    #canAcceptStream(stream) {
        if (!this.#inputStreams || !this.#outputStreams ||
            stream instanceof AppSoundStream === false) return false;
        if (this.#appId && this.#appId === stream.appId) return true;
        const streamName = stream.name?.toLowerCase();
        if (!streamName) return false;
        if (!this.#parentAppName) this.#setParentAppName();
        if (this.#parentAppName && streamName.includes(this.#parentAppName)) return true;
        if (this.#appName && streamName.includes(this.#appName)) return true;
        return false;
    }

    /**
     * Note: A workaround to handle Chrome Apps and probably something else.
     *       Chrome Apps share Google Chrome's sound streams.
     *       To identify proper streams for such apps we need to get name of the parent app.
     */
    #setParentAppName() {
        const windows = this.#app?.get_windows();
        if (!windows?.length) return;
        const parentAppName = this.#getParentAppName(windows);
        this.#parentAppName = parentAppName ?? this.#appName;
    }

    /**
     * @param {Meta.Window[]} windows
     * @returns {string?}
     */
    #getParentAppName(windows) {
        const appSystem = Shell.AppSystem.get_default();
        for (let i = 0, l = windows.length; i < l; ++i) {
            const wmClass = windows[i].wm_class;
            if (!wmClass) continue;
            /** @type {string[][]} */
            const searchResults = Shell.AppSystem.search(wmClass);
            if (!searchResults?.length) continue;
            for (let ii = 0, ll = searchResults.length; ii < ll; ++ii) {
                const searchResult = searchResults[ii];
                if (!searchResult?.length) continue;
                for (const appId of searchResult) {
                    if (this.#appId && appId === this.#appId) continue;
                    const app = appSystem.lookup_app(appId);
                    if (!app) continue;
                    return app.get_name().toLowerCase();
                }
            }
        }
        return null;
    }

    /**
     * @param {Set<AppSoundStream>?} streams
     * @returns {number}
     */
    #getVolume(streams) {
        if (!streams?.size) return SOUND_STREAM_MIN_VOLUME;
        let result = SOUND_STREAM_MAX_VOLUME;
        for (const stream of streams) {
            result = Math.min(stream.volume, result);
        }
        return result;
    }

    /**
     * @param {Set<AppSoundStream>?} streams
     * @param {number} volume
     */
    #setVolume(streams, volume) {
        if (!streams?.size) return;
        for (const stream of streams) {
            if (stream.isMuted) stream.toggleMute();
            stream.volume = volume;
        }
    }

    /**
     * @param {Set<AppSoundStream>?} streams
     * @returns {boolean}
     */
    #toggleMute(streams) {
        if (!streams?.size) return false;
        const isMuted = this.#isMuted(streams);
        for (const stream of streams) {
            if (stream.isMuted !== isMuted) continue;
            stream.toggleMute();
        }
        return !isMuted;
    }

    /**
     * @param {Set<AppSoundStream>} streams
     * @returns {boolean}
     */
    #isMuted(streams) {
        if (!streams?.size) return true;
        for (const stream of streams) {
            if (stream.isMuted) return true;
        }
        return false;
    }

}
