/**
 * C++ Comment Parser
 *
 * PURPOSE:
 * Extracts comments from C and C++ code with full context.
 * Handles all C++ comment styles and tracks multi-line comments.
 *
 * SUPPORTED COMMENT TYPES:
 * - Single-line: double-slash comments
 * - Multi-line: slash-star...star-slash comments
 * - Doxygen: slash-star-star or triple-slash documentation comments
 * - Nested comments: Some C++ compilers support nested slash-star comments
 *
 * C++-SPECIFIC HANDLING:
 * - Detects Doxygen documentation markers (slash-star-star and triple-slash)
 * - Tracks scope context (class, namespace, function)
 * - Handles C++ visibility modifiers (public, private, protected)
 * - Processes template declarations
 * - Handles preprocessor directives (they can have comments too)
 *
 * ALGORITHM:
 * 1. Check if currently in multi-line comment (from previous line)
 *    - If yes, accumulate content and check for end marker
 *    - Return complete comment when marker found
 * 2. If not in multi-line, check for comment start markers
 *    - Double-slash: Single-line comment extract and return immediately
 *    - Slash-star or slash-star-star: Multi-line start initialize accumulator
 * 3. Extract parent context (function/class name if available)
 * 4. Determine comment type (regular vs Doxygen documentation)
 * 5. Create CommentInterface and return
 *
 * EDGE CASES HANDLED:
 * - String literals containing comment markers (tracked via findCommentMarker)
 * - Character literals containing quote marks
 * - Preprocessor directives with comments
 * - Nested comments (track depth)
 * - Multiple comments on one line
 */

import { BaseCommentParser, AccumulatingComment } from './baseCommentParser';
import { CommentInterface } from '../codeParser';

/**
 * Extended accumulating comment for C++ with nesting support
 */
interface CppAccumulatingComment extends AccumulatingComment {
    nestLevel: number;  // For tracking nested comments
    isDoxygenComment: boolean;  // Whether this is a Doxygen doc comment
}

export class CppCommentParser extends BaseCommentParser {
    protected language: string = 'C++';

    /**
     * Track nesting depth for slash-star comments
     * Some C++ compilers support nested comments
     */
    private commentNestLevel: number = 0;

    /**
     * Track previous visibility context for member association
     * "public:", "private:", "protected:"
     */
    private currentVisibility: 'public' | 'private' | 'protected' = 'public';

    /**
     * Override reset to clear C++-specific state
     */
    public reset(): void {
        super.reset();
        this.commentNestLevel = 0;
        this.currentVisibility = 'public';
    }

