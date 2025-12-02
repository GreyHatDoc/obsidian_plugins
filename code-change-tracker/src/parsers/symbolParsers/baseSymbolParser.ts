/**
 * Base Symbol Parser - Abstract Base Class
 *
 * PURPOSE:
 * Provides common interface and helpers for language-specific symbol parsers.
 * All language-specific parsers extend this class and implement language-specific logic.
 *
 * DESIGN PHILOSOPHY:
 * - Each parser handles one language (TypeScript, Python, C++, Scala, Rust)
 * - Parsers process code line-by-line, building symbols incrementally
 * - Symbols represent code constructs: classes, functions, variables, interfaces, etc.
 * - Parser maintains state across lines (for multi-line declarations)
 * - Symbols are completed when their boundaries are detected
 *
 * KEY RESPONSIBILITIES:
 * 1. Detect symbol starts (class declaration, function definition, etc.)
 * 2. Track symbol boundaries (opening/closing braces, indentation)
 * 3. Extract symbol metadata (name, type, parameters, return type, modifiers)
 * 4. Build complete CodeSymbol objects
 * 5. Handle nested symbols (methods inside classes, functions inside namespaces)
 * 6. Maintain consistency across all language implementations
 *
 * SYMBOL TYPES SUPPORTED:
 * - 'class': Class declaration
 * - 'function': Top-level/standalone function
 * - 'method': Function inside a class/struct
 * - 'variable': Variable declaration
 * - 'interface': Interface definition (TypeScript, Rust)
 * - 'type': Type alias (TypeScript, Scala)
 * - 'enum': Enumeration definition
 * - 'namespace': Namespace/module/package
 * - 'module': Module definition
 * - 'struct': Struct definition (C++, Rust)
 *
 * STATE MANAGEMENT:
 * - Tracks current symbol being parsed (may span multiple lines)
 * - Maintains brace depth to detect symbol boundaries
 * - Tracks scope stack for nested symbols
 * - Manages indentation levels for scope detection
 */

import { CodeSymbol } from '../codeParser';

/**
 * Represents a symbol being accumulated (for multi-line declarations)
 * Allows building symbols incrementally as we process lines
 */
export interface AccumulatingSymbol {
  name: string;
  type: CodeSymbol['type'];
  startLine: number;
  endLine?: number;
  signature?: string[];  // Array of lines making up the signature
  modifiers?: string[];  // public, private, static, etc.
  decorators?: string[];  // @decorator style annotations
  parameters?: string[];  // Parameter lines
  returnType?: string;  // Return type annotation
  braceDepth: number;  // Track nesting level
  parentSymbol?: string;  // Parent class/struct name
  visibility?: 'public' | 'private' | 'protected';  // C++ specific
}

/**
 * Scope tracking for nested contexts
 * Helps associate symbols with their containing class/namespace
 */
export interface ScopeContext {
  name: string;
  type: 'class' | 'struct' | 'namespace' | 'module' | 'function' | 'trait';
  indentation: number;
  braceDepth: number;
}

/**
 * Abstract base class for language-specific symbol parsers
 *
 * IMPLEMENTATION CONTRACT:
 * - Subclasses must implement detectSymbolStart() method
 * - Subclasses must implement extractSymbolMetadata() method
 * - State (currentSymbol, scopeStack) maintained by parser across lines
 * - Parser is stateful - do NOT reuse across files without reset()
 *
 * @abstract
 */
export abstract class BaseSymbolParser {
  /**
   * The language this parser handles
   * Must be set by subclasses
   */
  protected language: string = 'unknown';

  /**
   * Current symbol being accumulated
   * null if no multi-line symbol is in progress
   * CRITICAL: Must track across lines to properly build symbols
   */
  protected currentSymbol: AccumulatingSymbol | null = null;

  /**
   * Stack of scope contexts (nested scopes like classes, namespaces)
   * Used to determine parent symbol and nesting context
   * Example: [{ name: 'MyClass', type: 'class' }]
   */
  protected scopeStack: ScopeContext[] = [];

  /**
   * Completed symbols from current file
   * Accumulated as we parse through lines
   */
  protected completedSymbols: CodeSymbol[] = [];

  /**
   * Current brace depth (nesting level)
   * Helps determine when symbols end
   * Incremented on {, decremented on }
   */
  protected braceDepth: number = 0;

