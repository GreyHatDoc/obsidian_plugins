/**
 * Rust Comment Parser
 *
 * PURPOSE:
 * Extracts comments from Rust code with full context.
 * Handles all Rust comment styles and tracks multi-line comments.
 *
 * SUPPORTED COMMENT TYPES:
 * - Single-line: double-slash comments
 * - Inner doc: triple-slash or double-slash-bang comments
 * - Outer doc: triple-slash comments at statement level
 * - Multi-line: slash-star...star-slash comments
 * - Doc comments: slash-star-star documentation comments
 *
 * RUST-SPECIFIC HANDLING:
 * - Distinguishes between inner doc comments (//!) and outer doc (///)
 * - Identifies doc comments with doc attributes (/// and /** patterns)
 * - Tracks module, struct, enum, trait, and function contexts
 * - Handles attribute macros (# attributes on code elements)
 * - Processes impl blocks and trait implementations
 * - Supports lifetime annotations and generic parameters
 *
 * ALGORITHM:
 * 1. Check if currently in multi-line comment (from previous line)
 *    - If yes, accumulate content and check for end marker
 *    - Return complete comment when marker found
 * 2. If not in multi-line, check for comment start markers
 *    - Double-slash variants: Extract and return immediately
 *    - Slash-star or slash-star-star: Multi-line start initialize accumulator
 * 3. Extract parent context (module, struct, function name)
 * 4. Determine comment type (line vs docstring)
 * 5. Create CommentInterface and return
 *
 * EDGE CASES HANDLED:
 * - String literals and raw strings containing markers
 * - Character literals containing quote marks
 * - Attributes before definitions (still associate comment with definition)
 * - Generic type parameters with angle brackets
 * - Nested comments (Rust supports nested block comments)
 */

import { BaseCommentParser, AccumulatingComment } from './baseCommentParser';
import { CommentInterface } from '../codeParser';

/**
 * Extended accumulating comment for Rust with nesting support
 */
interface RustAccumulatingComment extends AccumulatingComment {
    nestLevel: number;  // For tracking nested Rust comments
}

export class RustCommentParser extends BaseCommentParser {
    protected language: string = 'Rust';

    /**
     * Track nesting depth for slash-star comments
     * Rust supports nested block comments
     */
    private commentNestLevel: number = 0;

    /**
     * Override reset to clear Rust-specific state
     */
    public reset(): void {
        super.reset();
        this.commentNestLevel = 0;
    }

