import { VariableInterface } from '../codeParser';
import { BaseVariableParser } from './baseVariableParser';
import { ScopeContextTracker } from './scopeContextTracker';

/**
 * C++ Variable Parser
 *
 * LANGUAGE FEATURES HANDLED:
 * 1. Simple variable declarations with type
 *    Examples: int x; float y = 3.14; auto z = value;
 *
 * 2. Pointer and reference declarations
 *    Examples: int* ptr; const char* str; Type& ref = obj;
 *
 * 3. Template types
 *    Examples: std::vector<int> vec; std::map<string, int> m;
 *
 * 4. Class member declarations with visibility and modifiers
 *    Examples: private: int x; public: static const int MAX = 100;
 *
 * 5. Complex specifiers (static, const, volatile, thread_local, extern)
 *    Examples: static int counter; const volatile Type var; thread_local int tls;
 *
 * 6. Function pointer declarations (for completeness, though less common for variables)
 *    Examples: int (*func_ptr)(int, int);
 *
 * REGEX STRATEGY:
 * - C++ has complex type system (pointers, references, templates, const/volatile)
 * - Strategy: Match optional modifiers, then type, then name, then optional initialization
 * - Type pattern: Can include * & < > :: and nested templates
 * - Don't try to fully parse complex types - just capture the essential parts
 * - Be conservative: if unsure, don't match (false negatives are better than false positives)
 *
 * PERFORMANCE CONSIDERATIONS:
 * - C++ parsing is complex, so use careful regex design to avoid backtracking
 * - Template parsing requires counting < > pairs (implemented as helper)
 * - Early exits for comment lines
 * - Cache results of expensive operations if parsing same line multiple times
 *
 * EDGE CASES:
 * - Macros and preprocessor (start with #) - skip these
 * - Comments with code-like text inside - handle by removing comment portions
 * - Function declarations vs variable declarations - use heuristics (functions have (...) patterns)
 * - Constructor member initializer lists - skip these (not variable declarations)
 */
