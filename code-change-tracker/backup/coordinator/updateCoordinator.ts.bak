import { App, TFile, Notice, CachedMetadata, MetadataCache } from 'obsidian';
import { FileWatcher, WatchedFile, FileChangeEvent } from '../watchers/fileWatcher';
import { FrontmatterParser, DocumentWatchConfig } from '../parsers/frontmatterParser';
import { SectionManager } from '../section/sectionManager';
import { ParserRegistry } from '../parsers/parserRegistry';
import { MarkdownGenerator, GeneratorOptions } from '../generator/markdownGenerator';
import { GitIntegration } from '../watchers/gitWatcher';

export class UpdateCoordinator {
    private fileWatcher: FileWatcher;
    private frontmatterParser: FrontmatterParser;
    private sectionManager: SectionManager;
    private activeWatches: Map<string, DocumentWatchConfig> = new Map();

    constructor(
        private app: App,
        private parserRegistry: ParserRegistry,
        private markdownGenerator: MarkdownGenerator,
        private gitIntegration: GitIntegration | null,
        private generatorOptions: GeneratorOptions
    ) {
        this.fileWatcher = new FileWatcher(app);
        this.frontmatterParser = new FrontmatterParser();
        this.sectionManager = new SectionManager(app);

        // Listen to file changes
        this.fileWatcher.on('file-changed', (event: FileChangeEvent) => {
            this.handleCodeFileChange(event);
        });

        // Listen to markdown file changes
        this.app.metadataCache.on('changed', (file: TFile, data: string, cache: CachedMetadata) => {
            this.handleMarkdownFileChange(file, cache);
        });
    }

    /**
     * Initialize watches for all markdown files with code-watch frontmatter
     */
    async initializeAllWatches(): Promise<void> {
        const markdownFiles = this.app.vault.getMarkdownFiles();

        let watchCount = 0;
        for (const file of markdownFiles) {
            const initialized = await this.initializeWatchesForFile(file);
            if (initialized) {
                watchCount++;
            }
        }

        if (watchCount > 0) {
            new Notice(`Initialized code watching for ${watchCount} document(s)`);
        }
    }

    /**
     * Initialize watches for a specific markdown file
     */
    async initializeWatchesForFile(file: TFile): Promise<boolean> {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata) return false;

        const config = this.frontmatterParser.parseWatchConfig(file, metadata);
        if (!config) return false;

        // Skip if auto-update is disabled
        if (!config.autoUpdate) {
            console.log(`Auto-update disabled for ${file.path}`);
            return false;
        }

        // Store configuration
        this.activeWatches.set(file.path, config);

        // Convert to watched files and start watching
        const watchedFiles = this.frontmatterParser.convertToWatchedFiles(file, config);

        for (const watchedFile of watchedFiles) {
            if (watchedFile.updateMode === 'realtime') {
                this.fileWatcher.watchFile(watchedFile);
                console.log(`Watching ${watchedFile.filePath} for ${file.path}`);
            }
        }

        return true;
    }

    /**
     * Stop watches for a specific markdown file
     */
    stopWatchesForFile(file: TFile): void {
        const config = this.activeWatches.get(file.path);
        if (!config) return;

        const watchedFiles = this.frontmatterParser.convertToWatchedFiles(file, config);

        for (const watchedFile of watchedFiles) {
            this.fileWatcher.unwatchFile(watchedFile.filePath);
        }

        this.activeWatches.delete(file.path);
        console.log(`Stopped watching for ${file.path}`);
    }

    /**
     * Handle changes to code files
     */
    private async handleCodeFileChange(event: FileChangeEvent): Promise<void> {
        const { watchedFile, changeType } = event;

        console.log(`Code file ${changeType}: ${watchedFile.filePath}`);

        // Get target markdown file
        const mdFile = this.app.vault.getAbstractFileByPath(watchedFile.targetMarkdownFile);
        if (!(mdFile instanceof TFile)) {
            console.error(`Target markdown file not found: ${watchedFile.targetMarkdownFile}`);
            return;
        }

        // Parse the code file
        try {
            const parser = this.parserRegistry.getParserForFile(watchedFile.absolutePath);
            if (!parser) {
                console.warn(`No parser available for ${watchedFile.filePath}`);
                return;
            }

            // Read file content
            const fs = require('fs');
            const content = fs.readFileSync(watchedFile.absolutePath, 'utf-8');

            // Parse
            const analysis = parser.parse(content, watchedFile.filePath);

            // Add git info if available
            if (this.gitIntegration) {
                const gitInfo = await this.gitIntegration.getFileInfo(watchedFile.filePath);
                if (gitInfo) {
                    analysis.gitInfo = gitInfo;
                }
            }

            // Generate markdown for this file only
            const documentation = this.markdownGenerator.generate([analysis], this.generatorOptions);

            // Update the section
            const success = await this.sectionManager.replaceSection(
                mdFile,
                watchedFile.targetSection,
                documentation
            );

            if (success) {
                console.log(`✓ Updated ${watchedFile.targetSection} in ${mdFile.name}`);
                new Notice(`📝 Updated ${mdFile.name}`, 2000);
            }

        } catch (error) {
            console.error(`Error processing code file change:`, error);
            new Notice(`Error updating documentation for ${watchedFile.filePath}`);
        }
    }

    /**
     * Handle changes to markdown files (frontmatter updates)
     */
    private async handleMarkdownFileChange(file: TFile, metadata: CachedMetadata): Promise<void> {
        const wasWatching = this.activeWatches.has(file.path);
        const config = this.frontmatterParser.parseWatchConfig(file, metadata);

        if (config && !wasWatching) {
            // New watch configuration added
            await this.initializeWatchesForFile(file);
        } else if (!config && wasWatching) {
            // Watch configuration removed
            this.stopWatchesForFile(file);
        } else if (config && wasWatching) {
            // Configuration changed - restart watches
            this.stopWatchesForFile(file);
            await this.initializeWatchesForFile(file);
        }
    }

    /**
     * Manually trigger update for a specific section
     */
    async manualUpdate(file: TFile, sectionId: string): Promise<void> {
        const config = this.activeWatches.get(file.path);
        if (!config) {
            new Notice('No code-watch configuration found');
            return;
        }

        const watch = config.codeWatch.find(w => w.section === sectionId);
        if (!watch) {
            new Notice(`Section "${sectionId}" not found in configuration`);
            return;
        }

        // Create watched file and trigger update
        const watchedFile: WatchedFile = {
            filePath: watch.path,
            absolutePath: watch.path,
            targetMarkdownFile: file.path,
            targetSection: watch.section,
            updateMode: watch.updateMode,
        };

        await this.handleCodeFileChange({
            watchedFile,
            changeType: 'modified',
            timestamp: new Date(),
        });
    }

    /**
     * Get status of all active watches
     */
    getWatchStatus(): Map<string, DocumentWatchConfig> {
        return new Map(this.activeWatches);
    }

    /**
     * Cleanup - stop all watches
     */
    destroy(): void {
        this.fileWatcher.unwatchAll();
        this.activeWatches.clear();
    }
}