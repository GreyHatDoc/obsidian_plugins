import { Plugin, TFile, Notice, MarkdownView, Menu, Editor, SuggestModal } from 'obsidian';
import CodeDocumentationPlugin from '../main';

export class CodeFileSuggestModal extends SuggestModal<TFile> {
    plugin: CodeDocumentationPlugin;
    supportedExtensions: Set<string>;

    constructor(app: any, plugin: CodeDocumentationPlugin) {
        super(app);
        this.plugin = plugin;
        // Get supported extensions from parser registry
        this.supportedExtensions = new Set(
            Array.from(plugin.parserRegistry['parsers'].keys())
        );
    }

    getSuggestions(query: string): TFile[] {
        const files = this.app.vault.getFiles();
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
        this.plugin.generateDocumentationForFile(file);
    }
}