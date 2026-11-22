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
const event_coalescer_1 = require("./event-coalescer");
const media_eligibility_1 = require("./media-eligibility");
const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_RETRY_MAX_DELAY_MS = 120000;
class Scheduler {
    api;
    ai;
    events;
    pollInterval;
    concurrencyByType = new Map();
    pausedByType = new Map();
    processing = new Set();
    processingCountByType = new Map();
    running = false;
    ticking = false;
    intervalId = null;
    handlers = new Map();
    gate;
    queueCoalescer;
    tagsCoalescer;
    constructor(dependencies) {
        this.api = dependencies.api;
        this.ai = dependencies.ai;
        this.events = dependencies.events;
        this.pollInterval = dependencies.pollInterval ?? 5000;
        const config = dependencies.config.get();
        this.concurrencyByType.set('classify', config.classifyConcurrency);
        this.concurrencyByType.set('rename', config.renameConcurrency);
        this.pausedByType.set('classify', config.classifyPaused);
        this.pausedByType.set('rename', config.renamePaused);
        this.gate = new media_eligibility_1.MediaEligibilityGate(this.api);
        const coalesceWindowMs = dependencies.coalesceWindowMs ?? 250;
        this.queueCoalescer = new event_coalescer_1.EventCoalescer(() => this.flushQueueSnapshot(), coalesceWindowMs);
        this.tagsCoalescer = new event_coalescer_1.EventCoalescer(() => this.flushTagsSnapshot(), coalesceWindowMs);
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
        this.queueCoalescer.cancel();
        this.tagsCoalescer.cancel();
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
        for (const taskType of this.handlers.keys()) {
            this.setPaused(taskType, true);
        }
    }
    resume() {
        for (const taskType of this.handlers.keys()) {
            this.setPaused(taskType, false);
        }
    }
    isRunning() {
        return this.getSchedulerStatus().running;
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
        const byType = {};
        let anyRunning = false;
        let processing = 0;
        for (const taskType of this.handlers.keys()) {
            const state = this.isTaskTypePaused(taskType) ? 'paused' : 'running';
            const typeProcessing = this.processingCount(taskType);
            processing += typeProcessing;
            byType[taskType] = {
                state,
                processing: typeProcessing,
                concurrency: this.getConcurrency(taskType),
            };
            if (state === 'running')
                anyRunning = true;
        }
        return {
            state: anyRunning ? 'running' : 'paused',
            running: anyRunning,
            processing,
            byType,
        };
    }
    updateConcurrency(taskType, concurrency) {
        this.concurrencyByType.set(taskType, Math.max(1, Math.floor(concurrency)));
        this.broadcastSchedulerStatus();
        void this.tick();
    }
    updatePaused(taskType, paused) {
        this.setPaused(taskType, paused);
    }
    setPaused(taskType, paused) {
        this.pausedByType.set(taskType, paused);
        this.broadcastSchedulerStatus();
        if (!paused) {
            void this.tick();
        }
    }
    getConcurrency(taskType) {
        return this.concurrencyByType.get(taskType) ?? 1;
    }
    isTaskTypePaused(taskType) {
        return this.pausedByType.get(taskType) === true;
    }
    processingCount(taskType) {
        return this.processingCountByType.get(taskType) ?? 0;
    }
    beginProcessing(taskType, hash) {
        const key = `${taskType}:${hash}`;
        if (this.processing.has(key))
            return false;
        this.processing.add(key);
        this.processingCountByType.set(taskType, this.processingCount(taskType) + 1);
        return true;
    }
    endProcessing(taskType, hash) {
        const key = `${taskType}:${hash}`;
        if (!this.processing.delete(key))
            return;
        this.processingCountByType.set(taskType, Math.max(0, this.processingCount(taskType) - 1));
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
        this.scheduleTagsSnapshot();
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
        this.ticking = true;
        try {
            // Only claim task types this scheduler owns. The media archive runner
            // claims its own `archive` tasks so AI pause/Ollama availability cannot
            // block archiving.
            let claimedAny = false;
            for (const taskType of this.handlers.keys()) {
                if (this.isTaskTypePaused(taskType))
                    continue;
                const free = this.getConcurrency(taskType) - this.processingCount(taskType);
                if (free <= 0)
                    continue;
                const tasks = this.api.claimTasks(free, [taskType]);
                if (tasks.length === 0)
                    continue;
                claimedAny = true;
                for (const task of tasks) {
                    const hash = task.target_hash;
                    if (!this.beginProcessing(taskType, hash))
                        continue;
                    void this.runTask(task).finally(() => {
                        this.endProcessing(taskType, hash);
                        void this.tick();
                    });
                }
            }
            if (claimedAny) {
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
        const status = this.getSchedulerStatus();
        this.events.emit('task:scheduler', status);
        this.events.emit('classify:scheduler', status);
    }
    scheduleTagsSnapshot() {
        this.tagsCoalescer.schedule();
    }
    flushTagsSnapshot() {
        try {
            this.events.emit('tags:updated', {
                tags: this.api.listTags({ limit: 200 }),
                counts: this.api.getTagCounts(),
            });
        }
        catch (error) {
            console.warn('[Scheduler] Failed to broadcast tag update:', error);
        }
    }
    broadcastQueueUpdated() {
        this.queueCoalescer.schedule();
    }
    flushQueueSnapshot() {
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