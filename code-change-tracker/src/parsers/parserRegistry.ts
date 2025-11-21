import { CodeParser } from './codeParser';

export class ParserRegistry {
    private parsers: Map<string, CodeParser> = new Map();
    private extensionMap: Map<string, string> = new Map();

    register(parser: CodeParser): void {
        this.parsers.set(parser.language, parser);

        // Map file extensions to language
        for (const ext of parser.extensions) {
            this.extensionMap.set(ext, parser.language);
        }
    }

    getParserForFile(filePath: string): CodeParser | null {
        const ext = this.getFileExtension(filePath);
        const language = this.extensionMap.get(ext);

        if (!language) return null;
        return this.parsers.get(language) || null;
    }

    getParser(language: string): CodeParser | null {
        return this.parsers.get(language) || null;
    }

    getSupportedLanguages(): string[] {
        return Array.from(this.parsers.keys());
    }

    getSupportedExtensions(): string[] {
        return Array.from(this.extensionMap.keys());
    }

    private getFileExtension(filePath: string): string {
        const match = filePath.match(/\.([^.]+)$/);
        return match ? match[1] : '';
    }
}