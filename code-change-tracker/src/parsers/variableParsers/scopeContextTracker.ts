/**
 * Scope Context Tracker
 *
 * PURPOSE:
 * Maintains scope/context state across multiple lines of code.
 * Tracks when we enter/exit classes, structs, namespaces, and functions.
 * This enables variable parsers to know if a variable is a class member and
 * what its visibility is.
 *
 * DESIGN:
 * - Maintains a stack of scopes (nested classes, namespaces, etc.)
 * - Tracks opening/closing braces for scope boundaries
 * - Stores scope information (name, type, visibility context)
 * - Language-agnostic interface (can be extended per language)
 *
 * USAGE:
 * ```typescript
 * const tracker = new ScopeContextTracker();
 * tracker.processLine('class MyClass {', 1);  // Push class scope
 * tracker.processLine('  private int x;', 2); // x is in MyClass, private
 * tracker.processLine('}', 3);                 // Pop class scope
 *
 * const scope = tracker.getCurrentScope();
 * console.log(scope.className); // "MyClass"
 * ```
 *
 * IMPLEMENTATION NOTES:
 * - Uses stack-based approach for nested scopes
 * - Counts braces to detect scope boundaries
 * - Stores visibility context (public/private/protected for C++)
 * - Can be extended with language-specific scope rules
 */

/**
 * Represents a scope level (class, struct, namespace, function, etc.)
 */
export interface ScopeLevel {
    // Type of scope
    type: 'class' | 'struct' | 'namespace' | 'function' | 'block' | 'unknown';

    // Name of the scope (e.g., class name, function name)
    name: string;

    // Line where this scope started
    startLine: number;

    // Current visibility context (for C++ public/private/protected blocks)
    currentVisibility: 'public' | 'private' | 'protected' | 'default';

    // Parent scope (for tracking nested classes, etc.)
    parentPath?: string;

    // Opening brace count at this level (for accurate brace matching)
    openBraces: number;

    // Language-specific metadata
    metadata?: Record<string, unknown>;
}

export class ScopeContextTracker {
    /**
     * Stack of scope levels, with index 0 being global scope
     */
    private scopeStack: ScopeLevel[] = [];

