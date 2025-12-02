import { VariableInterface } from '../codeParser';
import { BaseVariableParser } from './baseVariableParser';
import { TypeScriptVariableParser } from './typescriptVariableParser';
import { PythonVariableParser } from './pythonVariableParser';
import { CppVariableParser } from './cppVariableParser';
import { ScalaVariableParser } from './scalaVariableParser';
import { RustVariableParser } from './rustVariableParser';
import { ScopeContextTracker } from './scopeContextTracker';

/**
 * Variable Parser Registry
 *
 * PURPOSE:
 * Manages a collection of language-specific variable parsers and provides
 * a unified interface for extracting variables from code lines.
 *
 * DESIGN:
 * - Factory pattern: Stores instances of language-specific parsers
 * - Maps file extensions to parsers for automatic selection
 * - Provides fallback behavior if parser not found
 * - Can be extended easily by adding new parser implementations
 * - NEW: Maintains ScopeContextTracker for each file to track class/struct membership
 *
 * SCOPE TRACKING:
 * - Each parser instance has an associated ScopeContextTracker
 * - Tracker is updated with each line (for class detection)
 * - Tracker is passed to parser for scope-aware variable extraction
 * - Call resetFileScope() when starting to parse a new file
 *
 * USAGE:
 * ```typescript
 * const registry = new VariableParserRegistry();
 * registry.resetFileScope('typescript'); // Start parsing new file
 * const variables = registry.extractVariablesFromLine('class MyClass {', 1, 'ts');
 * const variables = registry.extractVariablesFromLine('  private x: number;', 2, 'ts');
 * // variables[0].isClassMember === true
 * // variables[0].className === 'MyClass'
 * ```
 *
 * IMPLEMENTATION NOTES:
 * - Each parser implements extractVariablesFromLine(line, lineNumber, scopeContext)
 * - Registry returns empty array if no parser found for language
 * - Language detection via file extension (case-insensitive)
 * - Thread-safe for single file processing (create new registry for parallel processing)
 */
export class VariableParserRegistry {
    /**
     * Map of language names to parser instances
     */
    private parsers: Map<string, BaseVariableParser>;

    /**
     * Map of file extensions to language names
     */
    private extensionMap: Map<string, string>;

    /**
     * ENHANCEMENT: Map of language names to scope context trackers
     * Each language gets its own tracker since we might switch between files
     */
    private scopeTrackers: Map<string, ScopeContextTracker>;

    /**
     * Track the current language being parsed (for scope context)
     */
    private currentLanguage: string = 'unknown';

    /**
     * Constructor: Initialize all language parsers and scope trackers
     *
     * IMPLEMENTATION NOTES:
     * - Instantiate all available parsers
     * - Register extensions for each language
     * - Initialize scope trackers for each language
     * - Could be enhanced to lazy-load parsers on demand
     */
    constructor() {
        this.parsers = new Map();
        this.extensionMap = new Map();
        this.scopeTrackers = new Map();

        // Initialize TypeScript parser
        const tsParser = new TypeScriptVariableParser();
        this.parsers.set('typescript', tsParser);
        this.scopeTrackers.set('typescript', new ScopeContextTracker());
        this.registerExtensions('typescript', ['ts', 'tsx', 'js', 'jsx']);

        // Initialize Python parser
        const pyParser = new PythonVariableParser();
        this.parsers.set('python', pyParser);
        this.scopeTrackers.set('python', new ScopeContextTracker());
        this.registerExtensions('python', ['py', 'pyi']);

        // Initialize C++ parser
        const cppParser = new CppVariableParser();
        this.parsers.set('cpp', cppParser);
        this.scopeTrackers.set('cpp', new ScopeContextTracker());
        this.registerExtensions('cpp', ['cpp', 'cc', 'cxx', 'c++', 'c', 'h', 'hpp', 'hxx', 'h++']);

        // Initialize Scala parser
        const scalaParser = new ScalaVariableParser();
        this.parsers.set('scala', scalaParser);
        this.scopeTrackers.set('scala', new ScopeContextTracker());
        this.registerExtensions('scala', ['scala', 'sc']);

        // Initialize Rust parser
        const rustParser = new RustVariableParser();
        this.parsers.set('rust', rustParser);
        this.scopeTrackers.set('rust', new ScopeContextTracker());
        this.registerExtensions('rust', ['rs']);
    }

    /**
     * Register file extensions for a language
     * Maps extensions to language name for quick lookup
     *
     * IMPLEMENTATION:
     * - Normalizes extensions to lowercase
     * - Stores mapping in extensionMap
     * - Used during construction to build the extension map
     *
     * @param language - Language name (e.g., 'typescript', 'python')
     * @param extensions - Array of file extensions without dot (e.g., ['ts', 'tsx'])
     */
    private registerExtensions(language: string, extensions: string[]): void {
        for (const ext of extensions) {
            this.extensionMap.set(ext.toLowerCase(), language);
        }
    }

