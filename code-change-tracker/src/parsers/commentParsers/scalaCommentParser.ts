/**
 * Scala Comment Parser
 *
 * PURPOSE:
 * Extracts comments from Scala code with full context.
 * Handles all Scala comment styles and tracks multi-line comments.
 *
 * SUPPORTED COMMENT TYPES:
 * - Single-line: double-slash comments
 * - Multi-line: slash-star...star-slash comments
 * - Scaladoc: slash-star-star documentation comments
 *
 * SCALA-SPECIFIC HANDLING:
 * - Distinguishes between regular and Scaladoc comments (slash-star-star)
 * - Handles object, class, trait, and case class declarations
 * - Tracks companion objects (object alongside class)
 * - Processes implicit definitions
 * - Handles functional syntax and lambda expressions
 *
 * ALGORITHM:
 * 1. Check if currently in multi-line comment (from previous line)
 *    - If yes, accumulate content and check for end marker
 *    - Return complete comment when marker found
 * 2. If not in multi-line, check for comment start markers
 *    - Double-slash: Single-line comment extract and return immediately
 *    - Slash-star or slash-star-star: Multi-line start initialize accumulator
 * 3. Extract parent context (class, object, trait, function name)
 * 4. Determine comment type (regular vs Scaladoc)
 * 5. Create CommentInterface and return
 *
 * EDGE CASES HANDLED:
 * - String literals and string interpolation with comment markers
 * - Regular expressions containing marker-like sequences
 * - Nested comments (Scala supports nested block comments)
 * - Multiple definitions on one line
 * - Type annotations with complex syntax
 */

import { BaseCommentParser, AccumulatingComment } from './baseCommentParser';
import { CommentInterface } from '../codeParser';

/**
 * Extended accumulating comment for Scala with nesting support
 */
interface ScalaAccumulatingComment extends AccumulatingComment {
    nestLevel: number;  // For tracking nested Scala comments
}

export class ScalaCommentParser extends BaseCommentParser {
    protected language: string = 'Scala';

    /**
     * Track nesting depth for slash-star comments
     * Scala supports nested block comments
     */
    private commentNestLevel: number = 0;

    /**
     * Override reset to clear Scala-specific state
     */
    public reset(): void {
        super.reset();
        this.commentNestLevel = 0;
    }

    /**
     * Extract comments from a single line of Scala code
     *
     * STATE MANAGEMENT:
     * - currentComment tracks multi-line comment accumulation
     * - null means no multi-line comment in progress
     * - commentNestLevel tracks nesting depth for nested comments
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
            const scalaComment = this.currentComment as ScalaAccumulatingComment;

            // Add this line to accumulation
            scalaComment.content.push(line);

            // Check for nested comment opening (Scala supports nested comments)
            const openIdx = this.findCommentStartInLine(line);
            if (openIdx !== -1 && !this.isInString(line, openIdx)) {
                scalaComment.nestLevel++;
            }

            // Check for comment closing marker
            const closeIdx = this.findCommentEndInLine(line);
            if (closeIdx !== -1) {
                scalaComment.nestLevel--;

                if (scalaComment.nestLevel === 0) {
                    // This closes the multi-line comment
                    const lastLine = line.substring(0, closeIdx);
                    scalaComment.content[scalaComment.content.length - 1] = lastLine;

                    // Join all accumulated lines and clean
                    const fullContent = scalaComment.content.join('\n');
                    const cleanedContent = this.cleanCommentContent(fullContent);

                    const comment = this.createComment(
                        cleanedContent,
                        this.isScaladoc(fullContent) ? 'docstring' : 'block',
                        scalaComment.startLine,
                        lineNumber,
                        scalaComment.parentElement
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
        const scaladocIdx = this.findCommentMarker(line, '/**');

        // Determine which marker comes first (Scaladoc is most specific)
        let commentStartIdx = -1;
        let commentMarker = '';

        if (
            scaladocIdx !== -1 &&
            (scaladocIdx < singleLineIdx || singleLineIdx === -1) &&
            (scaladocIdx < multiLineIdx || multiLineIdx === -1)
        ) {
            commentStartIdx = scaladocIdx;
            commentMarker = '/**';
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

        // CASE 2A: Single-line comment (//)
        if (commentMarker === '//') {
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
        let afterMarker = line.substring(commentStartIdx + commentMarker.length);
        const closingIdx = this.findCommentEndInString(afterMarker);

        if (closingIdx !== -1) {
            // Multi-line comment starts AND ends on same line
            let commentContent = afterMarker.substring(0, closingIdx);
            commentContent = this.cleanCommentContent(commentContent);

            const isScaladocComment = commentMarker === '/**';

            const comment = this.createComment(
                commentContent,
                isScaladocComment ? 'docstring' : 'block',
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
            const isScaladoc = commentMarker === '/**';

            const scalaComment: ScalaAccumulatingComment = {
                content: [afterMarker],
                type: isScaladoc ? 'docstring' : 'block',
                startLine: lineNumber,
                parentElement: this.previousSymbol || undefined,
                nestLevel: 1,
            };

            this.currentComment = scalaComment;

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
     * Check if a comment is a Scaladoc documentation comment
     *
     * Scaladoc comments typically have /** markers or contain documentation-style content
     *
     * @param content - Comment content to check
     * @returns true if appears to be Scaladoc
     */
    private isScaladoc(content: string): boolean {
        // If it starts with **, it's Scaladoc by definition
        if (content.trim().startsWith('**')) {
            return true;
        }

        // Check for Scaladoc tags like @param, @return, @throws, @see, @author
        const scaladocTags = /@(param|return|throws|see|author|version|since|deprecated|note|example|group|groupname)/;
        return scaladocTags.test(content);
    }

