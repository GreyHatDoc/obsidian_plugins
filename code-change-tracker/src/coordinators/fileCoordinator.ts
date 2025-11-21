
import { Notice, TFolder, TFile, Vault } from 'obsidian';
import { ParserRegistry } from '../parsers/parserRegistry';
import { FileAnalysis } from '../parsers/codeParser';

export interface ScanOptions {
    includeDotFiles?: boolean;
    excludePatterns?: string[];
    maxDepth?: number;
}

export class FileScanner {
    constructor(
        private vault: Vault,
        private parserRegistry: ParserRegistry
    ) { }

    async scanVaultDirectory(options: ScanOptions = {}): Promise<FileAnalysis[]> {
        const analyses: FileAnalysis[] = [];
        const vaultRoot = this.vault.getRoot();

        const supportedExtensions = new Set(this.parserRegistry.getSupportedExtensions());

        const files = this.vault.getFiles();

        for (const file of files) {
            const ext = file.extension;

            if (!supportedExtensions.has(ext)) continue;
            if (!options.includeDotFiles && file.name.startsWith('.')) continue;
            if (this.shouldExclude(file.path, options.excludePatterns || [])) continue;

            try {
                const content = await this.vault.read(file);
                const parser = this.parserRegistry.getParserForFile(file.path);

                if (parser) {
                    const analysis = parser.parse(content, file.path);
                    analyses.push(analysis);
                }
            } catch (error) {
                console.error(`Error parsing ${file.path}:`, error);
                new Notice(`Failed to parse ${file.path}`);
            }
        }

        return analyses;
    }

    async scanExternalDirectory(
        dirPath: string,
        options: ScanOptions = {}
    ): Promise<FileAnalysis[]> {
        // For scanning directories outside the vault
        // This would use Node.js fs module in a desktop plugin
        const analyses: FileAnalysis[] = [];

        // Implementation depends on whether you're using Node.js or Electron APIs
        // This is a placeholder for the concept

        return analyses;
    }

    private shouldExclude(path: string, patterns: string[]): boolean {
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(path);
        });
    }
}