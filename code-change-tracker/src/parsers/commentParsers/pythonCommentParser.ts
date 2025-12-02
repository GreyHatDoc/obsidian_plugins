/**
 * Python Comment Parser
 *
 * PURPOSE:
 * Extracts comments from Python code with full context.
 * Handles all Python comment styles and tracks multi-line docstrings.
 *
 * SUPPORTED COMMENT TYPES:
 * - Single-line: # comments
 * - Multi-line docstrings: triple-quote strings (triple-single or triple-double)
 * - Block comments: Multiple # lines in sequence
 *
 * PYTHON-SPECIFIC HANDLING:
 * - Triple-quote strings can be docstrings (content comments)
 * - Distinguishes between docstrings and regular strings by position
 * - Handles indentation properly (Python-significant whitespace)
 * - Tracks docstring context (module, class, function level)
 *
 * ALGORITHM:
 * 1. Check if currently in multi-line docstring (from previous line)
 *    - If yes, accumulate content and check for closing triple-quote
 *    - Return complete docstring when marker found
 * 2. If not in docstring, check for single-line comments (#)
 * 3. Check for docstring start (triple-quote at start of statement)
 * 4. Extract parent context using indentation and previous declarations
 * 5. Create CommentInterface and return
 *
 * EDGE CASES HANDLED:
 * - String literals containing # character (not treated as comments)
 * - Triple-quoted strings in the middle of expressions
 * - Mixed indentation levels (track function and class scope)
 * - Empty lines and lines with only whitespace
 * - Docstrings after function/class definitions
 */

import { BaseCommentParser, AccumulatingComment } from './baseCommentParser';
import { CommentInterface } from '../codeParser';

/**
 * Extended comment tracker for Python with indentation awareness
 * Helps identify scope context for docstring association
 */
interface PythonAccumulatingComment extends AccumulatingComment {
    indentation: number;  // Indentation level where docstring starts
}

export class PythonCommentParser extends BaseCommentParser {
    protected language: string = 'Python';

    /**
     * Track the current indentation level
     * Used to determine scope (module, class, function)
     */
    private currentIndentation: number = 0;

    /**
     * Stack of recent definitions at different indentation levels
     * Used to associate docstrings with the appropriate function/class
     * Structure: Map[indentation] = symbolName
     */
    private scopeStack: Map<number, string> = new Map();

    /**
     * Override the reset method to also clear Python-specific state
     */
    public reset(): void {
        super.reset();
        this.currentIndentation = 0;
        this.scopeStack.clear();
    }

    /**
     * Extract comments from a single line of Python code
     *
     * RETURNS:
     * - Empty array: no complete comments on this line
     * - Array with one or more items: complete comments found
     *
     * @param line - Source code line to analyze
     * @param lineNumber - One-indexed line number in file
     * @returns Completed CommentInterface objects (may be empty)
     */
    public extractCommentsFromLine(
        line: string,
        lineNumber: number
    ): CommentInterface[] {
        const completedComments: CommentInterface[] = [];

        // Update indentation tracking
        this.updateIndentation(line);

        // CASE 1: Currently accumulating a multi-line docstring
        if (this.currentComment !== null) {
            const pythonComment = this.currentComment as PythonAccumulatingComment;

            // Add this line to accumulation
            pythonComment.content.push(line);

            // Check for closing triple-quote marker
            const tripleQuote = '"""';
            if (line.includes(tripleQuote)) {
                // Find the closing marker position
                const closingIdx = line.indexOf(tripleQuote);

                // Get content up to closing marker
                const lastLine = line.substring(0, closingIdx);
                pythonComment.content[pythonComment.content.length - 1] = lastLine;

                // Join all accumulated lines and clean
                const fullContent = pythonComment.content.join('\n');
                const cleanedContent = this.cleanCommentContent(
                    fullContent,
                    true
                );

                // Get parent symbol from scope
                const parentSymbol =
                    pythonComment.parentElement ||
                    this.scopeStack.get(pythonComment.indentation);

                const comment = this.createComment(
                    cleanedContent,
                    'docstring',
                    pythonComment.startLine,
                    lineNumber,
                    parentSymbol
                );

                completedComments.push(comment);

                // Clear the accumulator
                this.currentComment = null;
            }

            return completedComments;
        }

        const trimmedLine = line.trim();

        // Empty lines don't produce comments
        if (this.isEmpty(trimmedLine)) {
            return completedComments;
        }

        // CASE 2: Check for single-line comment (#)
        const hashIdx = line.indexOf('#');
        if (hashIdx !== -1 && !this.isInString(line, hashIdx)) {
            // Make sure it's not in a string literal
            const commentContent = this.removeCommentMarker(line, '#');

            const comment = this.createComment(
                commentContent,
                'line',
                lineNumber,
                lineNumber,
                this.getParentSymbol()
            );

            completedComments.push(comment);

            // Update scope if this line has a definition
            this.updateScope(line);

            return completedComments;
        }

        // CASE 3: Check for docstring start (triple-quoted string)
        const tripleDoubleIdx = line.indexOf('"""');
        const tripleSingleIdx = line.indexOf("'''");

        let docstringStart = -1;
        let quoteMarker = '';

        if (tripleDoubleIdx !== -1) {
            docstringStart = tripleDoubleIdx;
            quoteMarker = '"""';
        } else if (tripleSingleIdx !== -1 && tripleSingleIdx < docstringStart) {
            docstringStart = tripleSingleIdx;
            quoteMarker = "'''";
        }

        // Only treat as docstring if it appears to be starting a documentation block
        // (not in the middle of an expression)
        if (
            docstringStart !== -1 &&
            this.looksLikeDocstringStart(line, docstringStart)
        ) {
            // Get content after opening triple-quote
            let afterMarker = line.substring(docstringStart + quoteMarker.length);

            // Check if docstring closes on same line
            const closingIdx = afterMarker.indexOf(quoteMarker);

            if (closingIdx !== -1) {
                // Single-line docstring
                let docstringContent = afterMarker.substring(0, closingIdx);
                docstringContent = this.cleanCommentContent(docstringContent);

                const comment = this.createComment(
                    docstringContent,
                    'docstring',
                    lineNumber,
                    lineNumber,
                    this.getParentSymbol()
                );

                completedComments.push(comment);
            } else {
                // Multi-line docstring starts here
                const pythonComment: PythonAccumulatingComment = {
                    content: [afterMarker],
                    type: 'docstring',
                    startLine: lineNumber,
                    parentElement: this.getParentSymbol(),
                    indentation: this.currentIndentation,
                };

                this.currentComment = pythonComment;
            }
        }

        // Update scope for function/class definitions
        this.updateScope(line);

        return completedComments;
    }

