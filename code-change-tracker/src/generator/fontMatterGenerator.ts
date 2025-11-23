import { promises } from "dns";
import { App } from "obsidian";

export interface CodeWatcherFrontMatter {
    path: string;
    section: string;
    updateMode: string;
};

export class FontMatterGenerator {
    app: App;
    jsonContent!: string;
    workspace: any;


    constructor(app: App, jsonContent: string) {
        this.app = app;
        this.jsonContent = jsonContent;
        this.workspace = app.workspace;
    }

    readFrontMatter(): string {
        const metadata = this.app.metadataCache.getFileCache(this.workspace.getActiveFile()!)?.frontmatter;
        console.log("FRONTMATTER METADATA:", metadata);
        return metadata ? JSON.stringify(metadata, null, 2) : "";
    }

    addFrontMatter(frontMatter: Array<CodeWatcherFrontMatter> | CodeWatcherFrontMatter): void {
        // First check if the frontmatter is an array or a single object
        const frontMatterToAdd = Array.isArray(frontMatter) ? frontMatter : [frontMatter];

    }
}
