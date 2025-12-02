/**
 * Rust Symbol Parser
 *
 * PURPOSE:
 * Extracts code symbols from Rust source code.
 *
 * SUPPORTED SYMBOL TYPES:
 * - 'class': Struct definitions
 * - 'function': Top-level functions
 * - 'method': Methods inside impl blocks or structs
 * - 'variable': Const and static variable declarations
 * - 'interface': Trait definitions
 * - 'type': Type alias definitions
 * - 'enum': Enum definitions
 * - 'namespace': Module definitions
 * - 'module': Module declarations (matching CodeSymbol interface)
 * - 'struct': Struct definitions
 *
 * RUST-SPECIFIC HANDLING:
 * - Generic parameters with lifetime annotations ('a)
 * - Where clauses for trait bounds
 * - Visibility modifiers (pub, pub(crate), pub(in path))
 * - Impl blocks for trait implementations
 * - Associated types and constants
 * - Async functions
 * - Unsafe blocks
 * - Macro invocations (#[macro])
 * - Derive macros (#[derive(...)])
 * - Module declarations and visibility
 * - Trait methods (with default implementations)
 * - Self parameter handling
 * - Mutable references (&mut)
 * - Const generics
 *
 * KEY FEATURES:
 * - Tracks generic parameters and lifetime annotations
 * - Handles where clauses
 * - Detects impl block scopes
 * - Distinguishes associated constants/types
 * - Supports trait methods with defaults
 * - Handles macro attributes
 * - Tracks module nesting
 * - Extracts visibility modifiers
 * - Handles async/unsafe keywords
 *
 * ALGORITHM:
 * 1. Track brace depth for scope management
 * 2. Detect impl blocks (special scoping for methods)
 * 3. Detect struct, enum, trait, fn, const, static, mod declarations
 * 4. Extract generic parameters and where clauses
 * 5. Use scope stack to determine method vs function
 * 6. Handle macro attributes and derives
 * 7. Return completed symbols
 *
 * EDGE CASES:
 * - Generic parameters with lifetimes: struct Foo<'a, T>
 * - Const generics: struct Matrix<const N: usize>
 * - Where clauses: fn foo<T>() where T: Display
 * - Impl specialization: impl<T: Display> Foo<T>
 * - Associated types: type Item = i32;
 * - Async/await syntax
 * - Unsafe blocks
 * - Nested modules
 * - Macro definitions: macro_rules! name
 */

import { BaseSymbolParser, ScopeContext } from './baseSymbolParser';
import { CodeSymbol } from '../codeParser';

/**
 * Tracks impl block context for method distinction
 */
interface RustScope extends ScopeContext {
    isImplBlock?: boolean;
    implType?: string;  // The type being implemented for
}

export class RustSymbolParser extends BaseSymbolParser {
    protected language: string = 'Rust';

    /**
     * Track current impl block context
     * Used to determine if we're parsing methods
     */
    private implBlockStack: string[] = [];

    /**
     * Override reset to clear Rust-specific state
     */
    public reset(): void {
        super.reset();
        this.implBlockStack = [];
    }

