/**
 * AI Classify - Directory Watcher
 */
import { Config, Task } from './types.js';
export declare class Watcher {
    private watcher;
    private config;
    private onFileDetected;
    constructor(config: Config, onFileDetected: (task: Task) => void);
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleFileAdded;
}
export declare function scanExistingFiles(config: Config): Promise<Task[]>;
//# sourceMappingURL=watcher.d.ts.map