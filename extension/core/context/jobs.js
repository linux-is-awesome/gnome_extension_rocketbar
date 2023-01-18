/* exported Jobs */

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import { Type, Delay } from '../enums.js';

class Job {

    #id = null;

    #job = null;

    #delay = null;

    #destroyCallback = null;

    get #currentJob() {
        if (this.#job) return this.#job;
        if (typeof this.#destroyCallback !== Type.Function ||
            typeof this.#delay !== Type.Number) return null;
        this.#job = new Promise(resolve => this.#queue(resolve));
        return this.#job;
    }

    constructor(destroyCallback, delay = Delay.Idle) {
        this.#destroyCallback = destroyCallback;
        this.#delay = delay;
    }

    then(callback) {
        this.#job = this.#currentJob?.then(callback);
        return this;
    }

    catch(callback) {
        this.#job = this.#currentJob?.catch(callback);
        return this;
    }

    finally(callback) {
        this.#job = this.#currentJob?.finally(callback);
        return this;
    }

    destroy() {
        this.reset();
        if (typeof this.#destroyCallback === Type.Function) this.#destroyCallback(this);
        this.#delay = null;
        this.#destroyCallback = null;
    }

    reset() {
        this.#job = null;
        if (this.#id) this.#dequeue();
        return this;
    }

    #queue(callback) {
        const handler = () => this.#dequeue() ?? callback();
        switch (this.#delay) {
            case Delay.Redraw:
                this.#id = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, handler);
                break;
            case Delay.Idle:
                this.#id = Meta.later_add(Meta.LaterType.IDLE, handler);
                break;
            default:
                this.#id = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, this.#delay, handler);
        }
    }

    #dequeue() {
        if (this.#id) switch (this.#delay) {
            case Delay.Redraw:
            case Delay.Idle:
                Meta.later_remove(this.#id);
                break;
            default: GLib.source_remove(this.#id);
        }
        this.#id = null;
    }

}

export class Jobs {

    #jobs = new Map();

    destroy() {
        if (!this.#jobs) return;
        const jobs = this.#jobs;
        this.#jobs = null;
        for (const [_, sourceJobs] of jobs)
            for (const job of sourceJobs) job.destroy();
        
    }

    new(source, delay = Delay.Idle) {
        if (!this.#jobs) return null; 
        return this.#add(source, new Job(job => this.#remove(source, job), delay));
    }

    removeAll(source) {
        if (!source) return this;
        const jobs = this.#jobs?.get(source);
        if (!jobs) return this;
        this.#jobs.delete(source);
        for (const job of jobs) job.destroy();
    }

    #add(source, job) {
        const jobs = this.#jobs.get(source) ?? new Set();
        jobs.add(job);
        this.#jobs.set(source, jobs);
        console.log('DEBUG: Add new job: src size', this.#jobs.size, 'jobs size', jobs.size);
        return job;
    }

    #remove(source, job) {
        const jobs = this.#jobs?.get(source);
        console.log('DEBUG: Remove job init: src size', this.#jobs?.size, 'jobs size', jobs?.size);
        if (!jobs) return;
        if (jobs.has(job)) jobs.delete(job);
        if (!jobs.size) this.#jobs.delete(source);
        console.log('DEBUG: Remove job: src size', this.#jobs.size, 'jobs size', jobs?.size);
    }

}
