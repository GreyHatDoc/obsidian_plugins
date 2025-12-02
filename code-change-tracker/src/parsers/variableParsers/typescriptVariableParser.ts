import { VariableInterface } from '../codeParser';
import { BaseVariableParser } from './baseVariableParser';
import { ScopeContextTracker } from './scopeContextTracker';

/**
 * TypeScript Variable Parser
 *
 * LANGUAGE FEATURES HANDLED:
 * 1. Variable declarations: const, let, var with optional type annotations
 *    Examples: const x = 5; let y: string = "hi"; var z: number;
 *
 * 2. Class properties with visibility and mutability modifiers
 *    Examples: private x: Type; public readonly y: Type = val; protected static z: Type;
 *
 * 3. Function/method parameters (when line contains parameter list)
 *    Examples: (param1: Type, param2?: Type = default)
 *
 * 4. Destructuring patterns (simple cases)
 *    Examples: const { a, b } = obj; let [x, y] = array;
 *
 * REGEX STRATEGY:
 * - Primary pattern: (const|let|var)\s+(\w+)(?:\s*:\s*([^=;,]+?))?(?:\s*=)?
 *   Captures: keyword, name, optional type annotation
 * - Property pattern: (public|private|protected)?\s*(readonly|static)?\s+(\w+)\s*:\s*([^=;]+)
 *   Captures: visibility, modifier, name, type
 * - Avoid matching control structures (if, while, for declarations are filtered)
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Use non-greedy quantifiers (...?) to avoid excessive backtracking
 * - Early exit for comment lines
 * - Single regex execution per pattern (not in loop)
 * - Cache regex objects would be next optimization if needed
 */
export class TypeScriptVariableParser extends BaseVariableParser {
    /**
     * Extract variable declarations from a TypeScript/JavaScript line
     *
     * THOUGHT PROCESS:
     * 1. Skip comments immediately (fast exit)
     * 2. Check for const/let/var declarations (most common case)
     * 3. Check for class properties (visible in class context)
     * 4. Check for destructuring patterns (less common but important)
     * 5. Filter out control structure keywords (if, for, while, function, class)
     * 6. ENHANCEMENT: Use scope context to track class membership and visibility
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

        // Fast path: skip comment lines
        if (this.isCommentLine(line) || this.isEmpty(line)) {
            return variables;
        }

        // PATTERN 1: Variable declarations (const, let, var)
        // Regex explanation:
        // \b(const|let|var)\s+ : Keyword at word boundary
        // (\w+) : Variable name
        // (?:\s*:\s*([^=;,]+?))? : Optional type annotation (: Type)
        // (?:\s*=)? : Optional assignment (=)
        // (?:[;,]|$) : Ends with semicolon, comma, or EOL
        const varDeclRegex = /\b(const|let|var)\s+(\w+)(?:\s*:\s*([^=;,]+?))?(?:\s*=)?(?:[;,]|$)/g;
        let match: RegExpExecArray | null;

        while ((match = varDeclRegex.exec(line)) !== null) {
            const keyword = match[1]; // 'const', 'let', or 'var'
            const name = match[2];
            const typeAnnotation = this.trim(match[3]);

            // Skip if this looks like a control structure keyword being mismatched
            if (['if', 'for', 'while', 'function', 'class'].includes(keyword)) {
                continue;
            }

            variables.push(
                this.createVariable(
                    name,
                    lineNumber,
                    {
                        type: typeAnnotation || undefined,
                        isConst: keyword === 'const',
                        isReadonly: keyword === 'const', // const is effectively readonly
                    },
                    scopeContext
                )
            );
        }

        // PATTERN 2: Class properties with visibility modifiers
        // Regex explanation:
        // (public|private|protected)? : Optional visibility modifier
        // \s*(readonly|static)?\s* : Optional readonly/static modifier
        // (\w+)\s*:\s* : Property name and colon
        // ([^=;,}]+) : Type annotation (avoid greedy match)
        // (?:\s*=)? : Optional assignment
        // (?:[;,}]|$) : Ends with semicolon, comma, brace, or EOL
        const propertyRegex = /(public|private|protected)?\s*(readonly|static)?\s+(\w+)\s*:\s*([^=;,}]+?)(?:\s*=)?(?:[;,}]|$)/g;

        while ((match = propertyRegex.exec(line)) !== null) {
            const visibility = match[1] as 'public' | 'private' | 'protected' | undefined;
            const modifier = match[2]; // 'readonly' or 'static'
            const name = match[3];
            const type = this.trim(match[4]);

            // Avoid duplicates from previous pattern
            if (!variables.some(v => v.name === name && v.startLine === lineNumber)) {
                variables.push(
                    this.createVariable(
                        name,
                        lineNumber,
                        {
                            type,
                            visibility: visibility || 'public',
                            isReadonly: modifier === 'readonly',
                            isStatic: modifier === 'static',
                        },
                        scopeContext
                    )
                );
            }
        }

        // PATTERN 3: Destructuring patterns (simplified - catches simple cases)
        // Examples: const { a, b } = obj; let [x, y] = array;
        // Regex explanation:
        // (const|let|var)\s*[{\[] : Variable keyword followed by destructuring
        // ([a-zA-Z_,\s]+) : Variable names separated by commas
        // [}\]]\s*= : End of destructuring and assignment
        if (!variables.length) {
            const destructuringRegex = /(const|let|var)\s*[{\[]([a-zA-Z_,\s]+)[}\]]\s*=/;
            const destructMatch = line.match(destructuringRegex);

            if (destructMatch) {
                const keyword = destructMatch[1];
                const namesStr = destructMatch[2];

                // Split by comma and create variable for each name
                const names = namesStr.split(',').map(n => this.trim(n)).filter(n => !this.isEmpty(n));

                for (const name of names) {
                    variables.push(
                        this.createVariable(
                            name,
                            lineNumber,
                            {
                                isConst: keyword === 'const',
                            },
                            scopeContext
                        )
                    );
                }
            }
        }

        return variables;
    }
}
