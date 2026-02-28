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

    /** @type {boolean} */
    #highPriority = false;

    /** @type {number?} */
    #timestamp = null;

    /** @type {((job: this) => void)?} */
    #destroyCallback = null;

    /**
     * @param {(job: Job) => void} destroyCallback
     * @param {number} delay
     * @param {boolean} [highPriority]
     */
    constructor(destroyCallback, delay, highPriority = false) {
        this.#destroyCallback = destroyCallback;
        this.#delay = delay;
        this.#highPriority = highPriority;
    }

    /**
     * @param {(() => void)?} [callback] a function to call after destroy
     * @returns {this}
     */
    destroy(callback) {
        if (!this.#destroyCallback) return this;
        const hasCallback = typeof callback === 'function';
        if (hasCallback) return this.enqueue(() => (this.destroy(), callback()));
        this.#abort();
        this.#destroyCallback(this);
        this.#delay = null;
        this.#destroyCallback = null;
        this.#timestamp = null;
        return this;
    }

    /**
     * @param {() => void} callback
     * @param {boolean} [replace]
     * @returns {this}
     */
    enqueue(callback, replace = true) {
        if (!this.#destroyCallback ||
            typeof this.#delay !== 'number' ||
            typeof callback !== 'function') return this;
        if (this.#job) this.#abort(!replace && this.#delay > 0 &&
                                   typeof this.#timestamp === 'number' &&
                                   Date.now() - this.#timestamp >= this.#delay);
        this.#timestamp ??= Date.now();
        this.#job = new Promise(resolve => this.#start(resolve)).then(
            isFinished => (isFinished && callback(), isFinished));
        return this;
    }

    /**
     * @param {number?} [delay]
     * @returns {this}
     */
    reset(delay) {
        if (!this.#destroyCallback) return this;
        this.#abort();
        this.#timestamp = null;
        if (typeof delay !== 'number') return this;
        this.#delay = delay;
        return this;
    }

    /**
     * @param {(isFinished: boolean) => void} resolver
     */
    #start(resolver) {
        if (typeof this.#delay !== 'number') return;
        this.#resolver = resolver;
        const delay = this.#delay;
        const isLaterType = !!Laters && typeof LaterType[delay] === 'number';
        if (isLaterType) {
            this.#id = Laters.add(LaterType[delay], () => this.#finish());
            return;
        }
        const priority = this.#highPriority ? GLib.PRIORITY_HIGH_IDLE : GLib.PRIORITY_DEFAULT_IDLE;
        this.#id = GLib.timeout_add(priority, Math.max(0, delay), () => this.#finish());
    }

    /**
     * @param {boolean} [result]
     */
    #abort(result = false) {
        if (typeof this.#id === 'number') {
            const isLaterType = !!Laters &&
                                typeof this.#delay === 'number' &&
                                typeof LaterType[this.#delay] === 'number';
            if (isLaterType) Laters.remove(this.#id);
            else GLib.source_remove(this.#id);
        }
        this.#finish(result);
    }

    /**
     * @param {boolean} [result]
     * @returns {boolean}
     */
    #finish(result = true) {
        this.#id = null;
        this.#job?.catch(e => Context.logError(`${this.constructor.name} failed.`, e));
        if (this.#resolver) this.#resolver(result);
        this.#resolver = null;
        this.#job = null;
        if (!result) return GLib.SOURCE_REMOVE;
        this.#timestamp = null;
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
     * @param {boolean} [highPriority]
     * @returns {Job}
     */
    replace(client, delay, highPriority = false) {
        return this.removeAll(client).new(client, delay, highPriority);
    }

    /**
     * @param {*} client
     * @param {number} [delay]
     * @param {boolean} [highPriority]
     * @returns {Job}
     */
    new(client, delay = Delay.Idle, highPriority = false) {
        if (!this.#jobs || !client ||
            typeof delay !== 'number') throw new Error(`${this.constructor.name} failed to create new ${Job.name}.`);
        return this.#add(client, new Job(job => this.#remove(client, job), delay, highPriority));
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     * @param {number} [delay]
     */
    shared(client, callback, delay = Delay.Idle) {
        if (!this.#sharedJobs || !client ||
            typeof callback !== 'function' ||
            typeof delay !== 'number') throw new Error(`${this.constructor.name} failed to create new ${SharedJob.name}.`);
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
