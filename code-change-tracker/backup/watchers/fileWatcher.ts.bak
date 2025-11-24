import { App, TFile, Notice, debounce } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface WatchedFile {
    filePath: string;
    absolutePath: string;
    targetMarkdownFile: string;
    targetSection: string;
    updateMode: 'realtime' | 'manual';
    lastModified?: number;
    lastHash?: string;
}

export interface FileChangeEvent {
    watchedFile: WatchedFile;
    changeType: 'modified' | 'created' | 'deleted';
    timestamp: Date;
}

export class FileWatcher extends EventEmitter {
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private watchedFiles: Map<string, WatchedFile> = new Map();
    private vaultPath: string;

    constructor(
        private app: App,
        private defaultInterval: number = 1000
    ) {
        super();
        this.vaultPath = (this.app.vault.adapter as any).basePath;
    }

    /**
     * Start watching a code file
     */
    watchFile(watchedFile: WatchedFile): void {
        const absolutePath = this.resolveAbsolutePath(watchedFile.filePath);
        watchedFile.absolutePath = absolutePath;

        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            console.warn(`File not found: ${absolutePath}`);
            new Notice(`Warning: Code file not found: ${watchedFile.filePath}`);
            return;
        }

        // Store watched file info
        this.watchedFiles.set(absolutePath, watchedFile);

        // Skip if already watching
        if (this.watchers.has(absolutePath)) {
            return;
        }

        console.log(`Starting watch on: ${absolutePath}`);

        // Create debounced handler to prevent multiple rapid fires
        const debouncedHandler = debounce(
            (eventType: string) => this.handleFileChange(absolutePath, eventType),
            this.defaultInterval,
            true
        );

        // Set up file system watcher
        try {
            const watcher = fs.watch(absolutePath, (eventType, filename) => {
                debouncedHandler(eventType);
            });

            this.watchers.set(absolutePath, watcher);

            // Initial parse
            this.handleFileChange(absolutePath, 'initial');

        } catch (error) {
            console.error(`Error watching file ${absolutePath}:`, error);
            new Notice(`Failed to watch file: ${watchedFile.filePath}`);
        }
    }

    /**
     * Stop watching a specific file
     */
    unwatchFile(filePath: string): void {
        const absolutePath = this.resolveAbsolutePath(filePath);

        const watcher = this.watchers.get(absolutePath);
        if (watcher) {
            watcher.close();
            this.watchers.delete(absolutePath);
            this.watchedFiles.delete(absolutePath);
            console.log(`Stopped watching: ${absolutePath}`);
        }
    }

    /**
     * Stop all watchers
     */
    unwatchAll(): void {
        for (const [path, watcher] of this.watchers.entries()) {
            watcher.close();
            console.log(`Stopped watching: ${path}`);
        }
        this.watchers.clear();
        this.watchedFiles.clear();
    }

    /**
     * Get all currently watched files
     */
    getWatchedFiles(): WatchedFile[] {
        return Array.from(this.watchedFiles.values());
    }

    /**
     * Check if a file is being watched
     */
    isWatching(filePath: string): boolean {
        const absolutePath = this.resolveAbsolutePath(filePath);
        return this.watchers.has(absolutePath);
    }

    /**
     * Handle file change events
     */
    private async handleFileChange(absolutePath: string, eventType: string): Promise<void> {
        const watchedFile = this.watchedFiles.get(absolutePath);
        if (!watchedFile) return;

        // Check if file still exists
        if (!fs.existsSync(absolutePath)) {
            this.emit('file-deleted', {
                watchedFile,
                changeType: 'deleted',
                timestamp: new Date(),
            } as FileChangeEvent);
            return;
        }

        // Get file stats
        const stats = fs.statSync(absolutePath);
        const currentModTime = stats.mtimeMs;

        // Check if actually modified (debounce duplicate events)
        if (watchedFile.lastModified && currentModTime === watchedFile.lastModified) {
            return;
        }

        // Read file and compute hash to detect actual content changes
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const contentHash = this.simpleHash(content);

        if (watchedFile.lastHash && contentHash === watchedFile.lastHash) {
            // Content hasn't actually changed
            return;
        }

        // Update tracking info
        watchedFile.lastModified = currentModTime;
        watchedFile.lastHash = contentHash;

        const changeType = eventType === 'initial' ? 'created' : 'modified';

        console.log(`File ${changeType}: ${absolutePath}`);

        // Emit change event
        this.emit('file-changed', {
            watchedFile,
            changeType,
            timestamp: new Date(),
        } as FileChangeEvent);
    }

    /**
     * Resolve relative path to absolute path
     */
    private resolveAbsolutePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        // Resolve relative to vault root
        return path.resolve(this.vaultPath, filePath);
    }

    /**
     * Simple string hash for change detection
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
}