  /**
   * Track decorators/attributes for symbols
   * Used in TypeScript, Rust, Scala (@decorator style)
   * Array of most recent decorators before symbol declaration
   */
  protected pendingDecorators: string[] = [];

  /**
   * Main method to detect and extract symbols from a single line
   *
   * ALGORITHM:
   * 1. Update brace depth (count {})
   * 2. Check if we're completing a multi-line symbol
   * 3. Check if a new symbol is starting
   * 4. Extract metadata (parameters, return type, modifiers, etc.)
   * 5. Build and return CodeSymbol objects
   * 6. Update scope tracking
   *
   * CRITICAL DESIGN:
   * - Parser is stateful - maintains currentSymbol across lines
   * - Must return array (may be empty if no complete symbols)
   * - Must call this method for EVERY line in order
   * - Call reset() when starting new file
   *
   * @param line - The source code line
   * @param lineNumber - The 1-indexed line number in file
   * @returns Array of completed CodeSymbol objects (may be empty)
   */
  abstract extractSymbolsFromLine(
    line: string,
    lineNumber: number
  ): CodeSymbol[];

  /**
   * Detect if a line starts a new symbol
   *
   * Must identify patterns like:
   * - "class ClassName"
   * - "function functionName"
   * - "int variable;"
   * - "interface IName"
   * - etc.
   *
   * @param line - Line to analyze
   * @returns Symbol information if detected, null otherwise
   */
  protected abstract detectSymbolStart(
    line: string
  ): { type: CodeSymbol['type']; name: string } | null;

  /**
   * Extract detailed metadata about a symbol from its declaration
   *
   * Extracts:
   * - Parameters and types
   * - Return type
   * - Modifiers (public, static, etc.)
   * - Generic parameters
   * - Extends/implements
   * - etc.
   *
   * @param signature - The complete symbol signature (may span lines)
   * @param type - The symbol type
   * @returns Metadata object with extracted information
   */
  protected abstract extractSymbolMetadata(
    signature: string,
    type: CodeSymbol['type']
  ): {
    parameters?: string[];
    returnType?: string;
    modifiers?: string[];
    visibility?: 'public' | 'private' | 'protected';
  };

  /**
   * Helper: Trim and normalize whitespace
   */
  protected trim(str: string | undefined): string {
    return (str || '').trim();
  }

  /**
   * Helper: Check if string is empty or whitespace-only
   */
  protected isEmpty(str: string | undefined): boolean {
    return !str || str.trim().length === 0;
  }

  /**
   * Helper: Count opening and closing braces on a line
   *
   * Updates overall brace depth and returns net change.
   * Handles:
   * - Multiple braces on one line: "{ } { }"
   * - Braces in strings (heuristic detection)
   * - Nested braces: "{ { } }"
   *
   * RETURNS:
   * - Number of unmatched opening braces (may be negative)
   *
   * @param line - Line to analyze
   * @returns Net change in brace depth
   */
  protected updateBraceDepth(line: string): number {
    let openCount = 0;
    let closeCount = 0;

    // Count braces not in strings (heuristic)
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      // Track string boundaries
      if ((char === '"' || char === "'" || char === '`') && !inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && inString) {
        if (i === 0 || line[i - 1] !== '\\') {
          inString = false;
        }
      }

      // Count braces (only outside strings)
      if (!inString) {
        if (char === '{') {
          openCount++;
        } else if (char === '}') {
          closeCount++;
        }
      }
    }

    const netChange = openCount - closeCount;
    this.braceDepth += netChange;