    /**
     * Regex patterns for detecting scope declarations
     * These are language-agnostic patterns that work across most languages
     */
    private classPattern = /\b(class|struct|interface)\s+(\w+)/i;
    private namespacePattern = /\b(namespace)\s+(\w+)/i;
    private functionPattern = /\b(\w+)\s+(\w+)\s*\(/; // Simple pattern: returnType functionName(
    private publicPattern = /^\s*public\s*:/;
    private privatePattern = /^\s*private\s*:/;
    private protectedPattern = /^\s*protected\s*:/;

    constructor() {
        // Initialize with global scope
        this.scopeStack = [
            {
                type: 'block',
                name: 'global',
                startLine: 0,
                currentVisibility: 'public', // Global scope is public by default
                openBraces: 0,
            },
        ];
    }

    /**
     * Process a line of code to update scope context
     * Detects class/struct/namespace/function declarations and scope changes
     *
     * ALGORITHM:
     * 1. Check for visibility modifiers (public/private/protected)
     * 2. Check for scope declarations (class, struct, namespace, function)
     * 3. Count opening and closing braces
     * 4. Pop scopes when closing braces exit a scope level
     *
     * @param line - The source code line
     * @param lineNumber - The 1-indexed line number
     * @param language - The language ('cpp', 'typescript', 'python', etc.)
     */
    processLine(line: string, lineNumber: number, language: string = 'unknown'): void {
        // Check for visibility modifiers (C++, Java, TypeScript)
        if (language === 'cpp' || language === 'typescript' || language === 'java') {
            if (this.publicPattern.test(line)) {
                const current = this.getCurrentScope();
                if (current) {
                    current.currentVisibility = 'public';
                }
                return;
            }
            if (this.privatePattern.test(line)) {
                const current = this.getCurrentScope();
                if (current) {
                    current.currentVisibility = 'private';
                }
                return;
            }
            if (this.protectedPattern.test(line)) {
                const current = this.getCurrentScope();
                if (current) {
                    current.currentVisibility = 'protected';
                }
                return;
            }
        }

        // Check for scope declarations (class, struct, namespace)
        const classMatch = line.match(this.classPattern);
        if (classMatch) {
            const scopeType = classMatch[1].toLowerCase() as 'class' | 'struct';
            const scopeName = classMatch[2];
            this.pushScope(scopeType, scopeName, lineNumber, language);
            return;
        }

        const namespaceMatch = line.match(this.namespacePattern);
        if (namespaceMatch) {
            const scopeName = namespaceMatch[2];
            this.pushScope('namespace', scopeName, lineNumber, language);
            return;
        }

        // Count braces to manage scope boundaries
        this.countBraces(line);
    }

    /**
     * Count opening and closing braces to track scope boundaries
     * When closing braces exceed opening braces at a scope level, pop that scope
     *
     * IMPLEMENTATION:
     * - Count { and } in the line
     * - Update the openBraces counter for the current scope
     * - Pop scopes when openBraces becomes negative (closed more than opened)
     *
     * @param line - The source code line
     */
    private countBraces(line: string): void {
        // Simple brace counting (doesn't handle strings/comments perfectly, but good enough)
        const openCount = (line.match(/{/g) || []).length;
        const closeCount = (line.match(/}/g) || []).length;

        const current = this.getCurrentScope();
        if (current) {
            current.openBraces += openCount - closeCount;

            // Pop scopes if we've closed more braces than we opened at this level
            while (current.openBraces < 0 && this.scopeStack.length > 1) {
                this.scopeStack.pop();
                current.openBraces = 0; // Reset for next scope
            }
        }
    }

    /**
     * Push a new scope onto the stack
     * Called when we encounter a class, struct, namespace, or function declaration
     *
     * @param type - Type of scope (class, struct, namespace, function)
     * @param name - Name of the scope
     * @param startLine - Line number where scope starts
     * @param language - The programming language
     */
    private pushScope(
        type: 'class' | 'struct' | 'namespace' | 'function',
        name: string,
        startLine: number,
        language: string
    ): void {
        const parentPath = this.getScopePath();

        const newScope: ScopeLevel = {
            type,
            name,
            startLine,
            currentVisibility: this.getDefaultVisibility(type, language),
            parentPath,
            openBraces: 0,
        };

        this.scopeStack.push(newScope);
    }

    /**
     * Get the default visibility for a scope type in a given language
     *
     * LANGUAGE-SPECIFIC RULES:
     * - C++: class members default to private, struct members default to public
     * - TypeScript/Java: class members default to private
     * - Python: all members are public by convention (no private enforcement)
     *
     * @param scopeType - Type of scope (class, struct, etc.)
     * @param language - Programming language
     * @returns Default visibility for this scope type
     */
    private getDefaultVisibility(
        scopeType: 'class' | 'struct' | 'namespace' | 'function',
        language: string
    ): 'public' | 'private' | 'protected' | 'default' {
        if (language === 'cpp') {
            if (scopeType === 'struct') return 'public';
            if (scopeType === 'class') return 'private';
        } else if (language === 'typescript' || language === 'java') {
            if (scopeType === 'class') return 'private';
        } else if (language === 'python') {
            return 'default'; // Python doesn't enforce visibility
        }

        return 'default';
    }

    /**
     * Get the current (innermost) scope
     *
     * @returns The current scope level, or undefined if at global scope
     */
    getCurrentScope(): ScopeLevel | undefined {
        return this.scopeStack[this.scopeStack.length - 1];
    }

    /**
     * Get the scope path (nested scope names)
     * Example: "MyNamespace::MyClass" or "MyClass::NestedClass"
     *
     * @returns Fully qualified scope path
     */
    getScopePath(): string {
        // Skip the global scope (index 0)
        return this.scopeStack
            .slice(1)
            .map((s) => s.name)
            .join('::');
    }

    /**
     * Get the immediate parent class name (if variable is in a class)
     *
     * @returns The name of the immediate parent class, or undefined if not in a class
     */
    getParentClassName(): string | undefined {
        // Search from the top of stack down, looking for class or struct
        for (let i = this.scopeStack.length - 1; i >= 1; i--) {
            const scope = this.scopeStack[i];
            if (scope.type === 'class' || scope.type === 'struct') {
                return scope.name;
            }
        }
        return undefined;
    }

    /**
     * Check if we're currently inside a class or struct
     *
     * @returns true if the current scope is within a class/struct
     */
    isInClass(): boolean {
        return this.getParentClassName() !== undefined;
    }

    /**
     * Get the current visibility context
     * Used by parsers to determine if a variable is public/private/protected
     *
     * IMPLEMENTATION:
     * - For C++: returns explicit visibility (public/private/protected)
     * - For other languages: returns 'default' if not explicitly set
     *
     * @returns Current visibility context
     */
    getCurrentVisibility(): 'public' | 'private' | 'protected' | 'default' {
        const current = this.getCurrentScope();
        return current ? current.currentVisibility : 'public';
    }

    /**
     * Get the complete scope information for a variable
     * Returns all context needed to populate VariableInterface scope fields
     *
     * @returns Object with className, scopeType, scopePath, visibility
     */
    getScopeInfo() {
        return {
            isClassMember: this.isInClass(),
            className: this.getParentClassName(),
            scopeType: this.getCurrentScope()?.type,
            scopePath: this.getScopePath(),
            visibility: this.getCurrentVisibility(),
        };
    }

    /**
     * Reset the tracker (e.g., when processing a new file)
     */
    reset(): void {
        this.scopeStack = [
            {
                type: 'block',
                name: 'global',
                startLine: 0,
                currentVisibility: 'public',
                openBraces: 0,
            },
        ];
    }

    /**
     * Get a string representation of the current scope stack
     * Useful for debugging
     *
     * @returns Debug string showing current scope hierarchy
     */
    getDebugInfo(): string {
        return this.scopeStack.map((s) => `${s.type}(${s.name})`).join(' > ');
    }
}
