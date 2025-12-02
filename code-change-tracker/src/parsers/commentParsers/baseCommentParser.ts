/**
 * Base Comment Parser - Abstract Base Class
 *
 * PURPOSE:
 * Provides common interface and helpers for language-specific comment parsers.
 * All language-specific parsers extend this class and implement language-specific logic.
 *
 * DESIGN PHILOSOPHY:
 * - Each parser handles one language (TypeScript, Python, C++, Scala, Rust)
 * - Parsers process code line-by-line, tracking multi-line comment state
 * - Comments are extracted with full content and metadata
 * - Comments are associated with relevant code elements (functions, classes, etc.)
 * - Parser maintains state across lines (for multi-line comments)
 *
 * KEY RESPONSIBILITIES:
 * 1. Detect comment types (single-line, multi-line, docstring)
 * 2. Extract comment content and clean formatting
 * 3. Track comment boundaries (start/end lines)
 * 4. Associate comments with code elements when possible
 * 5. Maintain consistency across all language implementations
 *
 * COMMENT TYPES:
 * - 'line': Single-line comments (// or # style)
 * - 'block': Multi-line comments (slash-star star-slash style)
 * - 'docstring': Documentation comments (/** style or triple-quote style)
 */

import { CommentInterface } from '../codeParser';

/**
 * Represents a comment being accumulated (for multi-line comments)
 */
export interface AccumulatingComment {
    content: string[];  // Array of lines for building multi-line content
    type: 'line' | 'block' | 'docstring';
    startLine: number;
    parentElement?: string;  // Name of associated function/class if known
}

/**
 * Abstract base class for language-specific comment parsers
 *
 * IMPLEMENTATION CONTRACT:
 * - Subclasses must implement extractCommentsFromLine() method
 * - Subclasses must override any helper methods for language-specific behavior
 * - State (currentComment, etc.) is maintained by parser across lines
 * - Parser is stateful - do NOT reuse across files without reset()
 *
 * @abstract
 */
export abstract class BaseCommentParser {
    /**
     * The language this parser handles
     * Must be set by subclasses
     */
    protected language: string = 'unknown';

    /**
     * Current multi-line comment being accumulated
     * null if no multi-line comment is in progress
     * CRITICAL: Must track across lines to properly detect comment end
     */
    protected currentComment: AccumulatingComment | null = null;

    /**
     * Track the previous symbol declared (class, function, etc.)
     * Used to associate comments with code elements
     * Format: "ClassName::functionName" or just "ClassName" or "functionName"
     */
    protected previousSymbol: string | null = null;

    /**
     * Track current scope (class name, namespace, etc.)
     * Used when parentElement is not yet known
     * Example: inside a class, this would be the class name
     */
    protected currentScope: string | null = null;

    /**
     * Main method to extract comments from a single line
     *
     * ALGORITHM:
     * 1. If multi-line comment is in progress, check for end marker
     * 2. If no multi-line comment, check for comment start markers
     * 3. Extract comment content and metadata
     * 4. Associate with relevant code element if possible
     * 5. Return completed comments (may be empty array)
     *
     * CRITICAL DESIGN:
     * - Parser is stateful - maintains currentComment across lines
     * - Must return empty array if no complete comments on this line
     * - Must call this method for EVERY line, even empty ones
     * - Call reset() when starting new file to clear state
     *
     * @param line - The source code line
     * @param lineNumber - The 1-indexed line number in the file
     * @returns Array of completed CommentInterface objects (may be empty)
     */
    abstract extractCommentsFromLine(
        line: string,
        lineNumber: number
    ): CommentInterface[];

    /**
     * Helper: Trim and normalize whitespace from comment content
     */
    protected trim(str: string | undefined): string {
        return (str || '').trim();
    }

    /**
     * Helper: Check if string is empty or whitespace-only
     */
    protected isEmpty(str: string | undefined): boolean {
        return !str || str.trim().length === 0;
    }