    /**
     * Extract comments from a single line of C++ code
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

        // Update visibility context
        this.updateVisibility(line);

        // CASE 1: Currently accumulating a multi-line comment
        if (this.currentComment !== null) {
            const cppComment = this.currentComment as CppAccumulatingComment;

            // Add this line to accumulation
            cppComment.content.push(line);

            // Check for nested comment opening
            const openIdx = line.indexOf('/*');
            if (openIdx !== -1 && !this.isInString(line, openIdx)) {
                cppComment.nestLevel++;
            }

            // Check for comment closing marker
            const closeIdx = this.findCommentClose(line);
            if (closeIdx !== -1) {
                cppComment.nestLevel--;

                if (cppComment.nestLevel === 0) {
                    // This closes the multi-line comment
                    const lastLine = line.substring(0, closeIdx);
                    cppComment.content[cppComment.content.length - 1] = lastLine;

                    // Join all accumulated lines and clean
                    const fullContent = cppComment.content.join('\n');
                    const cleanedContent = this.cleanCommentContent(fullContent);

                    const comment = this.createComment(
                        cleanedContent,
                        cppComment.isDoxygenComment ? 'docstring' : 'block',
                        cppComment.startLine,
                        lineNumber,
                        cppComment.parentElement
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

        // CASE 2: Not in multi-line comment, check for single-line comments
        const singleLineIdx = this.findCommentMarker(line, '//');
        const multiLineIdx = this.findCommentMarker(line, '/*');
        const doxygenLineIdx = this.findCommentMarker(line, '///');
        const doxygenBlockIdx = this.findCommentMarker(line, '/**');

        // Determine which marker comes first
        let commentStartIdx = -1;
        let commentMarker = '';
        let isDocstring = false;

        // Check in order of specificity
        if (
            doxygenBlockIdx !== -1 &&
            (doxygenBlockIdx < doxygenLineIdx || doxygenLineIdx === -1) &&
            (doxygenBlockIdx < singleLineIdx || singleLineIdx === -1) &&
            (doxygenBlockIdx < multiLineIdx || multiLineIdx === -1)
        ) {
            commentStartIdx = doxygenBlockIdx;
            commentMarker = '/**';
            isDocstring = true;
        } else if (
            doxygenLineIdx !== -1 &&
            (doxygenLineIdx < singleLineIdx || singleLineIdx === -1) &&
            (doxygenLineIdx < multiLineIdx || multiLineIdx === -1)
        ) {
            commentStartIdx = doxygenLineIdx;
            commentMarker = '///';
            isDocstring = true;
        } else if (
            multiLineIdx !== -1 &&
            (multiLineIdx < singleLineIdx || singleLineIdx === -1)
        ) {
            commentStartIdx = multiLineIdx;
            commentMarker = '/*';
        } else if (singleLineIdx !== -1) {
            commentStartIdx = singleLineIdx;
            commentMarker = '//';
        }

        // No comment found
        if (commentStartIdx === -1) {
            // Check for code element declaration
            const potentialSymbol = this.extractSymbolName(line);
            if (potentialSymbol) {
                this.previousSymbol = potentialSymbol;
            }
            return completedComments;
        }

        // Extract content before comment (for scope detection)
        const beforeComment = line.substring(0, commentStartIdx);
        const beforeSymbol = this.extractSymbolName(beforeComment);
        if (beforeSymbol) {
            this.previousSymbol = beforeSymbol;
        }

        // CASE 2A: Single-line comments (// or ///)
        if (commentMarker === '//' || commentMarker === '///') {
            const commentContent = this.removeCommentMarker(line, commentMarker);

            const comment = this.createComment(
                commentContent,
                isDocstring ? 'docstring' : 'line',
                lineNumber,
                lineNumber,
                this.previousSymbol || undefined
            );

            completedComments.push(comment);
            return completedComments;
        }

        // CASE 2B: Multi-line comment start (/* or /**)
        let afterMarker = line.substring(commentStartIdx + commentMarker.length);
        const closingIdx = this.findCommentCloseInString(afterMarker);

        if (closingIdx !== -1) {
            // Multi-line comment starts AND ends on same line
            let commentContent = afterMarker.substring(0, closingIdx);
            commentContent = this.cleanCommentContent(commentContent);

            const comment = this.createComment(
                commentContent,
                isDocstring ? 'docstring' : 'block',
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
            const cppComment: CppAccumulatingComment = {
                content: [afterMarker],
                type: isDocstring ? 'docstring' : 'block',
                startLine: lineNumber,
                parentElement: this.previousSymbol || undefined,
                nestLevel: 1,
                isDoxygenComment: isDocstring,
            };

            this.currentComment = cppComment;

            return completedComments;
        }
    }

    /**
     * Update visibility context based on C++ access specifiers
     *
     * @param line - Line to analyze for visibility keywords
     */
    private updateVisibility(line: string): void {
        const trimmed = line.trim();

        if (trimmed.startsWith('public:')) {
            this.currentVisibility = 'public';
        } else if (trimmed.startsWith('private:')) {
            this.currentVisibility = 'private';
        } else if (trimmed.startsWith('protected:')) {
            this.currentVisibility = 'protected';
        }
    }

    /**
     * Find the closing slash-star marker in a string
     *
     * @param str - String to search
     * @returns Index of first character of closing marker, or -1 if not found
     */
    private findCommentCloseInString(str: string): number {
        return str.indexOf('*/');
    }

    /**
     * Find closing marker position in current line
     *
     * @param line - Line to analyze
     * @returns Index of first character of closing marker, or -1 if not found
     */
    private findCommentClose(line: string): number {
        // Search for closing marker not in string
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
     * Check if a given position is inside a string literal
     *
     * Handles both single and double-quoted strings, and character literals.
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

            // Check for string start (single or double quote)
            if ((char === '"' || char === "'" || char === '`') && !inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar && inString) {
                // Check for escape character
                if (i === 0 || line[i - 1] !== '\\') {
                    inString = false;
                }
            }
        }

        return inString;
    }

    /**
     * Determine if line contains a C++ function or class declaration
     *
     * PATTERNS MATCHED:
     * - "void functionName(..."
     * - "class ClassName {...}"
     * - "struct StructName"
     * - "int method(...) const"
     * - "template<...> class/struct/function"
     * - "namespace ns"
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

        // Method with return type: "ReturnType methodName("
        const methodMatch = trimmed.match(
            /(?:void|int|bool|double|float|string|auto|char|bool|.*?)\s+([a-zA-Z_]\w*)\s*\(/
        );
        if (methodMatch) return methodMatch[1];

        // Namespace: "namespace name"
        const namespaceMatch = trimmed.match(/namespace\s+([a-zA-Z_]\w*)/);
        if (namespaceMatch) return namespaceMatch[1];

        // Template: "template<...> class/struct/function"
        const templateMatch = trimmed.match(
            /template\s*<[^>]*>\s+(?:class|struct|function)?\s*([a-zA-Z_]\w*)/
        );
        if (templateMatch) return templateMatch[1];

        return null;
    }
}
