import { App, TFile, Notice, CachedMetadata, MetadataCache } from 'obsidian';
import { FileWatcher, WatchedFile, FileChangeEvent } from '../watchers/fileWatcher';
import { FrontmatterParser, DocumentWatchConfig } from '../parsers/frontmatterParser';
import { SectionManager } from '../section/sectionManager';
import { ParserRegistry } from '../parsers/parserRegistry';
import { MarkdownGenerator, GeneratorOptions } from '../generator/markdownGenerator';
import { GitIntegration } from '../watchers/gitWatcher';
import { FileAnalysis } from '../parsers/codeParser';
import { Watch } from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

//Keep a repository that has when the file was last modified and use the size, modified time to see if it has changed.
// We also want to store this in a json file so that we can load and not have to reparse everything on startup.
// we will keep a map of codeFileIDs that can be used with templates and then also want to keep track of the sections within a document

export interface WatchedCodeFileInfo {
    codeFileID: number;
    codeFilePath: string;
    codeFileSize: number;
    codeFileModified: number;
}
export interface WatchedTemplateInfo {
    templateID: number;
    markdownFilePath: string;
    codeFileID: number;
    lastUpdated: number;
}

class WatchedFilesRepository {
    private watchedTemplateInfoMap: Map<number, WatchedTemplateInfo> = new Map();
    private watchedCodeFileInfoMap: Map<number, WatchedCodeFileInfo> = new Map();

    constructor(private app: App) {
        this.app = app;
    }
    saveToFile(filePath: string): void {
        // Save watched files info to a JSON file
        try {
            const data = {
                watchedCodeFiles: Array.from(this.watchedCodeFileInfoMap.values()),
                watchedTemplateInfo: Array.from(this.watchedTemplateInfoMap.values()),
            };
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (error) {
            console.error(`Error saving watched files to ${filePath}:`, error);
            new Notice(`Failed to save watched files data.`);
        }
    }
    loadFromFile(filePath: string): void {
        // Load watched files info from a JSON file
        try {
            async (path: string) => {
                fetch(path)
                    .then(response => response.json())
                    .then(data => {
                        data.watchedCodeFiles.forEach((info: WatchedCodeFileInfo) => {
                            this.watchedCodeFileInfoMap.set(info.codeFileID, info);
                        });
                        data.watchedTemplateInfo.forEach((info: WatchedTemplateInfo) => {
                            this.watchedTemplateInfoMap.set(info.templateID, info);
                        });
                    });
            };
        } catch (error) {
            console.error(`Error loading watched files from ${filePath}:`, error);
            new Notice(`Failed to load watched files data.`);
        }
    }
    compareFileInfo(codeFileID: number): boolean {
        if (!this.watchedCodeFileInfoMap.has(codeFileID)) {
            return false;
        }
        const storedInfo = this.watchedCodeFileInfoMap.get(codeFileID)!;
        const currentInfo = fs.statSync(storedInfo.codeFilePath);

        return storedInfo.codeFileSize === currentInfo.size &&
            storedInfo.codeFileModified === currentInfo.mtimeMs;
    }
}


export class UpdateCoordinator {
    private fileRepository: WatchedFilesRepository;
    private codeIDArray: number[] = [];

    constructor(
        private app: App,
    ) {
        this.fileRepository = new WatchedFilesRepository(app);
        try {
            this.fileRepository.loadFromFile('watchedFilesData.json');
        } catch (error) {
            console.error('Failed to load watched files data:', error);
        }
    }
    saveRepository(): void {
        try {
            this.fileRepository.saveToFile('watchedFilesData.json');
        } catch (error) {
            console.error('Failed to save watched files data:', error);
        }
    }
    populateCodeIDArray(): void {

    }