    /**
     * Extract indentation level (spaces) from a line
     *
     * @param line - Line to measure
     * @returns Number of leading spaces
     */
    private getIndentationLevel(line: string): number {
        let spaces = 0;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === ' ') {
                spaces++;
            } else if (line[i] === '\t') {
                // Treat tab as 4 spaces (Python convention)
                spaces += 4;
            } else {
                break;
            }
        }
        return spaces;
    }

    /**
     * Update current indentation level based on line
     *
     * @param line - Current line being processed
     */
    private updateIndentation(line: string): void {
        const trimmed = line.trim();
        if (!this.isEmpty(trimmed)) {
            this.currentIndentation = this.getIndentationLevel(line);
        }
    }

    /**
     * Update scope tracking when we find a function or class definition
     *
     * @param line - Line that may contain a definition
     */
    private updateScope(line: string): void {
        const trimmed = line.trim();
        const indent = this.getIndentationLevel(line);

        // Remove any prior scopes at deeper indentation levels
        for (const [key] of this.scopeStack) {
            if (key >= indent && key !== indent) {
                this.scopeStack.delete(key);
            }
        }

        // Check for function definition
        const funcMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\(/);
        if (funcMatch) {
            this.scopeStack.set(indent + 4, funcMatch[1]);  // 4-space indent is standard
            this.previousSymbol = funcMatch[1];
            return;
        }

        // Check for class definition
        const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)/);
        if (classMatch) {
            this.scopeStack.set(indent + 4, classMatch[1]);
            this.previousSymbol = classMatch[1];
            return;
        }
    }

    /**
     * Get the most appropriate parent symbol for comments
     * Based on scope stack and indentation
     *
     * @returns Parent symbol name or undefined
     */
    private getParentSymbol(): string | undefined {
        // Look for symbol at current or lower indentation
        for (const [indent, symbol] of this.scopeStack) {
            if (indent <= this.currentIndentation) {
                return symbol;
            }
        }

        // Fall back to previously tracked symbol
        return this.previousSymbol || undefined;
    }

    /**
     * Check if a given position is inside a string literal
     *
     * This is used to ensure we don't treat # inside strings as comment markers.
     *
     * @param line - Line to analyze
     * @param position - Position to check
     * @returns true if position is inside a string
     */
    private isInString(line: string, position: number): boolean {
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < position && i < line.length; i++) {
            const char = line[i];

            // Handle string boundaries (single or double quote)
            if ((char === '"' || char === "'") && !inString) {
                // Check for triple-quote
                if (
                    i + 2 < line.length &&
                    line[i + 1] === char &&
                    line[i + 2] === char
                ) {
                    i += 2;  // Skip the triple-quote
                }
                inString = true;
                stringChar = char;
            } else if (char === stringChar && inString) {
                // Check if it's escaped
                if (i === 0 || line[i - 1] !== '\\') {
                    inString = false;
                }
            }
        }

        return inString;
    }

    /**
     * Determine if a triple-quoted string looks like a docstring
     *
     * HEURISTICS:
     * - Appears at or near the start of a line (after indentation and possibly after colon)
     * - Follows a function, class, or module definition
     * - Not in the middle of an expression
     *
     * @param line - Line containing the triple-quote
     * @param quoteIndex - Position of the triple-quote
     * @returns true if this looks like a docstring, not a regular string
     */
    private looksLikeDocstringStart(line: string, quoteIndex: number): boolean {
        // Get everything before the triple-quote
        const beforeQuote = line.substring(0, quoteIndex).trim();

        // If there's nothing before it (or just a colon), it's likely a docstring
        if (this.isEmpty(beforeQuote) || beforeQuote === ':') {
            return true;
        }

        // If the previous line was a function/class definition, this is likely a docstring
        // This is a heuristic - check if there are operators that suggest string is part of expression
        const hasOperatorBefore =
            beforeQuote.includes('=') ||
            beforeQuote.includes('+') ||
            beforeQuote.includes('(');

        return !hasOperatorBefore;
    }
}
