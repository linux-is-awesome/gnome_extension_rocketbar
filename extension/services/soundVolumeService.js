/* exported DefaultSoundVolumeControlClient */

import Gio from 'gi://Gio';
import Gvc from 'gi://Gvc';
import { Main, Volume } from '../core/legacy.js';
import { Context } from '../core/context.js';
import { Type } from '../core/enums.js';

const SOUND_STREAM_MIN_VOLUME = 0;
const SOUND_VOLUME_CHANGE_NOTIFY_DELAY = 50;
const SOUND_VOLUME_CHANGE_NOTIFY_THEME = 'audio-volume-change';
const SOUND_VOLUME_CHANGE_NOTIFY_TITLE = 'Volume Changed Notify';

const SOUND_VOLUME_ICONS = [
    'audio-volume-muted-symbolic',
    'audio-volume-low-symbolic',
    'audio-volume-medium-symbolic',
    'audio-volume-high-symbolic'
];

/** @enum {number} */
const SoundVolumeIcon = {
    Muted: 0,
    Low: 1,
    Medium: 2,
    High: 3
}

/** @enum {string} */
const MixerControlEvent = {
    DefaultSinkChanged: 'default-sink-changed'
}

class SoundStream {

    /** @type {Gvc.MixerStream} */
    #stream = null;

    /** @type {number} */
    #volumeMax = SOUND_STREAM_MIN_VOLUME;

    /** @type {number} */
    get id() {
        return this.#stream?.id;
    }

    /** @type {boolean} */
    get isMuted() {
        return this.#stream?.is_muted;
    }

    /** @type {boolean} */
    get isPlaying() {
        return this.#stream?.state === Gvc.MixerStreamState.RUNNING;
    }

    /** @type {string} */
    get name() {
        return this.#stream?.get_port()?.human_port ?? this.#stream?.name;
    }

