/**
 * AI Classify - Main Module
 */
import { Config, Task } from './types.js';
export declare class AIClassify {
    private config;
    private queue;
    private index;
    private watcher;
    private processing;
    private activeCount;
    constructor(config: Config);
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    addTask(task: Task): Promise<void>;
    private processQueue;
    private processTask;
    private saveState;
    scanAndEnqueue(): Promise<void>;
    getStatus(): {
        queue: {
            pending: number;
            processing: number;
            failed: number;
            total: number;
        };
        indexSize: number;
    };
    clear(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map