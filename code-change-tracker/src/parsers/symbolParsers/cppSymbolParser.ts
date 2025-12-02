/**
 * C++ Symbol Parser
 *
 * PURPOSE:
 * Extracts code symbols from C++ source code.
 *
 * SUPPORTED SYMBOL TYPES:
 * - 'class': Class definitions
 * - 'function': Global and namespace-scoped functions
 * - 'method': Member functions inside classes/structs
 * - 'variable': Global and static variable declarations
 * - 'interface': Not directly used (abstract classes as interfaces)
 * - 'type': Not tracking type aliases separately
 * - 'enum': Enum definitions
 * - 'namespace': Namespace blocks
 * - 'module': Not applicable to C++
 * - 'struct': Struct definitions
 *
 * C++-SPECIFIC HANDLING:
 * - Brace-based scope tracking
 * - Visibility keywords (public:, private:, protected:)
 * - Template parameters (<T>, <class T, int N>)
 * - Namespace scope resolution (::)
 * - Method vs function distinction via scope
 * - Const/virtual/static/inline modifiers
 * - Const member functions
 * - Reference types (& and &&)
 * - Pointer types (*)
 * - noexcept specifications
 *
 * KEY FEATURES:
 * - Tracks method visibility (public/private/protected)
 * - Handles template parameters and specializations
 * - Extracts return types and parameter types
 * - Distinguishes methods from functions
 * - Tracks namespace nesting
 * - Handles scope resolution operator (::)
 * - Supports forward declarations
 *
 * ALGORITHM:
 * 1. Track brace depth for scope management
 * 2. Detect visibility keywords (public:, private:, protected:)
 * 3. Detect class, struct, namespace, enum declarations
 * 4. Detect function declarations (including member functions)
 * 5. Use brace depth and current scope to determine symbol type
 * 6. Extract template parameters and modifiers
 * 7. Track scope stack to determine nesting
 * 8. Return completed symbols when scope ends
 *
 * EDGE CASES:
 * - Template specializations: template<int N> class Container
 * - Const member functions: void method() const;
 * - Virtual functions: virtual void method();
 * - Operator overloads: operator+, operator[]
 * - Destructors: ~ClassName()
 * - Nested classes/structs
 * - Const/volatile qualifiers
 */

import { BaseSymbolParser, AccumulatingSymbol, ScopeContext } from './baseSymbolParser';
import { CodeSymbol } from '../codeParser';

/**
 * C++ specific scope context with visibility tracking
 */
interface CppScopeContext extends ScopeContext {
    visibility?: 'public' | 'private' | 'protected';
    isTemplate?: boolean;
    templateParams?: string[];
}

/**
 * Tracks visibility modifiers for C++ scopes
 */
interface VisibilityState {
    classVisibility: 'public' | 'private' | 'protected';
    structVisibility: 'public' | 'private' | 'protected';
}

export class CppSymbolParser extends BaseSymbolParser {
    protected language: string = 'C++';

    /**
     * Track visibility modifiers
     * Classes default to private, structs to public
     */
    private visibilityState: VisibilityState = {
        classVisibility: 'private',
        structVisibility: 'public',
    };

    /**
     * Override reset to clear C++ specific state
     */
    public reset(): void {
        super.reset();
        this.visibilityState = {
            classVisibility: 'private',
            structVisibility: 'public',
        };
    }

