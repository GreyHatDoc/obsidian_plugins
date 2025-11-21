
import { TFile, CachedMetadata } from 'obsidian';
import { WatchedFile } from '../watchers/fileWatcher';

export interface CodeWatchConfig {
    path: string;
    section: string;
    updateMode: 'realtime' | 'manual';
}

export interface DocumentWatchConfig {
    codeWatch: CodeWatchConfig[];
    watchInterval?: number;
    autoUpdate?: boolean;
}

export class FrontmatterParser {
    /**
     * Parse code-watch configuration from file frontmatter
     */
    parseWatchConfig(
        file: TFile,
        metadata: CachedMetadata
    ): DocumentWatchConfig | null {
        const frontmatter = metadata?.frontmatter;

        if (!frontmatter || !frontmatter['code-watch']) {
            return null;
        }

        const codeWatchRaw = frontmatter['code-watch'];

        // Handle single object or array
        const codeWatchArray = Array.isArray(codeWatchRaw)
            ? codeWatchRaw
            : [codeWatchRaw];

        const codeWatch: CodeWatchConfig[] = codeWatchArray
            .filter(item => item && item.path)
            .map(item => ({
                path: item.path,
                section: item.section || this.generateSectionId(item.path),
                updateMode: item['update-mode'] || 'realtime',
            }));

        if (codeWatch.length === 0) {
            return null;
        }

        return {
            codeWatch,
            watchInterval: frontmatter['watch-interval'] || 1000,
            autoUpdate: frontmatter['auto-update'] !== false,
        };
    }

    /**
     * Generate a section ID from file path
     */
    private generateSectionId(filePath: string): string {
        return filePath
            .replace(/[^a-zA-Z0-9]/g, '-')
            .toLowerCase()
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Convert watch config to watched files
     */
    convertToWatchedFiles(
        markdownFile: TFile,
        config: DocumentWatchConfig
    ): WatchedFile[] {
        return config.codeWatch.map(watch => ({
            filePath: watch.path,
            absolutePath: '', // Will be set by fileWatcher
            targetMarkdownFile: markdownFile.path,
            targetSection: watch.section,
            updateMode: watch.updateMode,
        }));
    }
}