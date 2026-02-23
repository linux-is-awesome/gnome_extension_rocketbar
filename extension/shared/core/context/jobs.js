/**
 * @typedef {Job} Jobs.Job
 * @typedef {import('gi://Meta').Laters} Meta.Laters
 */

import GLib from 'gi://GLib';
import Context from '../context.js';
import { Delay } from '../../enums/general.js';

const LATER_TYPE_BEFORE_REDRAW = 1;
const LATER_TYPE_IDLE = 2;

/** @type {{[delay: string]: number}} */
const LaterType = {
    [Delay.Redraw]: LATER_TYPE_BEFORE_REDRAW,
    [Delay.Idle]: LATER_TYPE_IDLE
};

/** @type {Meta.Laters?} */
const Laters = typeof global !== 'undefined' ?
               global.compositor.get_laters() : null;

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
    #destroyCallback = null;

    /** @type {boolean} */
    get #isValid() {
        return typeof this.#destroyCallback === 'function' &&
               typeof this.#delay === 'number';
    }

    /** @type {Promise<boolean>?} */
    get #currentJob() {
        if (!this.#isValid) return null;
        this.#job ??= new Promise(resolve => this.#start(resolve));
        return this.#job;
    }

    /**
     * @param {(job: Job) => void} destroyCallback
     * @param {number?} [delay]
     */
    constructor(destroyCallback, delay) {
        this.#destroyCallback = destroyCallback;
        this.#delay = delay ?? Delay.Idle;
    }

    /**
     * @param {(() => void)?} [callback] a function to call after destroy
     * @returns {this}
     */
    destroy(callback) {
        if (!this.#isValid) return this;
        if (typeof callback === 'function') return this.enqueue(() => (this.destroy(), callback()));
        this.#abort();
        if (this.#destroyCallback) this.#destroyCallback(this);
        this.#delay = null;
        this.#destroyCallback = null;
        return this;
    }

    /**
     * @param {() => void} callback
     * @returns {this}
     */
    enqueue(callback) {
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
        const isLaterType = !!Laters && typeof LaterType[delay] === 'number';
        this.#id = isLaterType ? Laters.add(LaterType[delay], () => this.#finish()) :
                   GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, Math.max(0, delay), () => this.#finish());
    }

    #abort() {
        if (this.#id) {
            const isLaterType = !!Laters &&
                                typeof this.#delay === 'number' &&
                                typeof LaterType[this.#delay] === 'number';
            if (isLaterType) Laters.remove(this.#id);
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
        this.#job?.catch(e => Context.logError(`${this.constructor.name} failed.`, e));
        if (typeof this.#resolver === 'function') this.#resolver(result);
        this.#resolver = null;
        this.#job = null;
        return GLib.SOURCE_REMOVE;
    }

}

class SharedJob extends Job {

    /** @type {Map<*, () => void>?} */
    #clients = new Map();

    /** @type {Set?} */
    get clients() {
        if (!this.#clients) return null;
        return new Set(this.#clients.keys());
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    addClient(client, callback) {
        if (!this.#clients) return;
        if (this.#clients.size) this.reset();
        this.#clients.set(client, callback);
        this.enqueue(() => (this.#notifyClients(), this.destroy()));
    }

    /**
     * @param {*} client
     */
    removeClient(client) {
        if (!this.#clients?.has(client)) return;
        this.#clients.delete(client);
        if (!this.#clients.size) this.destroy();
    }

    /**
     * @override
     * @returns {this}
     */
    destroy() {
        super.destroy();
        this.#clients?.clear();
        this.#clients = null;
        return this;
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        for (const [client, callback] of this.#clients) {
            this.#clients.delete(client);
            callback();
        }
    }

}

export default class Jobs {

    /** @type {Map<*, Set<Job>>?} */
    #jobs = new Map();

    /** @type {Map<number, SharedJob>?} */
    #sharedJobs = new Map();

    destroy() {
        if (!this.#jobs) return;
        const jobs = this.#jobs.values();
        this.#sharedJobs?.clear();
        this.#jobs = null;
        this.#sharedJobs = null;
        for (const clientJobs of jobs) {
            for (const job of clientJobs) job.destroy();
        }
    }

    /**
     * @param {*} client
     * @param {number} [delay]
     * @returns {Job}
     */
    replace(client, delay = Delay.Idle) {
        return this.removeAll(client).new(client, delay);
    }

    /**
     * @param {*} client
     * @param {number} [delay]
     * @returns {Job}
     */
    new(client, delay = Delay.Idle) {
        if (!this.#jobs || !client ||
            typeof delay !== 'number') throw new Error(`${this.constructor.name} failed to create new ${Job.name}.`);
        return this.#add(client, new Job(job => this.#remove(client, job), delay));
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     * @param {number} [delay]
     */
    shared(client, callback, delay = Delay.Idle) {
        if (!this.#sharedJobs || !client ||
            typeof callback !== 'function' ||
            typeof delay !== 'number') return;
        const sharedJob = this.#sharedJobs.get(delay) ?? new SharedJob(() => this.#removeShared(delay), delay);
        sharedJob.addClient(client, callback);
        this.#sharedJobs.set(delay, sharedJob);
        this.#add(client, sharedJob);
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    has(client) {
        return !!this.#jobs?.has(client);
    }

    /**
     * @param {*} client
     * @param {number} delay
     * @returns {boolean}
     */
    hasShared(client, delay) {
        return !!this.#sharedJobs?.get(delay)?.clients?.has(client);
    }

    /**
     * @param {*} client
     * @param {number} delay
     */
    removeShared(client, delay) {
        const job = this.#sharedJobs?.get(delay);
        if (!job) return;
        this.#remove(client, job);
        this.#sharedJobs?.get(delay)?.removeClient(client);
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
        for (const job of jobs) {
            if (job instanceof SharedJob) job.removeClient(client);
            else job.destroy();
        }
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
     * @param {number} delay
     */
    #removeShared(delay) {
        const job = this.#sharedJobs?.get(delay);
        if (!job) return;
        this.#sharedJobs?.delete(delay);
        const clients = job.clients;
        if (!clients?.size) return;
        for (const client of clients) this.#remove(client, job);
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