    /**
     * Helper: Remove comment marker from line
     *
     * EXAMPLES:
     * - removeCommentMarker("  // comment", "//") → "comment"
     * - removeCommentMarker("  /* comment", "/*") → "comment"
     * - removeCommentMarker("  # comment", "#") → "comment"
     *
     * @param line - The line containing the comment
     * @param marker - The comment marker to remove (e.g., "//", "#")
     * @returns Content after the marker, trimmed
     */
    protected removeCommentMarker(line: string, marker: string): string {
        const idx = line.indexOf(marker);
        if (idx === -1) return '';
        const afterMarker = line.substring(idx + marker.length);
        return this.trim(afterMarker);
    }

    /**
     * Helper: Clean comment content from markers and formatting
     *
     * REMOVES:
     * - Leading/trailing star from block comment lines
     * - Leading/trailing hash or slash-slash from multi-line content
     * - Excessive whitespace
     * - Empty lines (optional)
     *
     * EXAMPLES:
     * Input: " star This is a comment"
     * Output: "This is a comment"
     *
     * Input with multiline block
     * Output: "Line 1\nLine 2"
     *
     * @param content - Comment content (may include markers)
     * @param preserveEmptyLines - If false, remove empty lines
     * @returns Cleaned comment content
     */
    protected cleanCommentContent(
        content: string,
        preserveEmptyLines: boolean = true
    ): string {
        // Split into lines for processing
        const lines = content.split('\n').map((line) => {
            // Remove leading/trailing whitespace
            let cleaned = line.trim();

            // Remove leading * or # or // markers common in multi-line comments
            if (cleaned.startsWith('*')) {
                cleaned = cleaned.substring(1).trim();
            } else if (cleaned.startsWith('#')) {
                cleaned = cleaned.substring(1).trim();
            } else if (cleaned.startsWith('//')) {
                cleaned = cleaned.substring(2).trim();
            }

            // Remove trailing * (from closing on multi-line comments)
            if (cleaned.endsWith('*')) {
                cleaned = cleaned.substring(0, cleaned.length - 1).trim();
            }

            return cleaned;
        });

        // Filter empty lines if requested
        if (!preserveEmptyLines) {
            return lines.filter((l) => !this.isEmpty(l)).join('\n');
        }

        return lines.join('\n');
    }

    /**
     * Helper: Create a CommentInterface object
     *
     * Standardizes comment creation with consistent defaults and formatting.
     * This ensures all comments have required fields and consistent structure.
     *
     * @param content - The comment content (may be cleaned by caller)
     * @param type - Comment type ('line', 'block', or 'docstring')
     * @param startLine - Line number where comment starts (1-indexed)
     * @param endLine - Line number where comment ends (1-indexed)
     * @param parent - Optional parent symbol (class/function name)
     * @returns Properly formatted CommentInterface
     */
    protected createComment(
        content: string,
        type: 'line' | 'block' | 'docstring',
        startLine: number,
        endLine: number,
        parent?: string
    ): CommentInterface {
        return {
            content: this.trim(content),
            type,
            startLine,
            endLine,
            parent: parent || this.previousSymbol || undefined,
        };
    }

