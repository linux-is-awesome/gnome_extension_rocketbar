/**
 * JSDoc types
 *
 * @typedef {Job} Jobs.Job
 * @typedef {import('gi://Meta').Laters} Meta.Laters
 */

import GLib from 'gi://GLib';
import Context from '../context.js';
import { Delay } from '../enums.js';

const LATER_TYPE_BEFORE_REDRAW = 1;
const LATER_TYPE_IDLE = 2;

/** @type {{[delay: string]: number}} */
const LaterType = {
    [Delay.Redraw]: LATER_TYPE_BEFORE_REDRAW,
    [Delay.Idle]: LATER_TYPE_IDLE
};

/** @type {Meta.Laters} */
const Laters = global.compositor.get_laters();

class Job {

    /** @type {number?} */
    #id = null;

    /** @type {Promise<void>?} */
    #job = null;

    /** @type {number?} */
    #delay = null;

    /** @type {((job: this) => void)?} */
    #destroyCallback = null;

    /** @type {boolean} */
    get #isValid() {
        return typeof this.#destroyCallback === 'function' && typeof this.#delay === 'number';
    }

    /** @type {Promise<void>?} */
    get #currentJob() {
        if (!this.#isValid) return null;
        if (this.#job) return this.#job;
        this.#job = new Promise(resolve => this.#queue(resolve));
        return this.#job;
    }

    /**
     * @param {(job: Job) => void} destroyCallback
     * @param {number} [delay]
     */
    constructor(destroyCallback, delay = Delay.Idle) {
        this.#destroyCallback = destroyCallback;
        this.#delay = delay;
    }

    /**
     * @param {() => void} [callback] function to call after destroy
     * @returns {this}
     */
    destroy(callback) {
        if (!this.#isValid) return this;
        if (typeof callback === 'function') return this.then(() => (this.destroy(), callback()));
        this.reset();
        if (typeof this.#destroyCallback === 'function') this.#destroyCallback(this);
        this.#delay = null;
        this.#destroyCallback = null;
        return this;
    }

    /**
     * @param {() => void} callback
     * @returns {this}
     */
    then(callback) {
        this.#job = this.#currentJob?.then(callback) ?? null;
        return this;
    }

    /**
     * @param {(...args) => void} [callback]
     * @returns {this}
     */
    catch(callback) {
        this.#job = this.#currentJob?.catch(typeof callback === 'function' ? callback :
                                            e => Context.logError(`${Job.name} failed.`, e)) ?? null;
        return this;
    }

    /**
     * @param {() => void} callback
     * @returns {this}
     */
    finally(callback) {
        this.#job = this.#currentJob?.finally(callback) ?? null;
        return this;
    }

    /**
     * @param {number} [delay]
     * @returns {this}
     */
    reset(delay) {
        this.#job = null;
        if (this.#id) this.#dequeue();
        if (typeof delay !== 'number') return this;
        this.#delay = delay;
        return this;
    }

    /**
     * @param {(...args) => void} callback
     */
    #queue(callback) {
        switch (this.#delay) {
            case Delay.Redraw:
            case Delay.Idle:
                this.#id = Laters.add(LaterType[this.#delay], () => this.#resolve(callback));
                break;
            default:
                this.#id = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, this.#delay ?? 0,
                                            () => this.#resolve(callback));
        }
    }

    /**
     * @param {(...args) => void} callback
     * @returns {boolean}
     */
    #resolve(callback) {
        this.#id = null;
        callback();
        return GLib.SOURCE_REMOVE;
    }

    #dequeue() {
        if (!this.#id) return;
        switch (this.#delay) {
            case Delay.Redraw:
            case Delay.Idle:
                Laters.remove(this.#id);
                break;
            default: GLib.source_remove(this.#id);
        }
        this.#id = null;
    }

}

export default class Jobs {

    /** @type {Map<*, Set<Job>>?} */
    #jobs = new Map();

    destroy() {
        if (!this.#jobs) return;
        const jobs = this.#jobs;
        this.#jobs = null;
        for (const [_, clientJobs] of jobs) {
            for (const job of clientJobs) job.destroy();
        }
    }

    /**
     * @param {*} client
     * @param {number} [delay]
     * @returns {Job}
     */
    new(client, delay = Delay.Idle) {
        if (!this.#jobs) throw new Error(`${this.constructor.name} unable to create a new ${Job.name}.`);
        return this.#add(client, new Job(job => this.#remove(client, job), delay));
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    hasClient(client) {
        return this.#jobs?.has(client) ?? false;
    }

    /**
     * @param {*} client
     * @returns {this}
     */
    removeAll(client) {
        if (!client || !this.#jobs) return this;
        const jobs = this.#jobs.get(client);
        if (!jobs) return this;
        this.#jobs.delete(client);
        for (const job of jobs) job.destroy();
        return this;
    }

    /**
     * @param {*} client
     * @param {Job} job
     * @returns {Job}
     */
    #add(client, job) {
        const jobs = this.#jobs?.get(client) ?? new Set();
        jobs.add(job);
        this.#jobs?.set(client, jobs);
        return job;
    }

    /**
     * @param {*} client
     * @param {Job} job
     */
    #remove(client, job) {
        const jobs = this.#jobs?.get(client);
        if (!jobs) return;
        if (jobs.has(job)) jobs.delete(job);
        if (!jobs.size) this.#jobs?.delete(client);
    }

}
