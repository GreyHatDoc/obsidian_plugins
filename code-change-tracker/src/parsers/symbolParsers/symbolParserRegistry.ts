/**
 * Symbol Parser Registry
 *
 * PURPOSE:
 * Provides factory pattern and dispatch mechanism for symbol parsers.
 * Acts as a central registry for language-specific parsers.
 *
 * DESIGN PATTERN: Singleton with Factory Method
 * - Single instance of each language parser
 * - Lazy initialization (parsers created on first use)
 * - File extension mapping to language detection
 * - Caching for performance
 *
 * RESPONSIBILITIES:
 * 1. Detect language from file extension
 * 2. Return appropriate parser instance
 * 3. Manage parser lifecycle
 * 4. Provide batch processing utilities
 * 5. Handle unknown languages gracefully
 *
 * SUPPORTED LANGUAGES & EXTENSIONS:
 * - TypeScript: .ts, .tsx
 * - Python: .py
 * - C++: .cpp, .cc, .cxx, .c++, .h, .hpp
 * - Scala: .scala
 * - Rust: .rs
 *
 * USAGE:
 * const registry = SymbolParserRegistry.getInstance();
 * const parser = registry.getParserForFile('myFile.ts');
 * const symbols = parser.parseFile(fileContents);
 *
 * BATCH PROCESSING:
 * const results = registry.parseMultipleFiles(files);
 */

import { BaseSymbolParser } from './baseSymbolParser';
import { TypeScriptSymbolParser } from './typescriptSymbolParser';
import { PythonSymbolParser } from './pythonSymbolParser';
import { CppSymbolParser } from './cppSymbolParser';
import { ScalaSymbolParser } from './scalaSymbolParser';
import { RustSymbolParser } from './rustSymbolParser';
import { CodeSymbol } from '../codeParser';

/**
 * File extension to language mapping
 */
interface LanguageMapping {
    extensions: string[];
    parserClass: new () => BaseSymbolParser;
    name: string;
}

/**
 * Result of parsing a single file
 */
export interface ParseResult {
    filePath: string;
    language: string;
    symbols: CodeSymbol[];
    error?: string;
}

/**
 * Singleton registry for symbol parsers
 */
export class SymbolParserRegistry {
    /**
     * Singleton instance
     */
    private static instance: SymbolParserRegistry;

    /**
     * Cached parser instances (one per language)
     * Reusing instances improves performance via internal caching
     */
    private parsers: Map<string, BaseSymbolParser> = new Map();

    /**
     * Language detection mappings
     */
    private languageMappings: Map<string, LanguageMapping> = new Map();

    /**
     * Private constructor for singleton pattern
     */
    private constructor() {
        this.initializeLanguageMappings();
    }

    /**
     * Get singleton instance of registry
     *
     * PATTERN: Lazy initialization singleton
     * First call creates instance, subsequent calls return same instance
     *
     * @returns Singleton registry instance
     */
    public static getInstance(): SymbolParserRegistry {
        if (!SymbolParserRegistry.instance) {
            SymbolParserRegistry.instance = new SymbolParserRegistry();
        }
        return SymbolParserRegistry.instance;
    }

    /**
     * Initialize language to parser mappings
     *
     * Maps file extensions to parser classes
     * Supports multiple extensions per language
     *
     * MAPPING LOGIC:
     * - TypeScript: .ts, .tsx, .js, .jsx (JavaScript superset)
     * - Python: .py
     * - C++: .cpp, .cc, .cxx, .c++, .h, .hpp, .hxx
     * - Scala: .scala
     * - Rust: .rs
     */
    private initializeLanguageMappings(): void {
        const mappings: LanguageMapping[] = [
            {
                extensions: ['.ts', '.tsx', '.js', '.jsx'],
                parserClass: TypeScriptSymbolParser,
                name: 'TypeScript',
            },
            {
                extensions: ['.py'],
                parserClass: PythonSymbolParser,
                name: 'Python',
            },
            {
                extensions: ['.cpp', '.cc', '.cxx', '.c++', '.h', '.hpp', '.hxx'],
                parserClass: CppSymbolParser,
                name: 'C++',
            },
            {
                extensions: ['.scala'],
                parserClass: ScalaSymbolParser,
                name: 'Scala',
            },
            {
                extensions: ['.rs'],
                parserClass: RustSymbolParser,
                name: 'Rust',
            },
        ];

        for (const mapping of mappings) {
            for (const ext of mapping.extensions) {
                this.languageMappings.set(ext.toLowerCase(), mapping);
            }
        }
    }