    return netChange;
  }

  /**
   * Helper: Get current scope name (from scope stack)
   *
   * Returns the name of the innermost scope context.
   * Used for determining parent symbol for nested declarations.
   *
   * @returns Current scope name, or null if at global scope
   */
  protected getCurrentScope(): string | null {
    return this.scopeStack.length > 0
      ? this.scopeStack[this.scopeStack.length - 1].name
      : null;
  }

  /**
   * Helper: Push a new scope onto the stack
   *
   * Called when entering a class, namespace, function, etc.
   *
   * @param name - Scope name (class name, namespace name, etc.)
   * @param type - Scope type (class, namespace, function, etc.)
   * @param indentation - Indentation level (for Python)
   */
  protected pushScope(
    name: string,
    type: 'class' | 'struct' | 'namespace' | 'module' | 'function' | 'trait',
    indentation: number = 0
  ): void {
    this.scopeStack.push({
      name,
      type,
      indentation,
      braceDepth: this.braceDepth,
    });
  }

  /**
   * Helper: Pop scope from stack
   *
   * Called when exiting a class, namespace, function, etc.
   * (when closing brace is encountered)
   */
  protected popScope(): void {
    if (this.scopeStack.length > 0) {
      this.scopeStack.pop();
    }
  }

  /**
   * Helper: Extract modifiers from a code line
   *
   * EXAMPLES:
   * - "public static void method()" → ['public', 'static']
   * - "const int x = 5;" → ['const']
   * - "private: class Nested {};" → ['private']
   *
   * @param line - Line to analyze
   * @param language - Language type (for language-specific keywords)
   * @returns Array of modifier keywords
   */
  protected extractModifiers(
    line: string,
    language: string = 'generic'
  ): string[] {
    const modifiers: string[] = [];

    // Common modifiers across languages
    const commonModifiers = [
      'public',
      'private',
      'protected',
      'static',
      'final',
      'abstract',
      'async',
      'const',
      'let',
      'var',
      'readonly',
      'volatile',
      'synchronized',
      'sealed',
      'override',
      'inline',
    ];

    const trimmed = line.trim();

    for (const mod of commonModifiers) {
      // Match modifier as whole word (not substring)
      const regex = new RegExp(`\\b${mod}\\b`);
      if (regex.test(trimmed)) {
        modifiers.push(mod);
      }
    }

    return modifiers;
  }

  /**
   * Helper: Extract decorators/attributes from a line
   *
   * EXAMPLES:
   * - "@Component" → ['@Component']
   * - "#[derive(Debug)]" → ['#[derive(Debug)]']
   * - "[Serializable]" → ['[Serializable]']
   *
   * @param line - Line to analyze
   * @returns Array of decorators found
   */
  protected extractDecorators(line: string): string[] {
    const decorators: string[] = [];
    const trimmed = line.trim();

    // TypeScript style: @Decorator
    const typeScriptMatch = trimmed.match(/@\w+(\([^)]*\))?/g);
    if (typeScriptMatch) {
      decorators.push(...typeScriptMatch);
    }

    // Rust style: #[attribute]
    const rustMatch = trimmed.match(/#\[[^\]]+\]/g);
    if (rustMatch) {
      decorators.push(...rustMatch);
    }

    // Python style: @decorator
    const pythonMatch = trimmed.match(/@\w+/g);
    if (pythonMatch) {
      decorators.push(...pythonMatch);
    }

    // Java style: [Attribute]
    const javaMatch = trimmed.match(/\[\w+\]/g);
    if (javaMatch) {
      decorators.push(...javaMatch);
    }

    return decorators;
  }

  /**
   * Helper: Extract return type from a signature
   *
   * EXAMPLES:
   * - "int foo()" → "int"
   * - "function foo(): string" → "string"
   * - "def foo() -> int:" → "int"
   * - "fn foo() -> String" → "String"
   *
   * @param signature - Function/method signature
   * @param language - Language type (affects pattern matching)
   * @returns Return type string, or undefined if not found
   */
  protected extractReturnType(
    signature: string,
    language: string = 'generic'
  ): string | undefined {
    // TypeScript style: function foo(): ReturnType
    const tsMatch = signature.match(/\):\s*([^{;]+)/);
    if (tsMatch) {
      return this.trim(tsMatch[1]);
    }

    // Python style: def foo() -> ReturnType:
    const pyMatch = signature.match(/->\s*([^:;{]+)/);
    if (pyMatch) {
      return this.trim(pyMatch[1]);
    }

    // C++ style: ReturnType functionName(...)
    // Extract type before function name
    const cppMatch = signature.match(/^\s*(\w+(?:<[^>]+>)?)\s+\w+\s*\(/);
    if (cppMatch) {
      return cppMatch[1];
    }

    return undefined;
  }

  /**
   * Helper: Extract parameters from a function/method signature
   *
   * EXAMPLES:
   * - "foo(int x, string y)" → ["int x", "string y"]
   * - "foo(x: number, y: string)" → ["x: number", "y: string"]
   * - "foo(x, y)" → ["x", "y"]
   *
   * @param signature - Function/method signature
   * @returns Array of parameter strings
   */
  protected extractParameters(signature: string): string[] {
    const parameters: string[] = [];

    // Find the opening and closing parentheses
    const openParen = signature.indexOf('(');
    const closeParen = signature.lastIndexOf(')');

    if (openParen === -1 || closeParen === -1 || closeParen <= openParen) {
      return parameters;
    }

    // Extract content between parentheses
    const paramString = signature.substring(openParen + 1, closeParen).trim();

    if (this.isEmpty(paramString)) {
      return parameters;
    }

    // Split by comma (simple approach, doesn't handle nested generics perfectly)
    // A better approach would track angle brackets for generics
    let currentParam = '';
    let bracketDepth = 0;

    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];

      if (char === '<' || char === '(') {
        bracketDepth++;
        currentParam += char;
      } else if (char === '>' || char === ')') {
        bracketDepth--;
        currentParam += char;
      } else if (char === ',' && bracketDepth === 0) {
        if (!this.isEmpty(currentParam)) {
          parameters.push(this.trim(currentParam));
        }
        currentParam = '';
      } else {
        currentParam += char;
      }
    }

    // Add last parameter
    if (!this.isEmpty(currentParam)) {
      parameters.push(this.trim(currentParam));
    }

    return parameters;
  }

  /**
   * Helper: Extract name from a code element
   *
   * EXAMPLES:
   * - "class MyClass" → "MyClass"
   * - "function foo()" → "foo"
   * - "int myVar = 5;" → "myVar"
   *
   * @param line - Line containing the declaration
   * @param pattern - Regex pattern to extract name (first capture group)
   * @returns Extracted name, or null if not found
   */
  protected extractName(line: string, pattern: RegExp): string | null {
    const match = line.match(pattern);
    return match ? match[1] : null;
  }

  /**
   * Helper: Create a CodeSymbol object
   *
   * Standardizes symbol creation with consistent defaults and validation.
   *
   * @param name - Symbol name
   * @param type - Symbol type
   * @param startLine - Start line number (1-indexed)
   * @param endLine - End line number (1-indexed)
   * @param signature - Optional full signature
   * @param metadata - Optional additional metadata
   * @returns Properly formatted CodeSymbol
   */
  protected createSymbol(
    name: string,
    type: CodeSymbol['type'],
    startLine: number,
    endLine: number,
    signature?: string,
    metadata?: {
      comments?: any[];
      decorators?: string[];
      modifiers?: string[];
      parameters?: any[];
      returnType?: string;
      parentSymbol?: string;
    }
  ): CodeSymbol {
    return {
      name,
      type,
      startLine,
      endLine,
      signature: signature || name,
      comments: metadata?.comments,
      decorators: metadata?.decorators,
      modifiers: metadata?.modifiers,
      parameters: metadata?.parameters,
      returnType: metadata?.returnType,
      parentSymbol: metadata?.parentSymbol,
    };
  }

  /**
   * Helper: Reset parser state
   *
   * Call this when starting to parse a new file.
   * Clears all state that tracks across lines.
   *
   * CRITICAL: Must be called before parsing each new file
   */
  public reset(): void {
    this.currentSymbol = null;
    this.scopeStack = [];
    this.completedSymbols = [];
    this.braceDepth = 0;
    this.pendingDecorators = [];
  }

  /**
   * Helper: Get all completed symbols from current file
   *
   * Returns a copy of the symbols array. Usually called after
   * parsing is complete to get all extracted symbols.
   *
   * @returns Array of all completed symbols
   */
  public getCompletedSymbols(): CodeSymbol[] {
    return [...this.completedSymbols];
  }

  /**
   * Helper: Get parser debug information
   *
   * Useful for understanding why symbols may not be parsed correctly
   * or to debug multi-line symbol tracking issues.
   *
   * @returns Object with current state information
   */
  public getDebugInfo() {
    return {
      language: this.language,
      currentSymbol: this.currentSymbol
        ? {
            name: this.currentSymbol.name,
            type: this.currentSymbol.type,
            startLine: this.currentSymbol.startLine,
          }
        : null,
      braceDepth: this.braceDepth,
      scopeStackDepth: this.scopeStack.length,
      completedSymbolsCount: this.completedSymbols.length,
      currentScope: this.getCurrentScope(),
    };
  }
}
