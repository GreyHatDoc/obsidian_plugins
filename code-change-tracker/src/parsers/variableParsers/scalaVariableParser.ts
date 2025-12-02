import { VariableInterface } from '../codeParser';
import { BaseVariableParser } from './baseVariableParser';
import { ScopeContextTracker } from './scopeContextTracker';

/**
 * Scala Variable Parser
 *
 * LANGUAGE FEATURES HANDLED:
 * 1. Immutable values (val)
 *    Examples: val x = 5; val name: String = "John"; val list: List[Int] = List(1, 2, 3)
 *
 * 2. Mutable variables (var)
 *    Examples: var x = 5; var counter: Int = 0
 *
 * 3. Type annotations (explicit and inferred)
 *    Examples: val x: Int = 5; val y = func() (inferred)
 *
 * 4. Visibility and access modifiers
 *    Examples: private val x = 1; protected var y = 2; private[package] val z = 3
 *
 * 5. Pattern matching and destructuring
 *    Examples: val (a, b) = (1, 2); val List(head, tail) = list
 *
 * 6. Class constructor parameters (act as properties)
 *    Examples: class Point(val x: Int, val y: Int) - x and y are properties
 *
 * 7. For comprehensions with variable binding
 *    Examples: for (i <- 1 to 10) - i is bound
 *
 * REGEX STRATEGY:
 * - Scala supports both val/var keywords explicitly
 * - Type parameters use square brackets [Type]
 * - Scala is more functional than imperative, so focus on val/var declarations
 * - Pattern matching syntax can be complex, so handle simple cases
 * - Generators (i <- range) in for loops create bindings
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Scala has cleaner syntax than C++ but more flexible than Python
 * - Use straightforward regex patterns
 * - Early exits for comments and non-declaration lines
 * - For comprehensions are less common than val/var, so check those last
 *
 * EDGE CASES:
 * - Complex pattern matching: val (a, b, c @ _*) = tuple
 * - Type bounds: val x: T <: Number = ... (don't try to fully parse)
 * - Implicit parameters: implicit x: Type = ...
 * - Lazy values: lazy val x = expr
 */
export class ScalaVariableParser extends BaseVariableParser {
    /**
     * Extract variable declarations from a Scala line
     *
     * THOUGHT PROCESS:
     * 1. Skip empty and comment lines (fast path)
     * 2. Remove inline comments (//) from analysis
     * 3. Check for val/var keyword declarations (main pattern)
     * 4. Extract visibility modifiers if present (private, protected, private[...])
     * 5. Handle type annotations and inferred types
     * 6. Check for pattern matching/destructuring in val
     * 7. Check for for-comprehension bindings (generators)
     * 8. Filter out control structures that use similar syntax
     *
     * REGEX BUILDING BLOCKS:
     * - Visibility: (private|protected|private\[[^\]]+\])?
     * - Modifiers: (lazy)?
     * - Keyword: (val|var)
     * - Pattern: Simple name (\w+) or destructuring pattern
     * - Type: Optional type annotation after colon
     * - Value: Optional assignment
     *
     * @param line - Source code line
     * @param lineNumber - 1-indexed line number
     * @returns Array of variables found (empty if none)
     */
    extractVariablesFromLine(
        line: string,
        lineNumber: number,
        scopeContext?: ScopeContextTracker
    ): VariableInterface[] {
        const variables: VariableInterface[] = [];

        // Fast path: skip empty or comment lines
        if (this.isEmpty(line) || line.trim().startsWith('//')) {
            return variables;
        }

        // Remove inline comments (everything after //)
        const commentIdx = line.indexOf('//');
        const codeToAnalyze = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

        if (this.isEmpty(codeToAnalyze)) {
            return variables;
        }

        // PATTERN 1: val/var declarations with optional modifiers
        // Regex explanation:
        // (private|protected)? : Optional access modifier
        // (?:\[[^\]]+\])? : Optional scope restriction like [package]
        // (lazy)? : Optional lazy keyword
        // (val|var) : val or var keyword
        // \s+(\w+) : Variable name
        // (?:\s*:\s*([^=\s]+(?:<[^>]+>)?))? : Optional type (including generics)
        // (?:\s*=)? : Optional assignment
        // (?:[;,]|$) : Ends with semicolon, comma, or EOL
        const valVarRegex =
            /(private|protected)?(?:\[[^\]]+\])?(\s+lazy)?(\s+)(val|var)(\s+)(\w+)(?:\s*:\s*([^=\s]+(?:<[^>]+>)?))?(?:\s*=)?(?:[;,]|$)/;

