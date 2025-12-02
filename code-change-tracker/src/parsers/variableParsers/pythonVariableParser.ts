import { VariableInterface } from '../codeParser';
import { BaseVariableParser } from './baseVariableParser';
import { ScopeContextTracker } from './scopeContextTracker';

/**
 * Python Variable Parser
 *
 * LANGUAGE FEATURES HANDLED:
 * 1. Simple variable assignments
 *    Examples: x = 5; name = "John"; result = func()
 *
 * 2. Type-hinted assignments (PEP 484)
 *    Examples: x: int = 5; name: str = "John"; items: List[str] = []
 *
 * 3. Type annotations without assignment (class attributes)
 *    Examples: count: int; items: List[str]
 *
 * 4. Tuple/list unpacking
 *    Examples: a, b = 1, 2; x, *rest = [1, 2, 3, 4]
 *
 * 5. Class attributes in __init__ and class body
 *    Examples: self.name = value; cls.count = 0
 *
 * REGEX STRATEGY:
 * - Python is whitespace-sensitive, so indentation is important for context
 * - Primary pattern: ^\s*(\w+)\s*(?::\s*([^=]+?))?\s*=\s*([^#\n]+)
 *   Captures: name, optional type hint, assigned value
 * - Annotation pattern: ^\s*(\w+)\s*:\s*([^=]+)(?:\s*=|#|$)
 *   Captures: name, type hint
 * - Unpacking pattern: ^\s*([a-zA-Z_,*\s]+)\s*=\s*(.+)
 *   Captures: names (potentially multiple), value
 * - Self/class attribute: (self|cls)\.(\w+)\s*=
 *   Captures: context (self/cls), attribute name
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Python has simpler syntax than TS/C++, allowing looser patterns
 * - Avoid complex type hint parsing - just capture the whole annotation
 * - Comments are handled by splitting on '#'
 * - Leading/trailing whitespace shouldn't affect parsing (Python allows flexibility)
 *
 * EDGE CASES:
 * - Commented lines: `# x = 5` (skip)
 * - String literals containing '=': Handle by not matching inside quotes (complex, skip for now)
 * - Multiline statements: Won't be caught (but that's okay - single line focus)
 * - walrus operator (Python 3.8+): `:=` patterns
 */
export class PythonVariableParser extends BaseVariableParser {
    /**
     * Extract variable declarations from a Python line
     *
     * THOUGHT PROCESS:
     * 1. Skip empty lines and pure comment lines (fast path)
     * 2. Extract comment portion if present (remove from analysis)
     * 3. Check for self.attr or cls.attr assignments (instance/class attributes)
     * 4. Check for type-hinted assignments (highest priority - most explicit)
     * 5. Check for simple tuple unpacking assignments
     * 6. Check for simple variable assignments (fallback)
     * 7. Check for type annotations without assignment (class attributes)
     *
     * Why this order?
     * - Type hints are explicit and shouldn't be ambiguous (parse first)
     * - Self/cls attributes are explicit context
     * - Tuple unpacking is common in Python but less specific
     * - Simple assignments are most common but might match falsely
     * - Annotations without values are least common
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

        // Fast path: skip empty or pure comment lines
        if (this.isEmpty(line) || line.trim().startsWith('#')) {
            return variables;
        }

        // Remove inline comments for analysis (but keep the line structure)
        // This avoids false matches in comment text
        const commentIdx = line.indexOf('#');
        const codeToAnalyze = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

        if (this.isEmpty(codeToAnalyze)) {
            return variables;
        }

        // PATTERN 1: Instance/class attribute assignment (self.name = value or cls.name = value)
        // Regex explanation:
        // (self|cls)\.(\w+)\s*=\s* : self/cls dot attribute equals
        // Captures context and attribute name
        let match = codeToAnalyze.match(/(self|cls)\.(\w+)\s*=\s*([^#]+)/);
        if (match) {
            const context = match[1]; // 'self' or 'cls'
            const name = match[2];
            const value = this.trim(match[3]);

            variables.push(
                this.createVariable(
                    name,
                    lineNumber,
                    {
                        visibility: context === 'self' ? 'private' : 'protected', // convention
                        type: undefined, // Python usually infers from value
                    },
                    scopeContext
                )
            );
            return variables; // Don't analyze further if we found self/cls assignment
        }

        // PATTERN 2: Type-hinted assignment (name: Type = value)
        // Regex explanation:
        // ^(\w+)\s*:\s* : Variable name followed by colon
        // ([^=]+?)\s*=\s* : Type annotation (non-greedy), then equals
        // Captures: name, type
        match = codeToAnalyze.match(/^(\w+)\s*:\s*([^=]+?)\s*=\s*([^#]+)/);
        if (match) {
            const name = match[1];
            const type = this.trim(match[2]);

            variables.push(
                this.createVariable(
                    name,
                    lineNumber,
                    {
                        type,
                    },
                    scopeContext
                )
            );
            return variables;
        }

        // PATTERN 3: Tuple/list unpacking (a, b = values or a, *rest = values)
        // Regex explanation:
        // ^([a-zA-Z_,*\s]+)\s*=\s* : Multiple names (with optional * for rest) and equals
        // Captures: comma-separated names
        const unpackMatch = codeToAnalyze.match(/^([a-zA-Z_,*\s]+)\s*=\s*([^#]+)/);
        if (unpackMatch && unpackMatch[1].includes(',')) {
            const namesStr = unpackMatch[1];

            // Split by comma and extract individual names
            // Remove * prefix from rest capture pattern
            const names = namesStr
                .split(',')
                .map(n => this.trim(n).replace(/^\*+/, '')) // Remove leading asterisks
                .filter(n => !this.isEmpty(n));

            for (const name of names) {
                variables.push(
                    this.createVariable(name, lineNumber, {}, scopeContext)
                );
            }
            return variables;
        }

        // PATTERN 4: Simple variable assignment (name = value)
        // Regex explanation:
        // ^(\w+)\s*=\s* : Name at line start and equals
        // ^(?!if|elif|else|for|while|def|class) : Negative lookahead to skip keywords
        // Captures: name
        if (!/^(\s*)(if|elif|else|for|while|def|class|return|import|from)\b/.test(codeToAnalyze)) {
            match = codeToAnalyze.match(/^(\w+)\s*=\s*([^#]+)/);
            if (match) {
                const name = match[1];

                variables.push(
                    this.createVariable(name, lineNumber, {}, scopeContext)
                );
                return variables;
            }
        }

        // PATTERN 5: Type annotation without assignment (class attribute annotation)
        // Regex explanation:
        // ^(\w+)\s*:\s*([^=]+)$ : Name colon type, but NO equals sign
        // (?:$|#) : End of line or comment
        // Captures: name, type
        match = codeToAnalyze.match(/^(\w+)\s*:\s*([^=]+?)(?:\s*$|\s*#)/);
        if (match && !codeToAnalyze.includes('=')) {
            const name = match[1];
            const type = this.trim(match[2]);

            variables.push(
                this.createVariable(
                    name,
                    lineNumber,
                    {
                        type,
                    },
                    scopeContext
                )
            );
            return variables;
        }

        return variables;
    }
}