    /**
     * Extract symbols from a single line of C++ code
     *
     * ALGORITHM:
     * 1. Track brace depth for scope management
     * 2. Check for visibility keyword changes (public:, private:, protected:)
     * 3. Detect symbol declarations
     * 4. Extract template parameters if present
     * 5. Build and return completed symbols
     *
     * @param line - Source code line
     * @param lineNumber - 1-indexed line number
     * @returns Array of completed CodeSymbol objects
     */
    public extractSymbolsFromLine(
        line: string,
        lineNumber: number
    ): CodeSymbol[] {
        const completedSymbols: CodeSymbol[] = [];

        const trimmed = line.trim();

        // Skip empty lines and comments
        if (this.isEmpty(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            // Update brace depth even in comments (in case of braces in comments)
            this.updateBraceDepth(line);
            return completedSymbols;
        }

        // Update brace depth (critical for C++ scope tracking)
        this.updateBraceDepth(line);

        // Check for visibility modifiers
        this.updateVisibility(trimmed);

        // Detect template keyword (for template specializations)
        if (trimmed.startsWith('template')) {
            // Template declaration, will be followed by class/struct/function
            // We'll handle the actual symbol on the next line
            return completedSymbols;
        }

        // Detect class declaration
        const classMatch = trimmed.match(
            /^(?:template\s*<[^>]+>\s+)?(?:class|struct)\s+([a-zA-Z_]\w*)(?:\s*:|{|;)/
        );
        if (classMatch) {
            const symbolType = trimmed.includes('struct') ? 'struct' : 'class';
            const templateParams = this.extractTemplateParameters(line);

            const symbol = this.createSymbol(
                classMatch[1],
                symbolType,
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    decorators: templateParams.length > 0 ? templateParams : [],
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            // Add to scope stack
            this.scopeStack.push({
                name: classMatch[1],
                type: symbolType,
                braceDepth: this.braceDepth,
                indentation: 0,  // C++ uses brace depth, not indentation
            });

            return completedSymbols;
        }

        // Detect namespace declaration
        const namespaceMatch = trimmed.match(/^namespace\s+([a-zA-Z_]\w*)(?:\s*{)?/);
        if (namespaceMatch) {
            const symbol = this.createSymbol(
                namespaceMatch[1],
                'namespace',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: [],
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.scopeStack.push({
                name: namespaceMatch[1],
                type: 'namespace',
                braceDepth: this.braceDepth,
                indentation: 0,  // C++ uses brace depth, not indentation
            });

            return completedSymbols;
        }

        // Detect enum declaration
        const enumMatch = trimmed.match(
            /^enum\s+(?:class\s+)?([a-zA-Z_]\w*)(?:\s*:|{|;)/
        );
        if (enumMatch) {
            const symbol = this.createSymbol(
                enumMatch[1],
                'enum',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            return completedSymbols;
        }

        // Detect function or method
        const functionMatch = this.detectFunctionSignature(trimmed);
        if (functionMatch) {
            const isMethod = this.isInsideClass();
            const symbolType = isMethod ? 'method' : 'function';

            const symbol = this.createSymbol(
                functionMatch.name,
                symbolType,
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    parameters: functionMatch.parameters,
                    returnType: functionMatch.returnType,
                    parentSymbol: isMethod
                        ? this.scopeStack[this.scopeStack.length - 1]?.name
                        : undefined,
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            return completedSymbols;
        }

        // Detect variable declaration
        const varMatch = this.detectVariableDeclaration(trimmed);
        if (varMatch) {
            const symbol = this.createSymbol(
                varMatch.name,
                'variable',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    returnType: varMatch.type,
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            return completedSymbols;
        }

        return completedSymbols;
    }

    /**
     * Detect function signature from C++ code
     *
     * Patterns matched:
     * - "type functionName(...)"
     * - "virtual void method(...)"
     * - "inline constexpr Type func(...)"
     * - "~ClassName() (destructor)"
     * - "operator+(type) const"
     *
     * @param line - Line to analyze
     * @returns Function information or null
     */
    private detectFunctionSignature(
        line: string
    ): {
        name: string;
        returnType?: string;
        parameters?: any[];
    } | null {
        // Remove trailing semicolon and const qualifiers for pattern matching
        const cleaned = line
            .replace(/;\s*$/, '')
            .replace(/\s+const\s*$/, '')
            .replace(/\s+noexcept.*$/, '');

        // Match function signature: [modifiers] returnType name(params)
        const functionMatch = cleaned.match(
            /(?:virtual\s+|inline\s+|constexpr\s+|static\s+)*(~?[a-zA-Z_:*&]+)\s*\(([^)]*)\)\s*(?:const)?(?:noexcept)?$/
        );

        if (functionMatch) {
            const name = functionMatch[1].replace(/^[*&]+/, '').trim(); // Remove pointer/reference
            const params = functionMatch[2];
            const returnType = this.extractReturnType(cleaned, 'cpp');

            return {
                name,
                returnType,
                parameters: params.length > 0 ? this.extractParameters(cleaned) : [],
            };
        }

        // Match operator overloads: operator+(type) const
        const operatorMatch = cleaned.match(
            /operator\s*([+\-*/%=!<>&|~\[\]()^]+)\s*\(([^)]*)\)/
        );

        if (operatorMatch) {
            const name = `operator${operatorMatch[1]}`;
            const returnType = this.extractReturnType(cleaned, 'cpp');

            return {
                name,
                returnType,
                parameters: this.extractParameters(cleaned),
            };
        }

        return null;
    }

    /**
     * Detect variable declaration
     *
     * Patterns:
     * - "type varName;"
     * - "static int count = 0;"
     * - "const std::string& name = "value";"
     *
     * @param line - Line to analyze
     * @returns Variable information or null
     */
    private detectVariableDeclaration(
        line: string
    ): { name: string; type?: string } | null {
        // Remove trailing semicolon for pattern matching
        const cleaned = line.replace(/;\s*$/, '').trim();

        // Skip if it's a function or type declaration
        if (
            cleaned.includes('(') ||
            cleaned.startsWith('class ') ||
            cleaned.startsWith('struct ') ||
            cleaned.startsWith('enum ')
        ) {
            return null;
        }

        // Match variable declaration: [modifiers] type name [= value]
        const varMatch = cleaned.match(
            /(?:static\s+|const\s+|extern\s+)*([\w:*&<>]+)\s+([a-zA-Z_]\w*)\s*(?:=|$)/
        );

        if (varMatch) {
            return {
                type: varMatch[1],
                name: varMatch[2],
            };
        }

        return null;
    }

    /**
     * Extract template parameters from C++ code
     *
     * Examples:
     * - template<typename T> class Container
     * - template<class T, int N> struct Array
     *
     * @param line - Source code line
     * @returns Array of template parameter strings
     */
    private extractTemplateParameters(line: string): string[] {
        const templateMatch = line.match(/template\s*<([^>]+)>/);
        if (!templateMatch) {
            return [];
        }

        const params = templateMatch[1];
        // Split by comma, handling nested brackets
        const result: string[] = [];
        let current = '';
        let depth = 0;

        for (const char of params) {
            if (char === '<') {
                depth++;
                current += char;
            } else if (char === '>') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                if (current.trim()) {
                    result.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            result.push(current.trim());
        }

        return result;
    }

    /**
     * Update visibility based on C++ visibility keywords
     *
     * Handles:
     * - "public:"
     * - "private:"
     * - "protected:"
     *
     * @param line - Current line
     */
    private updateVisibility(line: string): void {
        if (line === 'public:' || line === 'public') {
            if (this.scopeStack.length > 0) {
                const lastScope = this.scopeStack[this.scopeStack.length - 1];
                if (lastScope.type === 'class') {
                    this.visibilityState.classVisibility = 'public';
                } else if (lastScope.type === 'struct') {
                    this.visibilityState.structVisibility = 'public';
                }
            }
        } else if (line === 'private:' || line === 'private') {
            if (this.scopeStack.length > 0) {
                const lastScope = this.scopeStack[this.scopeStack.length - 1];
                if (lastScope.type === 'class') {
                    this.visibilityState.classVisibility = 'private';
                } else if (lastScope.type === 'struct') {
                    this.visibilityState.structVisibility = 'private';
                }
            }
        } else if (line === 'protected:' || line === 'protected') {
            if (this.scopeStack.length > 0) {
                const lastScope = this.scopeStack[this.scopeStack.length - 1];
                if (lastScope.type === 'class') {
                    this.visibilityState.classVisibility = 'protected';
                } else if (lastScope.type === 'struct') {
                    this.visibilityState.structVisibility = 'protected';
                }
            }
        }
    }

    /**
     * Get current visibility based on scope
     *
     * Returns the appropriate visibility for the current scope
     *
     * @returns Visibility level
     */
    private getCurrentVisibility(): 'public' | 'private' | 'protected' {
        if (this.scopeStack.length === 0) {
            return 'public';
        }

        const lastScope = this.scopeStack[this.scopeStack.length - 1];

        if (lastScope.type === 'class') {
            return this.visibilityState.classVisibility;
        } else if (lastScope.type === 'struct') {
            return this.visibilityState.structVisibility;
        }

        return 'public';
    }

    /**
     * Check if currently inside a class
     *
     * @returns true if we're in a class scope
     */
    private isInsideClass(): boolean {
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const scope = this.scopeStack[i];
            if (scope.type === 'class' || scope.type === 'struct') {
                return true;
            }
        }
        return false;
    }

    /**
     * NOT USED - C++ uses detectSymbolStart pattern but implements custom detection
     * Left abstract implementation from base class
     */
    protected detectSymbolStart(
        line: string
    ): { type: CodeSymbol['type']; name: string } | null {
        // Overridden by custom detection methods above
        return null;
    }

    /**
     * NOT USED - C++ uses custom metadata extraction
     */
    protected extractSymbolMetadata(
        signature: string,
        type: CodeSymbol['type']
    ): any {
        return {};
    }
}
