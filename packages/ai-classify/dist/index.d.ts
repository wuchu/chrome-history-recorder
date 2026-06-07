/**
 * AI Classify - Main Module
 */
import { Config, Task } from './types.js';
export declare class AIClassify {
    private config;
    private configDir;
    private queue;
    private index;
    private watcher;
    private processing;
    private activeCount;
    constructor(config: Config, configDir: string);
    initialize(): Promise<void>;
    /**
     * Migrate old index.json and queue.json from output directory to config directory
     */
    private migrateOldFiles;
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