/**
 * TypeScript Comment Parser
 *
 * PURPOSE:
 * Extracts comments from TypeScript/JavaScript code with full context.
 * Handles all TypeScript/JS comment styles and tracks multi-line comments.
 *
 * SUPPORTED COMMENT TYPES:
 * - Single-line: double-slash comments
 * - Multi-line: slash-star...star-slash comments
 * - JSDoc/TSDoc: slash-star-star documentation star-slash comments
 *
 * KEY FEATURES:
 * - Preserves comment content formatting
 * - Associates comments with nearby functions and classes
 * - Handles mixed code and comments on same line
 * - Tracks multi-line comment state across line boundaries
 * - Identifies documentation comments (JSDoc and TSDoc)
 *
 * ALGORITHM:
 * 1. Check if currently in multi-line comment (from previous line)
 *    - If yes, accumulate content and check for end marker
 *    - Return complete comment when marker found
 * 2. If not in multi-line, check for comment start markers
 *    - Double-slash: Single-line comment extract and return immediately
 *    - Slash-star or slash-star-star: Multi-line start initialize accumulator
 * 3. Extract parent context (function/class name if available)
 * 4. Create CommentInterface and return
 *
 * EDGE CASES HANDLED:
 * - URLs in comments with double-slash (they appear in string context)
 * - Comments in strings are ignored (tracked via findCommentMarker)
 * - Multiple comments on one line
 * - Empty comments (just markers with no content)
 * - Nested marker-like sequences in comments
 */

import { BaseCommentParser, AccumulatingComment } from './baseCommentParser';
import { CommentInterface } from '../codeParser';

export class TypeScriptCommentParser extends BaseCommentParser {
    protected language: string = 'TypeScript';

    /**
     * Extract comments from a single line of TypeScript code
     *
     * STATE MANAGEMENT:
     * - currentComment tracks multi-line comment accumulation
     * - null means no multi-line comment in progress
     * - Set when slash-star or slash-star-star found, cleared when star-slash found
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
            // Add this line to the accumulation
            this.currentComment.content.push(line);

            // Check if multi-line comment ends on this line
            if (this.checkMultiLineCommentEnd(line)) {
                // Extract content up to the closing marker
                const closingIdx = line.indexOf('*/');
                let lastLine = line.substring(0, closingIdx);

                // Update the last accumulated line with content before closing
                this.currentComment.content[
                    this.currentComment.content.length - 1
                ] = lastLine;

                // Join all accumulated lines and clean
                const fullContent = this.currentComment.content.join('\n');
                const cleanedContent = this.cleanCommentContent(fullContent);

                // Create the completed comment
                const comment = this.createComment(
                    cleanedContent,
                    this.currentComment.type,
                    this.currentComment.startLine,
                    lineNumber,
                    this.currentComment.parentElement || undefined
                );

                completedComments.push(comment);

                // Multi-line comment is now complete, clear state
                this.currentComment = null;

