/**
 * AI Classify - Task Queue Management
 */
import { Queue, Task } from './types.js';
export declare function loadQueue(configDir: string): Promise<Queue>;
export declare function saveQueue(configDir: string, queue: Queue): Promise<void>;
export declare function enqueue(queue: Queue, task: Task): Queue;
export declare function dequeue(queue: Queue): Task | null;
export declare function markComplete(queue: Queue, task: Task): Queue;
export declare function markFailed(queue: Queue, task: Task, error: string): Queue;
export declare function getQueueStats(queue: Queue): {
    pending: number;
    processing: number;
    failed: number;
    total: number;
};
export declare function clearQueue(configDir: string): Promise<void>;
//# sourceMappingURL=queue.d.ts.map