    /**
     * Extract comments from a single line of Rust code
     *
     * STATE MANAGEMENT:
     * - currentComment tracks multi-line comment accumulation
     * - null means no multi-line comment in progress
     * - commentNestLevel tracks nesting depth
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

        // CASE 1: Currently accumulating a multi-line comment
        if (this.currentComment !== null) {
            const rustComment = this.currentComment as RustAccumulatingComment;

            // Add this line to accumulation
            rustComment.content.push(line);

            // Check for nested comment opening (Rust supports nested comments)
            const openIdx = this.findCommentStartInLine(line);
            if (openIdx !== -1 && !this.isInString(line, openIdx)) {
                rustComment.nestLevel++;
            }

            // Check for comment closing marker
            const closeIdx = this.findCommentEndInLine(line);
            if (closeIdx !== -1) {
                rustComment.nestLevel--;

                if (rustComment.nestLevel === 0) {
                    // This closes the multi-line comment
                    const lastLine = line.substring(0, closeIdx);
                    rustComment.content[rustComment.content.length - 1] = lastLine;

                    // Join all accumulated lines and clean
                    const fullContent = rustComment.content.join('\n');
                    const cleanedContent = this.cleanCommentContent(fullContent);

                    const comment = this.createComment(
                        cleanedContent,
                        rustComment.type,
                        rustComment.startLine,
                        lineNumber,
                        rustComment.parentElement
                    );

                    completedComments.push(comment);

                    // Multi-line comment is now complete
                    this.currentComment = null;

                    // Check if there's a declaration after comment close
                    const afterClose = line.substring(closeIdx + 2);
                    const afterSymbol = this.extractSymbolName(afterClose);
                    if (afterSymbol) {
                        this.previousSymbol = afterSymbol;
                    }
                }
            }

            return completedComments;
        }

        // CASE 2: Not in multi-line comment, check for comment markers
        // Rust supports: //, ///, //!, /*, /**, /*!
        const doubleSlashIdx = this.findCommentMarker(line, '//');
        const tripleSlashIdx = this.findCommentMarker(line, '///');
        const innerDocIdx = this.findCommentMarker(line, '//!');
        const multiLineIdx = this.findCommentMarker(line, '/*');
        const docMultiIdx = this.findCommentMarker(line, '/**');
        const innerDocMultiIdx = this.findCommentMarker(line, '/*!');

        // Determine which marker comes first (more specific markers take precedence)
        let commentStartIdx = -1;
        let commentMarker = '';
        let isDocComment = false;

        // Check in order of specificity
        const markers = [
            { idx: docMultiIdx, marker: '/**', isDoc: true },
            { idx: innerDocMultiIdx, marker: '/*!', isDoc: true },
            { idx: innerDocIdx, marker: '//!', isDoc: true },
            { idx: tripleSlashIdx, marker: '///', isDoc: true },
            { idx: multiLineIdx, marker: '/*', isDoc: false },
            { idx: doubleSlashIdx, marker: '//', isDoc: false },
        ];

        for (const m of markers) {
            if (
                m.idx !== -1 &&
                (commentStartIdx === -1 || m.idx < commentStartIdx)
            ) {
                commentStartIdx = m.idx;
                commentMarker = m.marker;
                isDocComment = m.isDoc;
            }
        }

        // No comment found on this line
        if (commentStartIdx === -1) {
            // Check for code element declaration
            const potentialSymbol = this.extractSymbolName(line);
            if (potentialSymbol) {
                this.previousSymbol = potentialSymbol;
            }
            return completedComments;
        }

        // Extract content before comment (for context)
        const beforeComment = line.substring(0, commentStartIdx);
        const beforeSymbol = this.extractSymbolName(beforeComment);
        if (beforeSymbol) {
            this.previousSymbol = beforeSymbol;
        }

        // CASE 2A: Single-line comments (all // variants)
        if (
            commentMarker === '//' ||
            commentMarker === '///' ||
            commentMarker === '//!'
        ) {
            const commentContent = this.removeCommentMarker(line, commentMarker);

            const comment = this.createComment(
                commentContent,
                isDocComment ? 'docstring' : 'line',
                lineNumber,
                lineNumber,
                this.previousSymbol || undefined
            );

            completedComments.push(comment);
            return completedComments;
        }

        // CASE 2B: Multi-line comment start (/* or /** or /*!)
        let afterMarker = line.substring(commentStartIdx + commentMarker.length);
        const closingIdx = this.findCommentEndInString(afterMarker);

        if (closingIdx !== -1) {
            // Multi-line comment starts AND ends on same line
            let commentContent = afterMarker.substring(0, closingIdx);
            commentContent = this.cleanCommentContent(commentContent);

            const comment = this.createComment(
                commentContent,
                isDocComment ? 'docstring' : 'block',
                lineNumber,
                lineNumber,
                this.previousSymbol || undefined
            );

            completedComments.push(comment);

            // Check for content after closing marker
            const afterClosing = afterMarker.substring(closingIdx + 2);
            const afterSymbol = this.extractSymbolName(afterClosing);
            if (afterSymbol) {
                this.previousSymbol = afterSymbol;
            }

            return completedComments;
        } else {
            // Multi-line comment starts but doesn't close on this line
            const rustComment: RustAccumulatingComment = {
                content: [afterMarker],
                type: isDocComment ? 'docstring' : 'block',
                startLine: lineNumber,
                parentElement: this.previousSymbol || undefined,
                nestLevel: 1,
            };

            this.currentComment = rustComment;

            return completedComments;
        }
    }

    /**
     * Find comment start marker in a line (for nested comment support)
     *
     * @param line - Line to search
     * @returns Index of marker, or -1 if not found
     */
    private findCommentStartInLine(line: string): number {
        for (let i = 0; i < line.length - 1; i++) {
            if (
                line[i] === '/' &&
                line[i + 1] === '*' &&
                !this.isInString(line, i)
            ) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Find comment end marker in a line
     *
     * @param line - Line to search
     * @returns Index of first character of end marker, or -1 if not found
     */
    private findCommentEndInLine(line: string): number {
        for (let i = 0; i < line.length - 1; i++) {
            if (
                line[i] === '*' &&
                line[i + 1] === '/' &&
                !this.isInString(line, i)
            ) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Find closing marker position in a string portion
     *
     * @param str - String to search
     * @returns Index of first character of closing marker, or -1
     */
    private findCommentEndInString(str: string): number {
        return str.indexOf('*/');
    }

    /**
     * Check if a given position is inside a string literal
     *
     * Handles single-quoted strings, double-quoted strings, raw strings (r"..."),
     * and byte strings (b"..." or br"...").
     *
     * @param line - Line to analyze
     * @param position - Position to check
     * @returns true if position is inside a string
     */
    private isInString(line: string, position: number): boolean {
        let inString = false;
        let stringChar = '';
        let isRawString = false;

        for (let i = 0; i < position && i < line.length; i++) {
            const char = line[i];

            // Check for raw string prefix (r"...", br"...", etc.)
            if (!inString && char === 'r' && i + 1 < line.length && line[i + 1] === '"') {
                isRawString = true;
                inString = true;
                stringChar = '"';
                i++;  // Skip the quote
                continue;
            }

            // Check for byte string prefix (b"..." or b'...')
            if (!inString && char === 'b' && i + 1 < line.length) {
                if (line[i + 1] === '"' || line[i + 1] === "'") {
                    inString = true;
                    stringChar = line[i + 1];
                    i++;  // Skip the quote
                    continue;
                }
            }

            // Check for string start (double or single quote)
            if ((char === '"' || char === "'") && !inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar && inString) {
                // Check for escape character (only in non-raw strings)
                if (!isRawString && i > 0 && line[i - 1] === '\\') {
                    // In Rust raw strings, backslashes are literal
                    continue;
                }

                // String ends
                inString = false;
                isRawString = false;
            }
        }

        return inString;
    }

    /**
     * Determine if line contains a Rust definition
     *
     * PATTERNS MATCHED:
     * - "fn functionName(...)"
     * - "pub fn functionName"
     * - "async fn functionName"
     * - "struct StructName"
     * - "enum EnumName"
     * - "trait TraitName"
     * - "impl TraitName for StructName"
     * - "impl StructName"
     * - "mod moduleName"
     * - "pub struct/enum/trait"
     * - "#[...] definitions" (attributes)
     *
     * @param line - Line to analyze
     * @returns Symbol name if found, null otherwise
     */
    protected extractSymbolName(line: string): string | null {
        // Use parent implementation for common patterns
        const parentResult = super.extractSymbolName(line);
        if (parentResult) {
            return parentResult;
        }

        const trimmed = line.trim();

        // Function: "fn name(" or with modifiers "pub fn", "async fn", etc.
        const funcMatch = trimmed.match(
            /(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([a-zA-Z_]\w*)\s*\(/
        );
        if (funcMatch) return funcMatch[1];

        // Module: "mod name"
        const modMatch = trimmed.match(/mod\s+([a-zA-Z_]\w*)/);
        if (modMatch) return modMatch[1];

        // Impl: "impl TraitName for Type" or "impl Type"
        const implMatch = trimmed.match(
            /impl\s+(?:.*\s+for\s+)?([a-zA-Z_]\w*)/
        );
        if (implMatch) return implMatch[1];

        // Enum variant (if not already caught by parent)
        const enumMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*[,{(]/);
        if (enumMatch && !trimmed.startsWith('for ')) {
            return enumMatch[1];
        }

        return null;
    }
}
