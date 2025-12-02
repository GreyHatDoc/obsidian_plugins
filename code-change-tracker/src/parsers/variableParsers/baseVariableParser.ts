import { VariableInterface } from '../codeParser';
import { ScopeContextTracker } from './scopeContextTracker';

/**
 * Abstract base class for language-specific variable parsers.
 *
 * DESIGN PHILOSOPHY:
 * - Each parser is responsible for detecting variable declarations in a single line of code
 * - Parsers use regex patterns tuned to each language's syntax
 * - They extract: name, type, visibility modifiers, mutability/constness, scope modifiers
 * - All parsers implement the same interface for consistency in the larger line-by-line iteration loop
 * - Now supports scope tracking: knows if variable is a class member and its visibility
 *
 * IMPLEMENTATION STRATEGY:
 * - Use regex capturing groups to extract components
 * - Validate captured data before creating VariableInterface objects
 * - Return empty array if no variables found (enables safe iteration)
 * - Include startLine/endLine for document tracking
 * - Use ScopeContextTracker to determine class membership and visibility
 *
 * @abstract
 */
export abstract class BaseVariableParser {
    /**
     * Extract variable declarations from a single line of code.
     * This method is called for every line in a file, so it should be efficient.
     *
     * SIGNATURE CHANGE:
     * Now accepts optional scopeContext parameter for class membership tracking.
     * Backwards compatible - scopeContext defaults to undefined (global scope assumed).
     *
     * @param line - The source code line to analyze
     * @param lineNumber - The 1-indexed line number in the file
     * @param scopeContext - Optional ScopeContextTracker for tracking class membership
     * @returns Array of VariableInterface objects found on this line (empty if none)
     *
     * IMPLEMENTATION NOTES:
     * - Return empty array [] if no variables detected (not null/undefined)
     * - Each language parser overrides this with language-specific logic
     * - Regex patterns should avoid backtracking and excessive alternation for performance
     * - Focus on common cases first, then edge cases
     * - Use scopeContext to populate isClassMember, className, scopeType, visibility fields
     */
    abstract extractVariablesFromLine(
        line: string,
        lineNumber: number,
        scopeContext?: ScopeContextTracker
    ): VariableInterface[];

    /**
     * Helper method: Trim and normalize whitespace
     * Useful for cleaning captured regex groups
     */
    protected trim(str: string | undefined): string {
        return (str || '').trim();
    }

    /**
     * Helper method: Check if a string is empty or contains only whitespace
     */
    protected isEmpty(str: string | undefined): boolean {
        return !str || str.trim().length === 0;
    }

    /**
     * Helper method: Check if line appears to be a comment (language-independent check)
     * Each subclass should override with language-specific comment patterns
     */
    protected isCommentLine(line: string): boolean {
        const trimmed = line.trim();
        return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*');
    }

    /**
     * Helper method: Create a VariableInterface object with consistent defaults
     * This ensures all parsed variables have the required fields (startLine, endLine)
     *
     * ENHANCEMENT: Now supports scope context to populate class membership fields
     * If scopeContext is provided, automatically populates:
     * - isClassMember: whether variable is in a class/struct
     * - className: name of the enclosing class
     * - scopeType: type of scope (class, struct, namespace, etc.)
     * - visibility: current visibility context (for C++ public/private/protected)
     *
     * @param name - Variable name
     * @param lineNumber - Line number where variable is declared
     * @param options - Additional options to merge (type, isConst, etc.)
     * @param scopeContext - Optional ScopeContextTracker for populating scope fields
     * @returns VariableInterface with all required and scope-related fields populated
     */
    protected createVariable(
        name: string,
        lineNumber: number,
        options: Partial<VariableInterface> = {},
        scopeContext?: ScopeContextTracker
    ): VariableInterface {
        // Get scope information if context is provided
        const scopeInfo = scopeContext ? scopeContext.getScopeInfo() : ({} as any);

        return {
            name,
            startLine: lineNumber,
            endLine: lineNumber,
            // Merge any explicit options
            ...options,
            // Apply scope information (only if scopeContext provided)
            isClassMember: scopeInfo.isClassMember ?? (options.isClassMember as any),
            className: scopeInfo.className ?? (options.className as any),
            scopeType: (scopeInfo.scopeType ?? (options.scopeType as any)) as any,
            // For visibility: prefer explicit option, then scope context, then undefined
            visibility:
                options.visibility ??
                (scopeInfo.visibility && scopeInfo.visibility !== 'default' ? scopeInfo.visibility : undefined),
            scopePath: scopeInfo.scopePath ?? (options.scopePath as any),
        };
    }
}