    /**
     * Helper: Detect if line contains a potential code element declaration
     *
     * Used to update previousSymbol for comment association.
     * Checks for common patterns like:
     * - "function name(" → function declaration
     * - "class Name" → class declaration
     * - "def name(" → Python function
     * - "public void method(" → Java-like method
     *
     * DESIGN NOTE:
     * This is heuristic-based, not perfect. It's used to associate comments
     * with nearby code elements when exact tracking isn't possible.
     *
     * @param line - Line to analyze
     * @returns Extracted name if found, null otherwise
     */
    protected extractSymbolName(line: string): string | null {
        const trimmed = line.trim();

        // Function/method patterns
        // Matches: "function name(", "void method(", "def func(", etc.
        const funcMatch = trimmed.match(
            /(?:function|def|pub|private|protected|async|void|int|bool|String|let|const|var|fn)\s+([a-zA-Z_]\w*)\s*\(/
        );
        if (funcMatch) return funcMatch[1];

        // Class/interface patterns
        // Matches: "class Name", "struct Name", "interface Name", "enum Name"
        const classMatch = trimmed.match(
            /(?:class|struct|interface|enum|type|trait)\s+([a-zA-Z_]\w*)/
        );
        if (classMatch) return classMatch[1];

        return null;
    }

    /**
     * Helper: Check if line looks like a docstring/javadoc start
     *
     * Checks for patterns like:
     * - "/**" (JavaDoc/JSDoc/Rust)
     * - "///" (Rust doc)
     * - '"""' or "'''" (Python)
     * - "/*!" (Rust)
     *
     * @param line - Line to check
     * @returns true if appears to be doc comment start
     */
    protected isDocstringStart(line: string): boolean {
        const trimmed = line.trim();
        // Check for doc comment markers
        return (
            trimmed.startsWith('/**') ||
            trimmed.startsWith('///') ||
            trimmed.startsWith('/**!') ||
            trimmed.startsWith('/*!') ||
            trimmed.startsWith('/*!') ||
            trimmed.includes('"""') ||
            trimmed.includes("'''")
        );
    }

    /**
     * Helper: Detect multi-line comment continuation
     *
     * When inside a multi-line comment, checks if this line ends it.
     * Handles nested comments in some languages.
     *
     * IMPORTANT:
     * - This is called when currentComment is not null
     * - Must check for closing marker and language-specific endings
     * - Must handle nested comment starts in some languages
     *
     * @param line - Line to check
     * @returns true if this line ends the multi-line comment
     */
    protected checkMultiLineCommentEnd(line: string): boolean {
        // Default: check for closing marker
        // Subclasses override for language-specific logic
        return line.includes('*/');
    }

    /**
     * Helper: Count opening markers on line
     *
     * Used to detect comment start on mixed lines like:
     * someCode(); // comment
     * x = 5; slash-star comment star-slash
     *
     * Returns index of first comment marker, or -1 if none found.
     *
     * @param line - Line to analyze
     * @param marker - The marker to search for (e.g., "//", "/*")
     * @returns Index of marker, or -1 if not found
     */
    protected findCommentMarker(line: string, marker: string): number {
        // Find marker that's not in a string
        let inStringFlag = false;
        let stringCharacter = '';

        for (let i = 0; i < line.length - marker.length + 1; i++) {
            const char = line[i];

            // Track string boundaries
            if ((char === '"' || char === "'" || char === '`') && !inStringFlag) {
                inStringFlag = true;
                stringCharacter = char;
            } else if (char === stringCharacter && inStringFlag) {
                // Check for escape character
                if (i === 0 || line[i - 1] !== '\\') {
                    inStringFlag = false;
                }
            }

            // If not in string, check for marker
            if (!inStringFlag && line.substring(i, i + marker.length) === marker) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Helper: Reset parser state
     *
     * Call this when starting to parse a new file.
     * Clears all state that tracks across lines (currentComment, previousSymbol, etc.)
     *
     * CRITICAL: Must be called before parsing each new file
     */
    public reset(): void {
        this.currentComment = null;
        this.previousSymbol = null;
        this.currentScope = null;
    }

    /**
     * Helper: Get current parser state (for debugging)
     *
     * Useful for understanding why comments may not be parsed correctly
     * or to debug multi-line comment tracking issues.
     *
     * @returns Object with current state information
     */
    public getDebugInfo() {
        return {
            language: this.language,
            inMultiLineComment: this.currentComment !== null,
            currentCommentType: this.currentComment?.type,
            currentCommentStartLine: this.currentComment?.startLine,
            previousSymbol: this.previousSymbol,
            currentScope: this.currentScope,
        };
    }
}
