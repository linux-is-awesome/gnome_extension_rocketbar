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

    /** @type {Promise<boolean>?} */
    #job = null;

    /** @type {((isFinished: boolean) => void)?} */
    #resolver = null;

    /** @type {number?} */
    #delay = null;

    /** @type {((job: this) => void)?} */
    #destroyHandler = null;

    /** @type {boolean} */
    get #isValid() {
        return typeof this.#destroyHandler === 'function' &&
               typeof this.#delay === 'number';
    }

    /** @type {Promise<boolean>?} */
    get #currentJob() {
        if (!this.#isValid) return null;
        this.#job ??= new Promise(resolve => this.#start(resolve));
        return this.#job;
    }

    /**
     * @param {(job: Job) => void} destroyHandler
     * @param {number?} [delay]
     */
    constructor(destroyHandler, delay) {
        this.#destroyHandler = destroyHandler;
        this.#delay = delay ?? Delay.Idle;
    }

    /**
     * @param {(() => void)?} [callback] a function to call after destroy
     * @returns {this}
     */
    destroy(callback) {
        if (!this.#isValid) return this;
        if (typeof callback === 'function') return this.queue(() => (this.destroy(), callback()));
        this.#abort();
        if (this.#destroyHandler) this.#destroyHandler(this);
        this.#delay = null;
        this.#destroyHandler = null;
        return this;
    }

    /**
     * @param {() => void} callback
     * @returns {this}
     */
    queue(callback) {
        if (typeof callback !== 'function') return this;
        this.#job = this.#currentJob?.then(isFinished => {
            if (isFinished) callback();
            return isFinished;
        }) ?? this.#job;
        return this;
    }

    /**
     * @param {number?} [delay]
     * @returns {this}
     */
    reset(delay) {
        this.#abort();
        if (typeof delay !== 'number') return this;
        this.#delay = delay;
        return this;
    }

    /**
     * @param {(isFinished: boolean) => void} resolver
     */
    #start(resolver) {
        this.#resolver = resolver;
        const delay = this.#delay ?? Delay.Idle;
        this.#id = delay === Delay.Redraw || delay === Delay.Idle ?
                   Laters.add(LaterType[delay], () => this.#finish()) :
                   GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, delay, () => this.#finish());
    }

    #abort() {
        if (this.#id) {
            if (this.#delay === Delay.Redraw || this.#delay === Delay.Idle) Laters.remove(this.#id);
            else GLib.source_remove(this.#id);
        }
        this.#finish(false);
    }

    /**
     * @param {boolean} [result]
     * @returns {boolean}
     */
    #finish(result = true) {
        this.#id = null;
        this.#job?.catch(e => Context.logError(`${Job.name} failed.`, e));
        if (typeof this.#resolver === 'function') this.#resolver(result);
        this.#resolver = null;
        this.#job = null;
        return GLib.SOURCE_REMOVE;
    }

}

export default class Jobs {

    /** @type {Map<*, Set<Job>>?} */
    #jobs = new Map();

    destroy() {
        if (!this.#jobs) return;
        const jobs = this.#jobs.values();
        this.#jobs = null;
        for (const clientJobs of jobs) {
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
