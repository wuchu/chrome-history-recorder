/**
 * AI Classify - Main Module
 */
import { Config, Task } from './types.js';
export declare class AIClassify {
    private config;
    private configDir;
    private pending;
    private processing;
    private failed;
    private index;
    private watcher;
    private processingFlag;
    private activeCount;
    private eventCount;
    constructor(config: Config, configDir: string);
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    addTask(task: Task): Promise<void>;
    private processQueue;
    private processTask;
    private shouldCompact;
    private doCompact;
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