    /** @type {number} positive float values 0..0.1...0.8..0.9..1 */
    get volume() {
        if (!this.#stream || !this.#volumeMax) return SOUND_STREAM_MIN_VOLUME;
        return this.#stream.volume / this.#volumeMax;
    }

    /** @param {number} volume positive float values 0..0.1...0.8..0.9..1 */
    set volume(volume) {
        if (!this.#stream || typeof volume !== Type.Number) return;
        volume = this.#volumeMax * volume;
        volume = Math.min(volume, this.#volumeMax);
        volume = Math.max(volume, SOUND_STREAM_MIN_VOLUME);
        this.#stream.volume = volume;
        this.#stream.push_volume();
    }

    /**
     * @param {Gvc.MixerStream} stream
     */
    constructor(stream) {
        if (stream instanceof Gvc.MixerStream === false) return; 
        this.#stream = stream;
        this.#volumeMax = this.#stream.get_base_volume();
        if (this.#volumeMax) return;
        this.#volumeMax = Volume.getMixerControl().get_vol_max_norm();
    }

    toggleMute() {
        this.#stream?.change_is_muted(!this.isMuted);
    }

}

class SoundVolumeControl {
    
    /** @type {Gio.Cancellable} */
    #volumeCancellable = null;

    destroy() {
        this.#volumeCancellable?.cancel();
        this.#volumeCancellable = null;
    }

    /**
     * @param {SoundStream} stream
     * @param {boolean} [isMuted]
     * @param {string} [name]
     */
    showOSD(stream, isMuted, name) {
        if (stream instanceof SoundStream === false) return;
        const volumeLevel = isMuted ? SOUND_STREAM_MIN_VOLUME : stream.volume;
        const volumeIcon = this.#getVolumeIcon(volumeLevel);
        const monitorIndex = global.display.get_current_monitor();
        Main.osdWindowManager.show(monitorIndex, volumeIcon, name ?? stream.name, volumeLevel);
    }

    /**
     * @param {SoundStream} stream
     */
    notifyVolumeChange(stream) {
        if (stream instanceof SoundStream === false) return;
        if (stream.isPlaying || Context.jobs.hasClient(this)) return;
        Context.jobs.new(this, SOUND_VOLUME_CHANGE_NOTIFY_DELAY).destroy(() => null);
        this.#volumeCancellable?.cancel();
        this.#volumeCancellable = new Gio.Cancellable();
        const player = global.display.get_sound_player();
        player.play_from_theme(SOUND_VOLUME_CHANGE_NOTIFY_THEME, SOUND_VOLUME_CHANGE_NOTIFY_TITLE, this.#volumeCancellable);
    }

    /**
     * @param {number} volumeLevel
     */
    #getVolumeIcon(volumeLevel) {
        if (!volumeLevel) return Gio.Icon.new_for_string(SOUND_VOLUME_ICONS[SoundVolumeIcon.Muted]);
        let iconIndex = parseInt(SoundVolumeIcon.High * volumeLevel + SoundVolumeIcon.Low);
        iconIndex = Math.max(SoundVolumeIcon.Low, iconIndex);
        iconIndex = Math.min(SoundVolumeIcon.High, iconIndex);
        return Gio.Icon.new_for_string(SOUND_VOLUME_ICONS[iconIndex]);
    }

}

class DefaultSoundVolumeControl extends SoundVolumeControl {

    /** @type {SoundStream} */
    #stream = null;

    constructor() {
        super();
        const mixer = Volume.getMixerControl();
        Context.signals.add(this, [mixer, MixerControlEvent.DefaultSinkChanged, (...args) => this.#setStream(...args)]);
        this.#setStream(mixer);
    }

    destroy() {
        Context.signals.removeAll(this);
        super.destroy();
    }

    /**
     * @param {number} volume negative or positive integer -100..-1, 1..100
     */
    addVolume(volume) {
        if (!this.#stream || typeof volume !== Type.Number) return;
        if (this.#stream.isMuted) return this.toggleMute();
        this.#stream.volume = this.#stream.volume + (volume / 100);
        this.showOSD(this.#stream);
        this.notifyVolumeChange(this.#stream);
    }

    toggleMute() {
        if (!this.#stream) return;
        const isMuted = this.#stream.isMuted;
        this.#stream.toggleMute();
        this.showOSD(this.#stream, !isMuted);
        if (isMuted) this.notifyVolumeChange(this.#stream);
    }

    /**
     * @param {Gvc.MixerControl} mixer 
     * @param {number} streamId 
     */
    #setStream(mixer, streamId) {
        const stream = streamId ? mixer?.lookup_stream_id(streamId) : mixer?.get_default_sink();
        this.#stream = new SoundStream(stream);
    }

}

export class DefaultSoundVolumeControlClient {

    /** @type {Set<DefaultSoundVolumeControlClient>} */
    static #clients = null;

    /** @type {DefaultSoundVolumeControl} */
    static #control = null;

    constructor() {
        if (!DefaultSoundVolumeControlClient.#clients) {
            DefaultSoundVolumeControlClient.#clients = new Set();
        }
        if (!DefaultSoundVolumeControlClient.#control) {
            DefaultSoundVolumeControlClient.#control = new DefaultSoundVolumeControl();
        }
        DefaultSoundVolumeControlClient.#clients.add(this);
    }

    destroy() {
        if (!DefaultSoundVolumeControlClient.#clients) return;
        DefaultSoundVolumeControlClient.#clients.delete(this);
        if (DefaultSoundVolumeControlClient.#clients.size) return;
        DefaultSoundVolumeControlClient.#control?.destroy();
        DefaultSoundVolumeControlClient.#control = null;
        DefaultSoundVolumeControlClient.#clients = null;
    }

    /**
     * @param {number} volume negative or positive integer -100..-1, 1..100
     */
    addVolume(volume) {
        DefaultSoundVolumeControlClient.#control?.addVolume(volume);
    }

    toggleMute() {
        DefaultSoundVolumeControlClient.#control.toggleMute();
    }

}
