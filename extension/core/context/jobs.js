/* exported Jobs */

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import { Context } from '../context.js';
import { Type, Delay } from '../enums.js';

/** @type {Meta.Laters} */
const Laters = global.compositor?.get_laters();

/** @type {Object.<string, number>} */
const LaterType = {
    [Delay.Redraw]: Meta.LaterType.BEFORE_REDRAW,
    [Delay.Idle]: Meta.LaterType.IDLE
};

class Job {

    /** @type {number} */
    #id = null;

    /** @type {Promise} */
    #job = null;

    /** @type {number} */
    #delay = null;

    /** @type {(job: this) => void} */
    #destroyCallback = null;

    /** @type {boolean} */
    get #isValid() {
        return typeof this.#destroyCallback === Type.Function && typeof this.#delay === Type.Number;
    }

    /** @type {Promise} */
    get #currentJob() {
        if (this.#job) return this.#job;
        if (!this.#isValid) return null;
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
     * @param {() => void} callback after destroy callback function
     * @returns {this|null}
     */
    destroy(callback) {
        if (!this.#isValid) return;
        if (typeof callback === Type.Function) return this.then(() => this.destroy() ?? callback());
        this.reset();
        if (typeof this.#destroyCallback === Type.Function) this.#destroyCallback(this);
        this.#delay = null;
        this.#destroyCallback = null;
        return null;
    }

    /**
     * @param {() => void} callback
     * @returns {this}
     */
    then(callback) {
        this.#job = this.#currentJob?.then(callback);
        return this;
    }

    /**
     * @param {(error) => void} [callback]
     * @returns {this}
     */
    catch(callback) {
        this.#job = this.#currentJob?.catch(typeof callback === Type.Function ? callback : e => console.error(Context.metadata?.name, e));
        return this;
    }

    /**
     * @param {() => void} callback
     * @returns {this}
     */
    finally(callback) {
        this.#job = this.#currentJob?.finally(callback);
        return this;
    }

    /**
     * @param {number} [delay]
     * @returns {this}
     */
    reset(delay) {
        this.#job = null;
        if (this.#id) this.#dequeue();
        if (typeof delay !== Type.Number) return this;
        this.#delay = delay;
        return this;
    }

    /**
     * @param {() => void} callback,
     */
    #queue(callback) {
        const handler = () => { this.#id = null; callback(); };
        switch (this.#delay) {
            case Delay.Redraw:
            case Delay.Idle:
                this.#id = Laters.add(LaterType[this.#delay], handler);
                break;
            default:
                this.#id = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, this.#delay, handler);
        }
    }

    #dequeue() {
        if (this.#id) switch (this.#delay) {
            case Delay.Redraw:
            case Delay.Idle:
                Laters.remove(this.#id);
                break;
            default: GLib.source_remove(this.#id);
        }
        this.#id = null;
    }

}

export class Jobs {

    /** @type {Map<*, Set<Job>>} */
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
        if (!this.#jobs) return null;
        return this.#add(client, new Job(job => this.#remove(client, job), delay));
    }

    /**
     * @param {*} client
     * @return {boolean}
     */
    hasClient(client) {
        return this.#jobs?.has(client);
    }

    /**
     * @param {*} client
     * @returns {this}
     */
    removeAll(client) {
        if (!client) return this;
        const jobs = this.#jobs?.get(client);
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
        const jobs = this.#jobs.get(client) ?? new Set();
        jobs.add(job);
        this.#jobs.set(client, jobs);
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
        if (!jobs.size) this.#jobs.delete(client);
    }

}
