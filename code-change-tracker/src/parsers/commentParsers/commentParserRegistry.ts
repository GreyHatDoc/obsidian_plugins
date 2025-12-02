/**
 * Comment Parser Registry
 *
 * PURPOSE:
 * Central factory and dispatcher for language-specific comment parsers.
 * Provides a consistent interface for parsing comments from any supported language.
 *
 * RESPONSIBILITIES:
 * 1. Maintain singleton instances of all comment parsers
 * 2. Route comments extraction requests to the appropriate parser
 * 3. Manage parser state across file processing
 * 4. Determine language from file extension
 * 5. Provide utilities for working with comment collections
 *
 * DESIGN PATTERN: Factory + Registry
 * - Single responsibility: Route to correct parser
 * - Creates parser instances lazily
 * - Maintains cache of parser instances for reuse
 *
 * USAGE EXAMPLE:
 * ```typescript
 * const registry = CommentParserRegistry.getInstance();
 * const lines = sourceCode.split('\n');
 * const allComments: CommentInterface[] = [];
 *
 * registry.resetParserForFile('myFile.ts');
 *
 * lines.forEach((line, idx) => {
 *   const comments = registry.extractComments(line, idx + 1, 'typescript');
 *   allComments.push(...comments);
 * });
 * ```
 *
 * SUPPORTED LANGUAGES:
 * - TypeScript (.ts, .tsx, .js, .jsx)
 * - Python (.py, .pyi)
 * - C++ (.cpp, .cc, .cxx, .h, .hpp, .hxx)
 * - Scala (.scala)
 * - Rust (.rs)
 */

import { CommentInterface } from '../codeParser';
import { BaseCommentParser } from './baseCommentParser';
import { TypeScriptCommentParser } from './typescriptCommentParser';
import { PythonCommentParser } from './pythonCommentParser';
import { CppCommentParser } from './cppCommentParser';
import { ScalaCommentParser } from './scalaCommentParser';
import { RustCommentParser } from './rustCommentParser';

/**
 * Language type enumeration
 */
export type CommentParserLanguage =
    | 'typescript'
    | 'python'
    | 'cpp'
    | 'scala'
    | 'rust';

/**
 * File extension to language mapping
 */
const EXTENSION_LANGUAGE_MAP: Record<string, CommentParserLanguage> = {
    // TypeScript and JavaScript
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'typescript',
    '.jsx': 'typescript',
    '.mjs': 'typescript',
    '.cjs': 'typescript',

    // Python
    '.py': 'python',
    '.pyi': 'python',

    // C++
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'cpp',
    '.h': 'cpp',
    '.hpp': 'cpp',
    '.hxx': 'cpp',

    // Scala
    '.scala': 'scala',

    // Rust
    '.rs': 'rust',
};

/**
 * Singleton registry for managing comment parsers
 *
 * Lazy-loads parser instances and routes parsing requests to the appropriate language.
 */
export class CommentParserRegistry {
    /**
     * Singleton instance
     */
    private static instance: CommentParserRegistry;

    /**
     * Cache of parser instances by language
     */
    private parsers: Map<CommentParserLanguage, BaseCommentParser> = new Map();

    /**
     * Currently active file extension (used for parser selection)
     */
    private activeLanguage: CommentParserLanguage | null = null;

    /**
     * Private constructor (singleton pattern)
     */
    private constructor() { }

    /**
     * Get singleton instance of the registry
     *
     * @returns Singleton CommentParserRegistry instance
     */
    public static getInstance(): CommentParserRegistry {
        if (!CommentParserRegistry.instance) {
            CommentParserRegistry.instance = new CommentParserRegistry();
        }
        return CommentParserRegistry.instance;
    }

    /**
     * Get or create a parser instance for a language
     *
     * Lazy-loads parsers on first request, caches them for reuse.
     *
     * @param language - Language identifier
     * @returns Parser instance for the language
     * @throws Error if language is not supported
     */
    private getParser(language: CommentParserLanguage): BaseCommentParser {
        // Return cached parser if available
        if (this.parsers.has(language)) {
            return this.parsers.get(language)!;
        }

        // Create new parser for language
        let parser: BaseCommentParser;

        switch (language) {
            case 'typescript':
                parser = new TypeScriptCommentParser();
                break;

            case 'python':
                parser = new PythonCommentParser();
                break;

            case 'cpp':
                parser = new CppCommentParser();
                break;

            case 'scala':
                parser = new ScalaCommentParser();
                break;

            case 'rust':
                parser = new RustCommentParser();
                break;

            default:
                throw new Error(`Unsupported language: ${language}`);
        }

        // Cache and return
        this.parsers.set(language, parser);
        return parser;
    }