    /**
     * Get parser for a specific file
     *
     * LOGIC:
     * 1. Extract file extension
     * 2. Look up language mapping
     * 3. Return cached parser or create new one
     * 4. Reset parser state
     * 5. Return ready-to-use parser
     *
     * @param filePath - Full path to source file
     * @returns Parser instance for the file's language
     * @throws Error if file extension is not supported
     */
    public getParserForFile(filePath: string): BaseSymbolParser {
        // Extract file extension
        const ext = this.getFileExtension(filePath);

        // Look up language mapping
        const mapping = this.languageMappings.get(ext.toLowerCase());

        if (!mapping) {
            throw new Error(`Unsupported file type: ${ext}`);
        }

        // Get or create parser for this language
        const languageName = mapping.name;

        if (!this.parsers.has(languageName)) {
            this.parsers.set(languageName, new mapping.parserClass());
        }

        const parser = this.parsers.get(languageName)!;

        // Reset parser state for fresh parsing
        parser.reset();

        return parser;
    }

    /**
     * Parse a single source file
     *
     * HIGH-LEVEL UTILITY:
     * 1. Get parser for file
     * 2. Split code into lines
     * 3. Process each line
     * 4. Collect symbols
     * 5. Return results with error handling
     *
     * @param filePath - Path to source file
     * @param content - Source code content
     * @returns Parse results including symbols and any errors
     */
    public parseFile(filePath: string, content: string): ParseResult {
        try {
            const parser = this.getParserForFile(filePath);
            const ext = this.getFileExtension(filePath).toLowerCase();
            const mapping = this.languageMappings.get(ext);

            const lines = content.split('\n');
            const allSymbols: CodeSymbol[] = [];

            for (let i = 0; i < lines.length; i++) {
                const lineNumber = i + 1;  // 1-indexed
                const symbols = parser.extractSymbolsFromLine(lines[i], lineNumber);
                allSymbols.push(...symbols);
            }

            return {
                filePath,
                language: mapping?.name || 'Unknown',
                symbols: allSymbols,
            };
        } catch (error) {
            return {
                filePath,
                language: 'Unknown',
                symbols: [],
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Parse multiple source files
     *
     * BATCH PROCESSING:
     * - Processes files sequentially
     * - Collects results for each file
     * - Handles errors per-file
     * - Useful for multi-file analysis
     *
     * @param files - Array of {filePath, content} pairs
     * @returns Array of parse results
     */
    public parseMultipleFiles(
        files: Array<{ filePath: string; content: string }>
    ): ParseResult[] {
        return files.map((file) => this.parseFile(file.filePath, file.content));
    }

    /**
     * Get supported file extensions
     *
     * Useful for:
     * - File filter validation
     * - User documentation
     * - File watching patterns
     *
     * @returns Array of supported extensions (with dots, e.g., ['.ts', '.py'])
     */
    public getSupportedExtensions(): string[] {
        return Array.from(this.languageMappings.keys()).sort();
    }

    /**
     * Get list of supported languages
     *
     * @returns Array of language names
     */
    public getSupportedLanguages(): string[] {
        const languages = new Set<string>();

        for (const mapping of this.languageMappings.values()) {
            languages.add(mapping.name);
        }

        return Array.from(languages).sort();
    }

    /**
     * Get language name for a file
     *
     * Useful for:
     * - UI display
     * - Logging/debugging
     * - Language-specific processing
     *
     * @param filePath - Path to source file
     * @returns Language name or 'Unknown'
     */
    public getLanguageForFile(filePath: string): string {
        const ext = this.getFileExtension(filePath).toLowerCase();
        const mapping = this.languageMappings.get(ext);
        return mapping?.name || 'Unknown';
    }

    /**
     * Extract file extension from path
     *
     * Handles:
     * - Full paths with directories
     * - Multiple extensions (.test.ts)
     * - Files with no extension
     *
     * @param filePath - Path to extract from
     * @returns Extension including dot (e.g., '.ts') or empty string
     */
    private getFileExtension(filePath: string): string {
        // Get last path component (filename)
        const fileName = filePath.split(/[/\\]/).pop() || '';

        // Find extension
        const dotIndex = fileName.lastIndexOf('.');

        if (dotIndex === -1) {
            return '';
        }

        return fileName.substring(dotIndex);
    }

    /**
     * Reset all cached parsers
     *
     * Useful when:
     * - Parsing new set of files
     * - Memory optimization
     * - Testing
     *
     * Clears parser cache but keeps registry functional
     */
    public resetAllParsers(): void {
        for (const parser of this.parsers.values()) {
            parser.reset();
        }
    }

    /**
     * Get parser statistics
     *
     * Useful for:
     * - Debugging
     * - Performance monitoring
     * - Cache analysis
     *
     * @returns Object with cache and parser statistics
     */
    public getStatistics(): {
        cachedParsers: number;
        supportedLanguages: number;
        supportedExtensions: number;
    } {
        return {
            cachedParsers: this.parsers.size,
            supportedLanguages: new Set(
                Array.from(this.languageMappings.values()).map((m) => m.name)
            ).size,
            supportedExtensions: this.languageMappings.size,
        };
    }
}
