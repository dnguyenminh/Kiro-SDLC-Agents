/**
 * DebouncedPersistence — coalesces rapid writes into one file I/O operation.
 */
export declare class DebouncedPersistence {
    private filePath;
    private debounceMs;
    private timer;
    private pendingData;
    constructor(filePath: string, debounceSeconds?: number);
    /** Schedule a debounced write. Resets timer on each call. */
    scheduleWrite(data: any): void;
    /** Force immediate write if pending. */
    flush(): void;
    /** Load JSON from file. Returns null if missing or corrupt. */
    load(): Record<string, any> | null;
    private doWrite;
}
//# sourceMappingURL=persistence.d.ts.map