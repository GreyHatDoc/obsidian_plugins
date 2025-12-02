import { VariableInterface } from '../codeParser';
import { BaseVariableParser } from './baseVariableParser';
import { ScopeContextTracker } from './scopeContextTracker';

/**
 * Rust Variable Parser
 *
 * LANGUAGE FEATURES HANDLED:
 * 1. Immutable variable bindings (let)
 *    Examples: let x = 5; let y: u32 = 10; let z: &str = "hello";
 *
 * 2. Mutable variable bindings (let mut)
 *    Examples: let mut x = 5; let mut y: i32 = -1;
 *
 * 3. Shadowing (rebinding same name)
 *    Examples: let x = 5; let x = x + 1; (creates new binding)
 *
 * 4. Type annotations (explicit and inferred)
 *    Examples: let x: i32 = 5; let y = func(); (inferred)
 *
 * 5. References and borrowing
 *    Examples: let r = &x; let m = &mut y; let ptr = x as *const i32;
 *
 * 6. Pattern matching and destructuring
 *    Examples: let (a, b) = (1, 2); let Some(x) = option; let &ref_x = &val;
 *
 * 7. Constants and statics
 *    Examples: const MAX: u32 = 100; static mut COUNTER: usize = 0;
 *
 * 8. Function parameters (when parsing function signatures)
 *    Examples: fn func(x: i32, y: &str, mut z: f64) - x, y, z are bindings
 *
 * REGEX STRATEGY:
 * - Rust has explicit mutability (let vs let mut)
 * - Type system includes references (&), mutability (&mut), lifetimes ('a)
 * - Pattern matching is powerful but complex (handle simple cases)
 * - Constants/statics are declaration keywords like let
 * - Lifetimes and complex type parameters need careful parsing
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Rust syntax is relatively clean but safety-aware
 * - Type annotations are common and explicit
 * - References and lifetimes add complexity
 * - Use early exits for non-declaration lines
 * - Cache regex if parsing same line repeatedly (not expected here)
 *
 * EDGE CASES:
 * - Destructuring patterns: let Point { x, y } = point;
 * - Guard patterns: let Some(x) if x > 0 = value;
 * - Complex lifetimes: let r: &'a T = ...
 * - Type parameters: let v: Vec<T> = ...
 * - Raw pointers: let ptr = x as *const i32;
 * - Closures: let f = |x| x + 1; (creates binding but 'x' is param)
 */