        let match = codeToAnalyze.match(valVarRegex);
        if (match) {
            const visibility = match[1] as 'private' | 'protected' | undefined;
            const isLazy = !!match[2]; // 'lazy' keyword present?
            const keyword = match[4]; // 'val' or 'var'
            const name = match[6];
            const type = match[7] ? this.trim(match[7]) : undefined;

            variables.push(
                this.createVariable(name, lineNumber, {
                    type,
                    visibility: visibility || 'public', // Default to public if not specified
                    isReadonly: keyword === 'val', // val is immutable (readonly)
                    isConst: keyword === 'val', // val is constant (immutable)
                })
            );

            return variables;
        }

        // PATTERN 2: Pattern matching / destructuring in val
        // Examples: val (a, b) = tuple; val List(head, _*) = list; val x :: rest = list
        // Regex explanation:
        // (val|var)\s*[(\[{] : val/var followed by opening bracket for pattern
        // ([^)\]}]+) : Pattern content (variable names)
        // [)\]}]\s*= : Closing bracket and assignment
        if (/\b(val|var)\s*[(\[{]/.test(codeToAnalyze)) {
            const patternMatch = codeToAnalyze.match(/(val|var)\s*[(\[{]([^)\]}]+)[)\]}]\s*=/);
            if (patternMatch) {
                const keyword = patternMatch[1];
                const patternStr = patternMatch[2];

                // Extract variable names from pattern
                // Simple heuristic: split by comma and take word characters
                // Handle cases like: a, b or head, _* or x, y, z
                const names = patternStr
                    .split(/[,;]/)
                    .map(n => this.trim(n).replace(/^\*\s*/, '')) // Remove * from *rest patterns
                    .filter(n => /^[a-zA-Z_]\w*$/.test(n)); // Only valid identifiers

                for (const name of names) {
                    if (name && name !== '_') { // Skip _ (unused pattern)
                        variables.push(
                            this.createVariable(name, lineNumber, {
                                isReadonly: keyword === 'val',
                                isConst: keyword === 'val',
                            })
                        );
                    }
                }

                if (variables.length > 0) return variables;
            }
        }

        // PATTERN 3: For-comprehension variable binding (generators)
        // Examples: for (i <- 1 to 10) ...; for (x <- list; y = x.value) ...
        // Regex explanation:
        // for\s*\( : for keyword and opening parenthesis
        // (\w+)\s*<- : Variable name followed by <-
        // Captures: variable name
        // Note: for-comprehensions can be multi-line, so we only catch the binding on this line
        const forGenMatch = codeToAnalyze.match(/for\s*\(\s*(\w+)\s*<-/);
        if (forGenMatch) {
            const name = forGenMatch[1];

            variables.push(
                this.createVariable(name, lineNumber, {
                    isReadonly: true, // Loop variables are typically read-only in their scope
                })
            );

            return variables;
        }

        // PATTERN 4: For-comprehension value binding (val inside for)
        // Examples: for (x <- list; y = x.value; z <- other) ...
        // Regex explanation:
        // ;\s*(\w+)\s*= : Semicolon, variable name, equals
        // Captures: variable name in value binding
        const forValMatch = codeToAnalyze.match(/;\s*(\w+)\s*=/);
        if (forValMatch && codeToAnalyze.includes('for')) {
            const name = forValMatch[1];

            variables.push(
                this.createVariable(name, lineNumber, {
                    isReadonly: true,
                })
            );

            return variables;
        }

        return variables;
    }
}