                // Check if there's a code element declaration on this line after comment
                // Example: "  } // end of function"
                const afterClosing = line.substring(closingIdx + 2);
                const potentialSymbol = this.extractSymbolName(afterClosing);
                if (potentialSymbol) {
                    this.previousSymbol = potentialSymbol;
                }
            }

            return completedComments;
        }

        // CASE 2: Not currently in multi-line comment, check for single-line comments
        // Find the position of single-line comment marker
        const singleLineIdx = this.findCommentMarker(line, '//');
        const multiLineStartIdx = this.findCommentMarker(line, '/*');
        const multiLineDocIdx = this.findCommentMarker(line, '/**');

        // Determine which comment marker comes first
        let commentStartIdx = -1;
        let commentMarker = '';

        // Check /** first (it's more specific than /*)
        if (
            multiLineDocIdx !== -1 &&
            (multiLineDocIdx < singleLineIdx || singleLineIdx === -1) &&
            (multiLineDocIdx < multiLineStartIdx || multiLineStartIdx === -1)
        ) {
            commentStartIdx = multiLineDocIdx;
            commentMarker = '/**';
        } else if (
            multiLineStartIdx !== -1 &&
            (multiLineStartIdx < singleLineIdx || singleLineIdx === -1)
        ) {
            commentStartIdx = multiLineStartIdx;
            commentMarker = '/*';
        } else if (singleLineIdx !== -1) {
            commentStartIdx = singleLineIdx;
            commentMarker = '//';
        }

        // No comment found on this line
        if (commentStartIdx === -1) {
            // Check for code element declaration (for associating with next comment)
            const potentialSymbol = this.extractSymbolName(line);
            if (potentialSymbol) {
                this.previousSymbol = potentialSymbol;
            }
            return completedComments;
        }

        // Extract content before comment (for context about scopes)
        const beforeComment = line.substring(0, commentStartIdx);

        // Update context if we found a code element
        const beforeSymbol = this.extractSymbolName(beforeComment);
        if (beforeSymbol) {
            this.previousSymbol = beforeSymbol;
        }

        // CASE 2A: Single-line comment (//)
        if (commentMarker === '//') {
            // Extract everything after //
            const commentContent = this.removeCommentMarker(line, '//');

            const comment = this.createComment(
                commentContent,
                'line',
                lineNumber,
                lineNumber,
                this.previousSymbol || undefined
            );

            completedComments.push(comment);
            return completedComments;
        }

        // CASE 2B: Multi-line comment start (/* or /**)
        // Check if comment closes on same line
        let afterMarker = line.substring(commentStartIdx + commentMarker.length);
        const closingIdx = afterMarker.indexOf('*/');

        if (closingIdx !== -1) {
            // Multi-line comment starts AND ends on same line
            let commentContent = afterMarker.substring(0, closingIdx);
            commentContent = this.cleanCommentContent(commentContent);

            // Determine comment type
            const isDocString = commentMarker === '/**';

            const comment = this.createComment(
                commentContent,
                isDocString ? 'docstring' : 'block',
                lineNumber,
                lineNumber,
                this.previousSymbol || undefined
            );

            completedComments.push(comment);

            // Check if there's a declaration after the closing */
            const afterClosing = afterMarker.substring(closingIdx + 2);
            const afterSymbol = this.extractSymbolName(afterClosing);
            if (afterSymbol) {
                this.previousSymbol = afterSymbol;
            }

            return completedComments;
        } else {
            // Multi-line comment starts but doesn't close on this line
            // Initialize accumulator for multi-line tracking
            const isDocString = commentMarker === '/**';

            this.currentComment = {
                content: [afterMarker],
                type: isDocString ? 'docstring' : 'block',
                startLine: lineNumber,
                parentElement: this.previousSymbol || undefined,
            };

            return completedComments;
        }
    }

    /**
     * Determine if a line contains a TypeScript function or class declaration
     *
     * PATTERNS MATCHED:
     * - "function name("
     * - "const/let/var name = () =>"
     * - "class ClassName"
     * - "interface InterfaceName"
     * - "type TypeName ="
     * - "export function/class/interface/type"
     * - "async function name("
     * - "public/private/protected method("
     *
     * NOTE: This is a heuristic - complex TypeScript patterns may not match.
     * The method is used for best-effort association with nearby comments.
     *
     * @param line - Line to analyze
     * @returns Symbol name if found, null otherwise
     */
    protected extractSymbolName(line: string): string | null {
        // Call parent implementation for common patterns
        const parentResult = super.extractSymbolName(line);
        if (parentResult) {
            return parentResult;
        }

        const trimmed = line.trim();

        // Arrow function: "const name = () =>"
        const arrowMatch = trimmed.match(/(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*\(/);
        if (arrowMatch) return arrowMatch[1];

        // Type definition: "type TypeName = "
        const typeMatch = trimmed.match(/type\s+([a-zA-Z_]\w*)\s*=/);
        if (typeMatch) return typeMatch[1];

        // Interface: "interface InterfaceName"
        const interfaceMatch = trimmed.match(/interface\s+([a-zA-Z_]\w*)/);
        if (interfaceMatch) return interfaceMatch[1];

        return null;
    }
}