export class RustVariableParser extends BaseVariableParser {
    /**
     * Extract variable declarations from a Rust line
     *
     * THOUGHT PROCESS:
     * 1. Skip empty and comment lines (fast path)
     * 2. Remove inline comments (//) from analysis
     * 3. Check for const/static declarations (special forms)
     * 4. Check for let bindings with optional mut modifier
     * 5. Handle type annotations (including lifetimes and references)
     * 6. Extract mutability modifier (mut keyword)
     * 7. Check for pattern matching/destructuring
     * 8. Skip control flow that uses similar syntax (if let, match, etc.)
     *
     * REGEX BUILDING BLOCKS:
     * - Keyword: (let|const|static)
     * - Mutability: (mut)?
     * - Pattern: Simple name (\w+) or complex patterns
     * - Type: Optional type annotation with lifetimes, refs, generics
     * - Value: Optional assignment
     * - Termination: [;,] or EOL
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

        // PATTERN 1: const and static declarations
        // Regex explanation:
        // (?:pub)? : Optional pub keyword (not currently tracked)
        // (const|static)\s+ : Keyword
        // (?:mut)? : Optional mut for statics
        // (\w+) : Variable name
        // \s*:\s* : Colon and type
        // ([^=;,]+) : Type annotation
        // (?:\s*=\s*[^;]+)?[;] : Optional value, semicolon
        let match = codeToAnalyze.match(/(?:pub)?\s*(const|static)\s+(?:mut)?\s*(\w+)\s*:\s*([^=;,]+?)(?:\s*=\s*[^;,]+)?[;,]|$/);
        if (match) {
            const keyword = match[1]; // 'const' or 'static'
            const name = match[2];
            const type = this.trim(match[3] || '');

            variables.push(
                this.createVariable(name, lineNumber, {
                    type,
                    isConst: keyword === 'const',
                    isReadonly: keyword === 'const',
                })
            );

            return variables;
        }

        // PATTERN 2: let bindings with optional mut
        // Regex explanation:
        // \blet\s+ : let keyword at word boundary
        // (mut)? : Optional mut keyword (makes variable mutable)
        // (\w+) : Variable name
        // (?:\s*:\s*([^=;,\n]+?))? : Optional type annotation (non-greedy)
        // (?:\s*=\s*[^;]+)?[;,]|$ : Optional value and termination
        match = codeToAnalyze.match(/\blet\s+(mut)?\s*(\w+)(?:\s*:\s*([^=;,\n]+?))?(?:\s*=\s*[^;,]+)?(?:[;,]|$)/);
        if (match) {
            const isMutable = !!match[1]; // 'mut' keyword present?
            const name = match[2];
            const type = match[3] ? this.trim(match[3]) : undefined;

            variables.push(
                this.createVariable(name, lineNumber, {
                    type,
                    isReadonly: !isMutable, // let without mut is readonly
                    isConst: !isMutable,
                })
            );

            return variables;
        }

        // PATTERN 3: Destructuring patterns / tuple unpacking
        // Examples: let (a, b) = (1, 2); let Some(x) = result;
        // Regex explanation:
        // let\s*\( : let followed by opening paren
        // ([^)]+) : Pattern content
        // \)\s*= : Closing paren and assignment
        // Captures: pattern names
        if (/\blet\s*\(/.test(codeToAnalyze)) {
            const destructMatch = codeToAnalyze.match(/\blet\s*\(([^)]+)\)\s*=/);
            if (destructMatch) {
                const patternStr = destructMatch[1];

                // Extract variable names from pattern
                // Handle: a, b or mut a, b or ref x, ref mut y
                const names = patternStr
                    .split(',')
                    .map(n => {
                        // Remove mut, ref, ref mut prefixes
                        let cleaned = this.trim(n).replace(/^(mut|ref|ref\s+mut)\s+/, '');
                        return cleaned;
                    })
                    .filter(n => /^[a-zA-Z_]\w*$/.test(n)); // Only valid identifiers

                for (const name of names) {
                    if (name && name !== '_') { // Skip _ (unused pattern)
                        variables.push(
                            this.createVariable(name, lineNumber, {
                                isReadonly: true, // Destructured values are typically readonly unless mut
                            })
                        );
                    }
                }

                if (variables.length > 0) return variables;
            }
        }

        // PATTERN 4: Struct/enum destructuring patterns
        // Examples: let Point { x, y } = point; let Enum { field1, field2 } = value;
        // Regex explanation:
        // let\s*(\w+)?\s*{\s* : let with optional pattern name, open brace
        // ([^}]+) : Pattern content (field names)
        // } : Close brace
        // Captures: pattern content
        if (/\blet\s+\w*\s*\{/.test(codeToAnalyze)) {
            const structMatch = codeToAnalyze.match(/\blet\s+\w*\s*\{([^}]+)\}/);
            if (structMatch) {
                const patternStr = structMatch[1];

                // Extract field names
                // Handle: x, y or ref x, mut y or x: a, y: b (shorthand vs explicit)
                const names = patternStr
                    .split(',')
                    .map(n => {
                        let cleaned = this.trim(n);
                        // Remove modifiers
                        cleaned = cleaned.replace(/^(mut|ref|ref\s+mut)\s+/, '');
                        // Extract just the name if it's name: type pattern
                        const colonIdx = cleaned.indexOf(':');
                        if (colonIdx >= 0) {
                            cleaned = cleaned.substring(0, colonIdx).trim();
                        }
                        return cleaned;
                    })
                    .filter(n => /^[a-zA-Z_]\w*$/.test(n)); // Only valid identifiers

                for (const name of names) {
                    if (name && name !== '_') {
                        variables.push(
                            this.createVariable(name, lineNumber, {
                                isReadonly: true,
                            })
                        );
                    }
                }

                if (variables.length > 0) return variables;
            }
        }

        // PATTERN 5: if let, match arm patterns (less common for simple variable extraction)
        // Examples: if let Some(x) = value; match value { Pattern(x) => ... }
        // These create bindings in nested scopes, so we track them but mark carefully
        if (/\bif\s+let\s+\w+\s*\(/.test(codeToAnalyze)) {
            const ifLetMatch = codeToAnalyze.match(/\bif\s+let\s+\w+\s*\((\w+)\)\s*=/);
            if (ifLetMatch) {
                const name = ifLetMatch[1];

                variables.push(
                    this.createVariable(name, lineNumber, {
                        isReadonly: true,
                    })
                );

                return variables;
            }
        }

        // PATTERN 6: Function parameters in function definitions
        // Examples: fn func(x: i32, mut y: String, z: &str) -> i32
        // Regex explanation:
        // fn\s+\w+\s*\( : fn keyword and opening paren
        // ([^)]+) : Parameter list content
        // \) : Closing paren
        if (/\bfn\s+\w+\s*\(/.test(codeToAnalyze)) {
            const fnMatch = codeToAnalyze.match(/\bfn\s+\w+\s*\(([^)]+)\)/);
            if (fnMatch) {
                const paramsStr = fnMatch[1];

                // Parse parameters: name: type or mut name: type or &self, &mut self
                const params = paramsStr
                    .split(',')
                    .map(p => {
                        let param = this.trim(p);
                        // Remove mut prefix
                        param = param.replace(/^mut\s+/, '');
                        // Extract name (everything before colon)
                        const colonIdx = param.indexOf(':');
                        if (colonIdx >= 0) {
                            return this.trim(param.substring(0, colonIdx));
                        }
                        return param;
                    })
                    .filter(p => p && p !== '&' && p !== '&mut' && /^[a-zA-Z_]\w*$/.test(p));

                // Only include if this looks like a function definition line (not call)
                // Check: does line have opening brace or arrow return type?
                if (/[{]|->|;/.test(codeToAnalyze)) {
                    for (const name of params) {
                        variables.push(
                            this.createVariable(name, lineNumber, {
                                isReadonly: true, // Parameters are typically readonly unless explicitly mut
                            })
                        );
                    }

                    if (variables.length > 0) return variables;
                }
            }
        }

        return variables;
    }
}