    /**
     * Determine language from file extension
     *
     * Maps file extensions to language types. Supports all common variations.
     *
     * EXAMPLES:
     * - "myfile.ts" → "typescript"
     * - "script.py" → "python"
     * - "code.cpp" → "cpp"
     * - "model.scala" → "scala"
     * - "program.rs" → "rust"
     *
     * @param filePath - Path or filename to analyze
     * @returns Language type, or null if extension not recognized
     */
    public getLanguageFromPath(filePath: string): CommentParserLanguage | null {
        // Extract extension
        const lastDot = filePath.lastIndexOf('.');
        if (lastDot === -1) {
            return null;
        }

        const extension = filePath.substring(lastDot).toLowerCase();
        return EXTENSION_LANGUAGE_MAP[extension] || null;
    }

    /**
     * Reset parser state for a new file
     *
     * Call this when starting to parse a new file. Clears multi-line comment state
     * and other per-file tracking that the parser maintains.
     *
     * IMPORTANT: Must be called before parsing each new file to ensure clean state.
     *
     * @param filePath - Path of the file being parsed
     * @throws Error if file extension is not recognized
     */
    public resetParserForFile(filePath: string): void {
        const language = this.getLanguageFromPath(filePath);

        if (!language) {
            throw new Error(
                `Cannot determine language for file: ${filePath}. Unsupported file type.`
            );
        }

        this.activeLanguage = language;
        const parser = this.getParser(language);
        parser.reset();
    }

    /**
     * Extract comments from a single line
     *
     * Routes the request to the appropriate language-specific parser.
     * The parser maintains state across calls for the current file.
     *
     * USAGE:
     * Must call resetParserForFile() first to set the active language.
     *
     * @param line - Source code line to analyze
     * @param lineNumber - One-indexed line number in file
     * @param language - Optional language override (if not set by resetParserForFile)
     * @returns Array of extracted comments (may be empty)
     * @throws Error if no language specified and none active
     */
    public extractComments(
        line: string,
        lineNumber: number,
        language?: CommentParserLanguage
    ): CommentInterface[] {
        const lang = language || this.activeLanguage;

        if (!lang) {
            throw new Error(
                'No language specified. Call resetParserForFile() or pass language parameter.'
            );
        }

        const parser = this.getParser(lang);
        return parser.extractCommentsFromLine(line, lineNumber);
    }

    /**
     * Extract comments from all lines in a source file
     *
     * High-level utility for parsing an entire file at once.
     * Handles state reset and aggregates all comments.
     *
     * @param sourceCode - Complete source code as string
     * @param filePath - Path of the file (used to determine language)
     * @returns Array of all extracted comments
     * @throws Error if file type not supported
     */
    public extractAllComments(
        sourceCode: string,
        filePath: string
    ): CommentInterface[] {
        this.resetParserForFile(filePath);

        const lines = sourceCode.split('\n');
        const allComments: CommentInterface[] = [];

        lines.forEach((line, index) => {
            const comments = this.extractComments(line, index + 1);
            allComments.push(...comments);
        });

        return allComments;
    }

    /**
     * Get language of currently active parser
     *
     * @returns Current language, or null if no parser is active
     */
    public getActiveLanguage(): CommentParserLanguage | null {
        return this.activeLanguage;
    }

    /**
     * Check if a language is supported
     *
     * @param language - Language to check
     * @returns true if the language has a parser implementation
     */
    public isLanguageSupported(language: string): boolean {
        const normalizedLanguage = language.toLowerCase() as CommentParserLanguage;
        return Object.values<string>(['typescript', 'python', 'cpp', 'scala', 'rust']).includes(
            normalizedLanguage
        );
    }

    /**
     * Get list of supported file extensions
     *
     * @returns Array of supported extensions (e.g., ['.ts', '.py', '.cpp'])
     */
    public getSupportedExtensions(): string[] {
        return Object.keys(EXTENSION_LANGUAGE_MAP);
    }

    /**
     * Get list of supported languages
     *
     * @returns Array of language identifiers
     */
    public getSupportedLanguages(): CommentParserLanguage[] {
        return ['typescript', 'python', 'cpp', 'scala', 'rust'];
    }

    /**
     * Create a new isolated parser instance
     *
     * Useful for parallel processing or when you want independent parser state.
     * Note: Most code should use the singleton registry instead.
     *
     * @param language - Language for the parser
     * @returns New parser instance
     */
    public createNewParser(language: CommentParserLanguage): BaseCommentParser {
        switch (language) {
            case 'typescript':
                return new TypeScriptCommentParser();
            case 'python':
                return new PythonCommentParser();
            case 'cpp':
                return new CppCommentParser();
            case 'scala':
                return new ScalaCommentParser();
            case 'rust':
                return new RustCommentParser();
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }

    /**
     * Clear all cached parser instances
     *
     * Useful for memory management or testing. After clearing, parsers will be
     * recreated on next use.
     */
    public clearCache(): void {
        this.parsers.clear();
        this.activeLanguage = null;
    }

    /**
     * Get debug information about registry state
     *
     * @returns Object with current state information
     */
    public getDebugInfo() {
        return {
            activeLanguage: this.activeLanguage,
            cachedParsers: Array.from(this.parsers.keys()),
            supportedLanguages: this.getSupportedLanguages(),
        };
    }
}
