import { Plugin, TFile, Notice, MarkdownView, Menu, Editor, SuggestModal } from 'obsidian';
import CodeDocumentationPlugin from '../main';

export class CodeFileSectionSuggestModal extends SuggestModal<TFile> {
    plugin: CodeDocumentationPlugin;
    resolvePromise: (value: TFile | null) => void;
    supportedExtensions: Set<string>;
    selectedFile: TFile | null = null;
    hasResolved: boolean = false;

    constructor(app: any, plugin: CodeDocumentationPlugin, resolve: (value: TFile | null) => void) {
        super(app);
        this.plugin = plugin;
        // Get supported extensions from parser registry
        console.log("Parser registry:", plugin.parserRegistry);
        this.supportedExtensions = new Set(
            Array.from(plugin.parserRegistry['extensionMap'].keys())
        );
        this.resolvePromise = resolve;
    }

    getSelected(): TFile | null {
        return this.selectedFile;
    }

    getSuggestions(query: string): TFile[] {
        const files = this.app.vault.getFiles();
        console.log("All vault files:", files);
        const codeFiles = files.filter((file) =>
            this.supportedExtensions.has(file.extension)
        );

        if (!query) {
            return codeFiles;
        }

        const lowerQuery = query.toLowerCase();
        return codeFiles.filter((file) =>
            file.path.toLowerCase().includes(lowerQuery)
        );
    }

    renderSuggestion(file: TFile, el: HTMLElement) {
        el.createEl("div", { text: file.path });
        el.createEl("small", { text: file.extension, cls: "code-file-extension" });
    }

    onChooseSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent) {
        this.selectedFile = file;
        this.hasResolved = true;
        console.log("Chosen file:", file);
        console.log("Selected file set to:", this.selectedFile);
        this.resolvePromise(file);
    }

    onClose() {
        console.log("Modal is closing. Selected file before close:", this.selectedFile);
        super.onClose();

        // Delay resolution to allow onChooseSuggestion to complete first
        setTimeout(() => {
            console.log("Closing modal, has resolved:", this.hasResolved);
            // Only resolve if we haven't already resolved in onChooseSuggestion
            if (!this.hasResolved) {
                this.resolvePromise(null);
            }
        }, 0);
    }
}