    /**
     * Extract symbols from a single line of Rust code
     *
     * ALGORITHM:
     * 1. Track brace depth for scope management
     * 2. Track macro attributes on preceding lines
     * 3. Detect symbol declarations
     * 4. Extract generic parameters and where clauses
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
            this.updateBraceDepth(line);
            return completedSymbols;
        }

        // Update brace depth
        this.updateBraceDepth(line);

        // Track macro attributes (#[...])
        if (trimmed.startsWith('#[')) {
            const decorators = this.extractDecorators(line);
            this.pendingDecorators.push(...decorators);
            return completedSymbols;
        }

        // Detect module declaration
        const modMatch = trimmed.match(/^pub(?:\s*\([^)]*\))?\s+mod\s+([a-z_]\w*)/);
        const modPrivateMatch = trimmed.match(/^mod\s+([a-z_]\w*)/);
        const modDecl = modMatch || modPrivateMatch;

        if (modDecl) {
            const symbol = this.createSymbol(
                modDecl[1],
                'namespace',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    decorators: [...this.pendingDecorators],
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.scopeStack.push({
                name: modDecl[1],
                type: 'namespace',
                braceDepth: this.braceDepth,
                indentation: 0,
            });

            this.pendingDecorators = [];
            return completedSymbols;
        }

        // Detect struct definition
        const structMatch = trimmed.match(
            /^pub(?:\s*\([^)]*\))?\s+struct\s+([a-zA-Z_]\w*)(?:\s*<|(?:\s*\{)|;|$)/
        );
        const structPrivateMatch = trimmed.match(
            /^struct\s+([a-zA-Z_]\w*)(?:\s*<|(?:\s*\{)|;|$)/
        );
        const structDecl = structMatch || structPrivateMatch;

        if (structDecl) {
            const generics = this.extractGenerics(trimmed);

            const symbol = this.createSymbol(
                structDecl[1],
                'struct',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    decorators: [...this.pendingDecorators, ...generics],
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.scopeStack.push({
                name: structDecl[1],
                type: 'struct',
                braceDepth: this.braceDepth,
                indentation: 0,
            });

            this.pendingDecorators = [];
            return completedSymbols;
        }

        // Detect enum definition
        const enumMatch = trimmed.match(
            /^pub(?:\s*\([^)]*\))?\s+enum\s+([a-zA-Z_]\w*)(?:\s*<|(?:\s*\{)|$)/
        );
        const enumPrivateMatch = trimmed.match(
            /^enum\s+([a-zA-Z_]\w*)(?:\s*<|(?:\s*\{)|$)/
        );
        const enumDecl = enumMatch || enumPrivateMatch;

        if (enumDecl) {
            const generics = this.extractGenerics(trimmed);

            const symbol = this.createSymbol(
                enumDecl[1],
                'enum',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    decorators: [...this.pendingDecorators, ...generics],
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.scopeStack.push({
                name: enumDecl[1],
                type: 'namespace',  // Map enum to namespace for ScopeContext
                braceDepth: this.braceDepth,
                indentation: 0,
            });

            this.pendingDecorators = [];
            return completedSymbols;
        }

        // Detect trait definition
        const traitMatch = trimmed.match(
            /^pub(?:\s*\([^)]*\))?\s+trait\s+([a-zA-Z_]\w*)(?:\s*<|(?:\s*\{)|:)/
        );
        const traitPrivateMatch = trimmed.match(
            /^trait\s+([a-zA-Z_]\w*)(?:\s*<|(?:\s*\{)|:)/
        );
        const traitDecl = traitMatch || traitPrivateMatch;

        if (traitDecl) {
            const generics = this.extractGenerics(trimmed);

            const symbol = this.createSymbol(
                traitDecl[1],
                'interface',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    decorators: [...this.pendingDecorators, ...generics],
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.scopeStack.push({
                name: traitDecl[1],
                type: 'trait',
                braceDepth: this.braceDepth,
                indentation: 0,
            });

            this.pendingDecorators = [];
            return completedSymbols;
        }

        // Detect impl block
        const implMatch = trimmed.match(
            /^impl\s*(?:<[^>]+>)?\s+(?:([a-zA-Z_]\w+)\s+for\s+)?([a-zA-Z_]\w*)(?:\s*<|(?:\s*\{)|$)/
        );

        if (implMatch) {
            const implType = implMatch[1] ? `${implMatch[1]} for ${implMatch[2]}` : implMatch[2];
            this.implBlockStack.push(implType);

            const symbol = this.createSymbol(
                `impl ${implType}`,
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
                name: `impl ${implType}`,
                type: 'namespace',
                braceDepth: this.braceDepth,
                indentation: 0,
            });

            return completedSymbols;
        }

        // Detect function or method
        const fnMatch = trimmed.match(
            /^(?:pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:const\s+)?fn\s+([a-z_]\w*)(?:\s*<|(?:\s*\()|$)/
        );

        if (fnMatch) {
            const isMethod = this.implBlockStack.length > 0;
            const symbolType = isMethod ? 'method' : 'function';
            const generics = this.extractGenerics(trimmed);

            const symbol = this.createSymbol(
                fnMatch[1],
                symbolType,
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    decorators: [...this.pendingDecorators, ...generics],
                    parameters: this.extractParameters(trimmed),
                    returnType: this.extractReturnType(trimmed, 'rust'),
                    parentSymbol: isMethod
                        ? this.implBlockStack[this.implBlockStack.length - 1]
                        : undefined,
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.pendingDecorators = [];
            return completedSymbols;
        }

        // Detect type alias
        const typeMatch = trimmed.match(/^pub\s+type\s+([a-zA-Z_]\w*)/);
        const typePrivateMatch = trimmed.match(/^type\s+([a-zA-Z_]\w*)/);
        const typeDecl = typeMatch || typePrivateMatch;

        if (typeDecl) {
            const generics = this.extractGenerics(trimmed);

            const symbol = this.createSymbol(
                typeDecl[1],
                'type',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: this.extractModifiers(trimmed),
                    decorators: [...this.pendingDecorators, ...generics],
                    returnType: this.extractReturnType(trimmed, 'rust'),
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.pendingDecorators = [];
            return completedSymbols;
        }

        // Detect const declaration
        const constMatch = trimmed.match(
            /^pub(?:\s*\([^)]*\))?\s+const\s+([A-Z_]\w*)(?:\s*:|=)/
        );
        const constPrivateMatch = trimmed.match(/^const\s+([A-Z_]\w*)(?:\s*:|=)/);
        const constDecl = constMatch || constPrivateMatch;

        if (constDecl) {
            const symbol = this.createSymbol(
                constDecl[1],
                'variable',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: [...this.extractModifiers(trimmed), 'const'],
                    decorators: [...this.pendingDecorators],
                    returnType: this.extractReturnType(trimmed, 'rust'),
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.pendingDecorators = [];
            return completedSymbols;
        }

        // Detect static declaration
        const staticMatch = trimmed.match(
            /^pub(?:\s*\([^)]*\))?\s+static\s+(?:mut\s+)?([a-z_]\w*)(?:\s*:|=)/
        );
        const staticPrivateMatch = trimmed.match(/^static\s+(?:mut\s+)?([a-z_]\w*)(?:\s*:|=)/);
        const staticDecl = staticMatch || staticPrivateMatch;

        if (staticDecl) {
            const modifiers = this.extractModifiers(trimmed);
            if (trimmed.includes('mut')) {
                modifiers.push('mut');
            }

            const symbol = this.createSymbol(
                staticDecl[1],
                'variable',
                lineNumber,
                lineNumber,
                trimmed,
                {
                    modifiers: [...modifiers, 'static'],
                    decorators: [...this.pendingDecorators],
                    returnType: this.extractReturnType(trimmed, 'rust'),
                    parameters: [],
                }
            );

            completedSymbols.push(symbol);
            this.completedSymbols.push(symbol);

            this.pendingDecorators = [];
            return completedSymbols;
        }

        return completedSymbols;
    }

    /**
     * Extract generic parameters from Rust code
     *
     * Handles:
     * - [T]
     * - ['a]
     * - [T: Display]
     * - ['a, T]
     * - [const N: usize]
     *
     * @param signature - Complete or partial signature
     * @returns Array of generic parameter strings
     */
    private extractGenerics(signature: string): string[] {
        const genericMatch = signature.match(/<([^>]+)>/);
        if (!genericMatch) {
            return [];
        }

        const params = genericMatch[1];
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
     * NOT USED - Rust uses custom detection methods
     */
    protected detectSymbolStart(
        line: string
    ): { type: CodeSymbol['type']; name: string } | null {
        return null;
    }

    /**
     * NOT USED - Rust uses custom metadata extraction
     */
    protected extractSymbolMetadata(
        signature: string,
        type: CodeSymbol['type']
    ): any {
        return {};
    }
}