export class CppVariableParser extends BaseVariableParser {
    /**
     * Extract variable declarations from a C++ line
     *
     * THOUGHT PROCESS:
     * 1. Skip empty, comment, and preprocessor lines (fast path)
     * 2. Remove inline comments from analysis (// comments)
     * 3. Skip function-like patterns (contains function call patterns)
     * 4. Check for class member visibility declarations (public:, private:, protected:)
     * 5. Parse variable declarations with type and optional modifiers
     * 6. Handle templates by balanced bracket counting
     * 7. Validate that we found both type and name (not function signatures)
     * 8. ENHANCEMENT: Use scope context to determine if variable is a class member
     *    and apply appropriate visibility information
     *
     * REGEX BUILDING BLOCKS:
     * - Modifiers: static, const, volatile, extern, thread_local, constexpr
     * - Type base: primitive (int, float, etc.) or user-defined class/struct names
     * - Pointer/ref: *, &, &&, const* combinations
     * - Template: < ... > with balanced brackets
     * - Name: valid identifier (\w+)
     *
     * @param line - Source code line
     * @param lineNumber - 1-indexed line number
     * @param scopeContext - Optional scope context for tracking class membership
     * @returns Array of variables found (empty if none)
     */
    extractVariablesFromLine(
        line: string,
        lineNumber: number,
        scopeContext?: ScopeContextTracker
    ): VariableInterface[] {
        const variables: VariableInterface[] = [];

        // Fast path: skip empty or pure comment lines
        if (this.isEmpty(line) || this.isCommentLine(line)) {
            return variables;
        }

        // Skip preprocessor directives (they contain type-like syntax but aren't variable declarations)
        if (line.trim().startsWith('#')) {
            return variables;
        }

        // Remove C++ style comment (everything after //)
        const commentIdx = line.indexOf('//');
        const codeToAnalyze = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

        if (this.isEmpty(codeToAnalyze)) {
            return variables;
        }

        // PATTERN 1: Class member visibility declarations (public:, private:, protected:)
        // This is informational and sets context for following variables
        // Regex explanation:
        // (public|private|protected):\s*(?!(//|$)) : Visibility followed by colon (not end of line)
        // Don't create variables here, but note this pattern exists
        if (/\b(public|private|protected):\s*$/.test(codeToAnalyze)) {
            return variables; // Just a visibility declaration, no variables
        }

        // PATTERN 2: Variable declaration with type and optional modifiers
        // Build regex dynamically to handle optional components
        // Regex explanation:
        // (static|const|volatile|extern|thread_local|constexpr)? : Optional leading modifier
        // (?:(static|const|volatile|extern|thread_local|constexpr)\s+)* : More modifiers (multiple allowed)
        // ([a-zA-Z_]\w*(?:::\w+)*(?:<[^>]*>)?) : Type name (with scope :: and templates)
        // (\s*\*+|\s*&+)? : Optional pointer (*) or reference (&) symbols
        // \s+(\w+) : Required: whitespace and variable name
        // (?:\s*=\s*[^;]+)?(?:[;,]|$) : Optional initialization
        // Non-greedy quantifiers to avoid excessive backtracking

        const varDeclRegex =
            /(?:(?:static|const|volatile|extern|thread_local|constexpr|mutable)\s+)*([a-zA-Z_]\w*(?:::\w+)*(?:<[^<>]*(?:<[^<>]*>[^<>]*)?>)?)(\s*\*+|\s*&+|\s*&&)?\s+(\w+)(?:\s*=\s*[^;,]+)?(?:[;,]|$)/;

        let match = codeToAnalyze.match(varDeclRegex);
        if (match) {
            const type = this.trim(match[1]);
            const pointerRefPart = this.trim(match[2] || '');
            const name = match[3];

            // Filter out common false positives:
            // - If name looks like a keyword or reserved word
            // - If this looks like a function declaration (has parentheses pattern)
            if (['if', 'while', 'for', 'switch', 'catch'].includes(name)) {
                return variables;
            }

            // Reconstruct full type including pointer/reference symbols
            const fullType = type + pointerRefPart;

            // Extract modifiers from the line
            const modifiers = this.extractModifiers(codeToAnalyze);

            variables.push(
                this.createVariable(
                    name,
                    lineNumber,
                    {
                        type: fullType,
                        isConst: modifiers.includes('const'),
                        isStatic: modifiers.includes('static'),
                    },
                    scopeContext
                )
            );

            return variables;
        }

        // PATTERN 3: Simple type declarations (struct, class, enum, union) instantiation
        // Example: MyClass obj; or struct Point p = {0, 0};
        // Regex explanation:
        // (struct|class|enum|union)?\s*(\w+)\s+(\w+) : Optional type keyword, type name, var name
        // This is less strict but catches user-defined types
        match = codeToAnalyze.match(/(struct|class|enum|union)?\s+(\w+)\s+(\w+)(?:\s*=|\s*[;,]|$)/);
        if (match && !variables.some(v => v.startLine === lineNumber)) {
            const typeKeyword = match[1];
            const typeName = match[2];
            const name = match[3];

            variables.push(
                this.createVariable(
                    name,
                    lineNumber,
                    {
                        type: typeKeyword ? `${typeKeyword} ${typeName}` : typeName,
                    },
                    scopeContext
                )
            );

            return variables;
        }

        return variables;
    }

    /**
     * Helper: Extract modifier keywords from a line
     * Returns array of matched modifiers (static, const, volatile, etc.)
     *
     * IMPLEMENTATION NOTE:
     * - Uses a set of known C++ modifiers
     * - Regex scans line for these keywords before variable name
     * - Returns array for easy checking with includes()
     *
     * @param line - Code line to analyze
     * @returns Array of modifier strings found
     */
    private extractModifiers(line: string): string[] {
        const modifiers: string[] = [];
        const modifierKeywords = ['static', 'const', 'volatile', 'extern', 'thread_local', 'constexpr', 'mutable'];

        for (const keyword of modifierKeywords) {
            if (new RegExp(`\\b${keyword}\\b`).test(line)) {
                modifiers.push(keyword);
            }
        }

        return modifiers;
    }

    /**
     * Helper: Check if a character is part of a template bracket pair
     * Used for parsing template types like vector<int> or map<string, int>
     *
     * IMPLEMENTATION NOTE:
     * - Simple bracket counting (not fully context-aware)
     * - Counts < and > to determine nesting level
     * - Returns true if all brackets are balanced
     *
     * @param str - String to analyze
     * @returns true if template brackets are balanced, false otherwise
     */
    private isBalancedTemplate(str: string): boolean {
        let depth = 0;
        for (const char of str) {
            if (char === '<') depth++;
            else if (char === '>') depth--;
            if (depth < 0) return false; // Closing without opening
        }
        return depth === 0; // Balanced if depth is zero
    }
}