    /**
     * Check if a given position is inside a string literal
     *
     * Handles single-quoted strings, double-quoted strings, and Scala string interpolation.
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

            // Check for string start
            if ((char === '"' || char === "'" || char === '`') && !inString) {
                // Check for triple-quoted string (Scala multiline)
                if (
                    i + 2 < line.length &&
                    line[i + 1] === char &&
                    line[i + 2] === char
                ) {
                    i += 2;
                }
                inString = true;
                stringChar = char;
            } else if (char === stringChar && inString) {
                // Check for triple-quote ending
                if (
                    stringChar === '"' &&
                    i + 2 < line.length &&
                    line[i + 1] === char &&
                    line[i + 2] === char
                ) {
                    i += 2;
                    inString = false;
                } else if (i === 0 || line[i - 1] !== '\\') {
                    // Regular string end (not escaped)
                    inString = false;
                }
            }

            // Check for string interpolation (s"..." or f"...")
            if (!inString && i < position - 1 && (char === 's' || char === 'f')) {
                if (line[i + 1] === '"') {
                    inString = true;
                    stringChar = '"';
                    i++;  // Skip the quote
                }
            }
        }

        return inString;
    }

    /**
     * Determine if line contains a Scala definition
     *
     * PATTERNS MATCHED:
     * - "class ClassName"
     * - "object ObjectName"
     * - "trait TraitName"
     * - "case class CaseClassName"
     * - "def methodName("
     * - "implicit def/class/object"
     * - "package name"
     * - "sealed class/trait"
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

        // Object: "object Name" or "case object Name"
        const objectMatch = trimmed.match(/(?:case\s+)?object\s+([a-zA-Z_]\w*)/);
        if (objectMatch) return objectMatch[1];

        // Trait: "trait Name"
        const traitMatch = trimmed.match(/trait\s+([a-zA-Z_]\w*)/);
        if (traitMatch) return traitMatch[1];

        // Case class: "case class Name"
        const caseClassMatch = trimmed.match(/case\s+class\s+([a-zA-Z_]\w*)/);
        if (caseClassMatch) return caseClassMatch[1];

        // Package: "package name"
        const packageMatch = trimmed.match(/package\s+([a-zA-Z_]\w*)/);
        if (packageMatch) return packageMatch[1];

        return null;
    }
}
