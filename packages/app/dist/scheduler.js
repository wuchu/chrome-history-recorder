"use strict";
/**
 * App Task Scheduler
 *
 * Owns the claim → handler → write-back loop that previously lived in the
 * extension's MV3 service worker. All storage and AI calls are in-process.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
const ai_1 = require("ai");
const media_eligibility_1 = require("./media-eligibility");
const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_RETRY_MAX_DELAY_MS = 120000;
class Scheduler {
    api;
    ai;
    events;
    pollInterval;
    concurrency;
    processing = new Set();
    running = false;
    ticking = false;
    intervalId = null;
    handlers = new Map();
    gate;
    constructor(dependencies) {
        this.api = dependencies.api;
        this.ai = dependencies.ai;
        this.events = dependencies.events;
        this.pollInterval = dependencies.pollInterval ?? 5000;
        this.concurrency = dependencies.config.get().classificationConcurrency;
        this.gate = new media_eligibility_1.MediaEligibilityGate(this.api);
        this.registerHandler('classify', (task) => this.handleClassify(task));
        this.registerHandler('rename', (task) => this.handleRename(task));
    }
    registerHandler(taskType, handler) {
        this.handlers.set(taskType, handler);
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.broadcastSchedulerStatus();
        void this.tick();
        this.intervalId = setInterval(() => {
            void this.tick();
        }, this.pollInterval);
    }
    stop() {
        if (!this.running && !this.intervalId)
            return;
        this.running = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.broadcastSchedulerStatus();
    }
    pause() {
        this.stop();
    }
    resume() {
        this.start();
    }
    isRunning() {
        return this.running;
    }
    kick() {
        void this.tick();
    }
    /**
     * Run one claim/dispatch cycle. Exposed for tests and manual triggers.
     */
    async runOnce() {
        await this.tick();
    }
    getSchedulerStatus() {
        return {
            state: this.running ? 'running' : 'paused',
            running: this.running,
            processing: this.processing.size,
            concurrency: this.concurrency,
        };
    }
    updateConcurrency(concurrency) {
        this.concurrency = Math.max(1, Math.floor(concurrency));
        this.broadcastSchedulerStatus();
        void this.tick();
    }
    getQueueStatus() {
        return this.api.getQueueStatus();
    }
    async enqueueTask(taskType, hash, options = {}) {
        const result = this.gate.enqueue(taskType, hash, {
            priority: options.priority ?? 5,
            maxAttempts: options.maxAttempts,
            requeue: options.requeue ?? false,
        });
        if (result.skipped) {
            // Ineligible media never enters the pending queue; surface the terminal
            // outcome so the UI can explain why no AI work will run.
            this.emitSkipped(taskType, hash, result.reason ?? 'Media is not processable');
            this.broadcastQueueUpdated();
            return result.success;
        }
        if (result.success) {
            this.events.emit('task:queued', {
                task_type: taskType,
                hash,
                requeue: Boolean(options.requeue),
            });
            if (taskType === 'classify') {
                this.events.emit('classify:queued', { hash });
            }
            this.broadcastQueueUpdated();
            void this.tick();
        }
        return result.success;
    }
    async enqueue(hash, priority = 5) {
        return this.enqueueTask('classify', hash, { priority });
    }
    async enqueuePair(hash) {
        await Promise.allSettled([
            this.enqueueTask('classify', hash),
            this.enqueueTask('rename', hash),
        ]);
    }
    async requeueTask(taskType, hash) {
        const reason = this.gate.ineligibleReason(hash);
        if (reason) {
            const success = this.markSkipped(taskType, hash, reason);
            return { success: false, skipped: success, reason };
        }
        const result = this.api.requeueTask({ taskType, hash });
        if (result.success) {
            this.events.emit('task:queued', { task_type: taskType, hash, requeue: true });
            this.broadcastQueueUpdated();
            void this.tick();
        }
        return { success: result.success, skipped: false };
    }
    async requeueAll(taskType) {
        const result = this.api.requeueAll({
            taskType,
            ineligibleMimeTypes: this.gate.ineligibleMimeTypes(),
        });
        this.broadcastQueueUpdated();
        if (result.count > 0)
            void this.tick();
        return result.count;
    }
    async retryFailed(taskType) {
        const result = this.api.retryFailedTasks({
            taskType,
            ineligibleMimeTypes: this.gate.ineligibleMimeTypes(),
        });
        this.broadcastQueueUpdated();
        if (result.count > 0)
            void this.tick();
        return result.count;
    }
    async clearQueue(taskType) {
        this.api.clearQueue({ taskType });
        this.broadcastQueueUpdated();
    }
    async recoverStale() {
        const result = this.api.recoverStaleProcessingTasks();
        if (result.count > 0) {
            this.broadcastQueueUpdated();
        }
        return result.count;
    }
    async handleClassify(task) {
        const result = await this.ai.classifyTagsByHash(task.target_hash);
        if (result.tags.length === 0) {
            throw new Error('AI returned no tags');
        }
        const applied = this.api.applyClassification({
            hash: task.target_hash,
            tags: result.tags,
            aliases: result.aliases,
            confidence: result.confidence,
            modelUsed: result.model,
        });
        this.events.emit('tags:updated', {
            tags: this.api.listTags({ limit: 200 }),
            counts: this.api.getTagCounts(),
        });
        return {
            tags: applied.tags,
            confidence: result.confidence,
            model_used: result.model,
        };
    }
    async handleRename(task) {
        const result = await this.ai.renameByHash(task.target_hash);
        if (!result.suggestedName || result.suggestedName === task.target_hash) {
            throw new Error('AI returned no usable filename');
        }
        this.api.updateMetadata({
            hash: task.target_hash,
            updates: { ai_filename: result.suggestedName },
        });
        return {
            ai_filename: result.suggestedName,
            model_used: result.model,
        };
    }
    async tick() {
        if (!this.running || this.ticking)
            return;
        if (!this.ai.isAvailable())
            return;
        const free = this.concurrency - this.processing.size;
        if (free <= 0)
            return;
        this.ticking = true;
        try {
            // Only claim task types this scheduler owns. The media archive runner
            // claims its own `archive` tasks so AI pause/Ollama availability cannot
            // block archiving.
            const tasks = this.api.claimTasks(free, Array.from(this.handlers.keys()));
            for (const task of tasks) {
                const key = `${task.task_type}:${task.target_hash}`;
                if (this.processing.has(key))
                    continue;
                this.processing.add(key);
                this.broadcastSchedulerStatus();
                void this.runTask(task).finally(() => {
                    this.processing.delete(key);
                    this.broadcastSchedulerStatus();
                    void this.tick();
                });
            }
            if (tasks.length > 0) {
                this.broadcastQueueUpdated();
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.warn('[Scheduler] Failed to claim tasks:', message);
        }
        finally {
            this.ticking = false;
        }
    }
    async runTask(task) {
        const { task_type: taskType, target_hash: hash } = task;
        const startedPayload = { task_type: taskType, hash };
        this.broadcastEvent('task:started', startedPayload);
        if (taskType === 'classify')
            this.broadcastEvent('classify:started', { hash });
        if (taskType === 'rename')
            this.broadcastEvent('rename:started', { hash });
        this.broadcastQueueUpdated();
        try {
            const handler = this.handlers.get(taskType);
            if (!handler) {
                throw new Error(`No handler registered for task type: ${taskType}`);
            }
            const result = await handler(task);
            this.api.updateTaskStatus({ taskType, hash, status: 'completed' });
            const payload = { task_type: taskType, hash, ...(result ?? {}) };
            this.broadcastEvent('task:completed', payload);
            if (taskType === 'classify') {
                this.broadcastEvent('classify:complete', payload);
                this.broadcastEvent('file:classified', payload);
            }
            if (taskType === 'rename') {
                this.broadcastEvent('rename:complete', payload);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            if ((0, ai_1.isUnprocessableMediaError)(error)) {
                // Permanent: the media cannot produce a representative image. Mark it
                // skipped once; retrying the same bytes can never succeed.
                this.api.updateTaskStatus({ taskType, hash, status: 'skipped', error: message });
                this.emitSkipped(taskType, hash, message);
                console.warn(`[Scheduler] ${taskType} skipped for ${hash}: ${message}`);
                return;
            }
            this.api.updateTaskStatus({
                taskType,
                hash,
                status: 'failed',
                error: message,
                retryDelayMs: this.retryDelayFor(task.attempts + 1),
            });
            let terminal = false;
            try {
                const rows = this.api.getTasksByHash(hash);
                terminal = rows.find((row) => row.task_type === taskType)?.status === 'failed';
            }
            catch {
                terminal = task.attempts + 1 >= task.max_attempts;
            }
            const payload = { task_type: taskType, hash, error: message, terminal };
            this.broadcastEvent(terminal ? 'task:failed' : 'task:retrying', payload);
            if (taskType === 'classify')
                this.broadcastEvent('classify:failed', payload);
            if (taskType === 'rename')
                this.broadcastEvent('rename:failed', payload);
            console.error(`[Scheduler] ${taskType} failed for ${hash}: ${message}`);
        }
        finally {
            this.broadcastQueueUpdated();
        }
    }
    markSkipped(taskType, hash, reason) {
        const recorded = this.api.recordSkippedTask({ taskType, hash, error: reason });
        if (recorded.success) {
            this.emitSkipped(taskType, hash, reason);
            this.broadcastQueueUpdated();
        }
        return recorded.success;
    }
    emitSkipped(taskType, hash, reason) {
        const payload = { task_type: taskType, hash, error: reason, terminal: true };
        this.broadcastEvent('task:skipped', payload);
        if (taskType === 'classify')
            this.broadcastEvent('classify:skipped', payload);
        if (taskType === 'rename')
            this.broadcastEvent('rename:skipped', payload);
    }
    retryDelayFor(attempt) {
        const delay = DEFAULT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
        return Math.min(delay, DEFAULT_RETRY_MAX_DELAY_MS);
    }
    broadcastEvent(type, data) {
        this.events.emit(type, data);
    }
    broadcastSchedulerStatus() {
        this.events.emit('classify:scheduler', this.getSchedulerStatus());
        this.events.emit('task:scheduler', this.getSchedulerStatus());
    }
    broadcastQueueUpdated() {
        try {
            this.events.emit('queue:updated', {
                ...this.api.getQueueStatus(),
                scheduler: this.getSchedulerStatus(),
            });
        }
        catch (error) {
            console.warn('[Scheduler] Failed to broadcast queue update:', error);
        }
    }
}
exports.Scheduler = Scheduler;
//# sourceMappingURL=scheduler.js.map