    /**
     * Extract variables from a code line using the appropriate language parser
     *
     * ALGORITHM:
     * 1. Determine language from file extension
     * 2. Look up parser for that language
     * 3. Update scope context with current line (for class detection)
     * 4. Call parser with scope context for scope-aware extraction
     * 5. Return extracted variables with class membership info
     *
     * ERROR HANDLING:
     * - Returns empty array if language not supported (graceful degradation)
     * - Does not throw errors (allows caller to continue processing)
     * - Caller should log unsupported language warnings if desired
     *
     * @param line - Source code line to analyze
     * @param lineNumber - 1-indexed line number in file
     * @param fileExtension - File extension without dot (e.g., 'ts', 'py', 'rs')
     * @returns Array of VariableInterface objects found (empty if none or language not supported)
     */
    extractVariablesFromLine(line: string, lineNumber: number, fileExtension: string): VariableInterface[] {
        // Normalize extension to lowercase for consistent lookup
        const normalizedExt = fileExtension.toLowerCase();

        // Look up language for this extension
        const language = this.extensionMap.get(normalizedExt);

        if (!language) {
            // Language not supported - return empty array
            return [];
        }

        // Get parser and scope tracker for language
        const parser = this.parsers.get(language);
        const scopeTracker = this.scopeTrackers.get(language);

        if (!parser) {
            // Parser not registered (shouldn't happen, but defensive programming)
            return [];
        }

        try {
            // ENHANCEMENT: Update scope context with this line first
            if (scopeTracker) {
                scopeTracker.processLine(line, lineNumber, language);
            }

            // Extract variables using language-specific parser with scope context
            return parser.extractVariablesFromLine(line, lineNumber, scopeTracker);
        } catch (error) {
            // If parser throws (shouldn't happen), log and return empty
            console.error(`Error parsing variables from ${language} line ${lineNumber}:`, error);
            return [];
        }
    }

    /**
     * Get list of supported languages
     *
     * USAGE:
     * - Helpful for debugging or logging which languages are supported
     * - Could be exposed via API for UI components
     *
     * @returns Array of supported language names
     */
    getSupportedLanguages(): string[] {
        return Array.from(this.parsers.keys());
    }

    /**
     * Get list of supported file extensions
     *
     * USAGE:
     * - Helpful for validating file types before parsing
     * - Could be used to filter files in file selection dialogs
     *
     * @returns Array of supported file extensions (without dots)
     */
    getSupportedExtensions(): string[] {
        return Array.from(this.extensionMap.keys());
    }

    /**
     * Check if a language is supported
     *
     * @param language - Language name to check
     * @returns true if language has a registered parser, false otherwise
     */
    supportsLanguage(language: string): boolean {
        return this.parsers.has(language.toLowerCase());
    }

    /**
     * Check if a file extension is supported
     *
     * @param extension - File extension to check (without dot)
     * @returns true if extension is supported, false otherwise
     */
    supportsExtension(extension: string): boolean {
        return this.extensionMap.has(extension.toLowerCase());
    }

    /**
     * Reset scope context for a new file
     * Call this when starting to parse a new file to clear class/scope history
     *
     * DESIGN RATIONALE:
     * - Each file starts at global scope (no enclosing class)
     * - Previous file's scope information should not affect new file
     * - All scope trackers are reset to empty state
     *
     * @param language - Language to reset (optional, resets all if not specified)
     */
    resetFileScope(language?: string): void {
        if (language) {
            const tracker = this.scopeTrackers.get(language.toLowerCase());
            if (tracker) {
                tracker.reset();
            }
        } else {
            // Reset all scope trackers
            this.scopeTrackers.forEach((tracker) => tracker.reset());
        }
    }

    /**
     * Get current scope information for a language
     * Useful for debugging or getting context about current parsing position
     *
     * @param language - Language to query
     * @returns Current scope info or undefined if language not found
     */
    getCurrentScopeInfo(language: string) {
        const tracker = this.scopeTrackers.get(language.toLowerCase());
        return tracker ? tracker.getScopeInfo() : undefined;
    }

    /**
     * Get debug information for current scope
     * Shows the current scope hierarchy for a language
     *
     * @param language - Language to debug
     * @returns Debug string showing scope hierarchy
     */
    getDebugScopeInfo(language: string): string {
        const tracker = this.scopeTrackers.get(language.toLowerCase());
        return tracker ? tracker.getDebugInfo() : 'Language not found';
    }
}