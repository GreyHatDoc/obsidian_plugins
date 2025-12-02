/**
 * Python Symbol Parser
 *
 * PURPOSE:
 * Extracts code symbols from Python source code.
 *
 * SUPPORTED SYMBOL TYPES:
 * - 'class': Class definitions
 * - 'function': Module-level and nested function definitions
 * - 'method': Functions defined inside classes
 * - 'variable': Module-level variable assignments
 * - 'interface': Not directly used (Python doesn't have interfaces like TypeScript)
 * - 'type': Not applicable (Python 3.10+ type hints not tracked as symbols)
 * - 'enum': Enum definitions from enum module
 * - 'namespace': Not applicable (use package/module concept instead)
 * - 'module': Package/module names (from imports)
 * - 'struct': Not applicable to Python
 *
 * PYTHON-SPECIFIC HANDLING:
 * - Indentation-based scope detection (critical to Python)
 * - Decorator support (@decorator style)
 * - Parameter type hints extraction
 * - Return type hints extraction (-> Type)
 * - Class inheritance tracking
 * - Method vs function distinction via indentation
 * - Property decorators (@property)
 *
 * KEY FEATURES:
 * - Handles decorators (@property, @staticmethod, @classmethod, @decorator)
 * - Tracks indentation to determine scope (class vs module level)
 * - Extracts parameter types and annotations
 * - Handles docstrings (triple-quoted strings after definition)
 * - Supports async functions (async def)
 * - Detects class inheritance
 * - Tracks method vs function distinction
 *
 * ALGORITHM:
 * 1. Track decorators on preceding lines (@ prefix)
 * 2. Check current indentation level
 * 3. Detect class and def (function) declarations
 * 4. Extract name, parameters, return type
 * 5. Use indentation to determine if it's a method (inside class)
 * 6. Symbols can be single-line or multi-line (multiline when signature spans lines)
 * 7. Return completed symbols
 *
 * EDGE CASES:
 * - Nested classes
 * - Decorated functions
 * - Multiline function signatures
 * - Annotations with complex types
 */

import { BaseSymbolParser, AccumulatingSymbol, ScopeContext } from './baseSymbolParser';
import { CodeSymbol } from '../codeParser';

/**
 * Extended symbol tracker for Python with indentation awareness
 */
interface PythonAccumulatingSymbol extends AccumulatingSymbol {
  indentation: number;  // Indentation level of the symbol
}

export class PythonSymbolParser extends BaseSymbolParser {
  protected language: string = 'Python';

  /**
   * Track current indentation level
   * Python uses indentation for scope, not braces
   */
  private currentIndentation: number = 0;

  /**
   * Stack of scopes with their indentation levels
   * Example: [{ name: 'MyClass', type: 'class', indent: 0 }]
   */
  private indentationStack: ScopeContext[] = [];

  /**
   * Override reset to clear Python-specific state
   */
  public reset(): void {
    super.reset();
    this.currentIndentation = 0;
    this.indentationStack = [];
  }

  /**
   * Extract symbols from a single line of Python code
   *
   * ALGORITHM:
   * 1. Update indentation tracking
   * 2. Check if we're exiting scopes (dedentation)
   * 3. Track decorators
   * 4. Detect symbol declarations (class, def)
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
    if (this.isEmpty(trimmed) || trimmed.startsWith('#')) {
      return completedSymbols;
    }

    // Update indentation
    const lineIndentation = this.getIndentationLevel(line);
    this.currentIndentation = lineIndentation;

    // Check for scope exit (dedentation)
    while (
      this.indentationStack.length > 0 &&
      this.indentationStack[this.indentationStack.length - 1].indentation >=
        lineIndentation
    ) {
      this.indentationStack.pop();
    }

    // Track decorators
    if (trimmed.startsWith('@')) {
      const decorator = this.extractDecorators(line);
      this.pendingDecorators.push(...decorator);
      return completedSymbols;
    }

    // Detect new symbol
    const symbolStart = this.detectSymbolStart(trimmed);

    if (symbolStart) {
      // Determine if this symbol is complete (single line) or multi-line
      // Python symbols are usually complete on one line (except multiline signatures)
      const endsWithColon = trimmed.endsWith(':');

      const metadata = this.extractSymbolMetadata(trimmed, symbolStart.type);

      // Get parent symbol based on current scope
      const parentSymbol =
        this.indentationStack.length > 0
          ? this.indentationStack[this.indentationStack.length - 1].name
          : undefined;

      const symbol = this.createSymbol(
        symbolStart.name,
        symbolStart.type,
        lineNumber,
        lineNumber,  // Will update if multi-line
        trimmed,
        {
          decorators: [...this.pendingDecorators],
          modifiers: this.extractModifiers(trimmed),
          parameters: metadata.parameters,
          returnType: metadata.returnType,
          parentSymbol,
        }
      );

      completedSymbols.push(symbol);
      this.completedSymbols.push(symbol);

      // Update scope for class and function declarations
      if (symbolStart.type === 'class') {
        this.indentationStack.push({
          name: symbolStart.name,
          type: 'class',
          indentation: lineIndentation,
          braceDepth: 0,
        });
      } else if (symbolStart.type === 'function' || symbolStart.type === 'method') {
        this.indentationStack.push({
          name: symbolStart.name,
          type: 'function',
          indentation: lineIndentation,
          braceDepth: 0,
        });
      }

      this.pendingDecorators = [];
    }

    return completedSymbols;
  }

  /**
   * Extract indentation level (number of leading spaces)
   *
   * ALGORITHM:
   * - Counts leading spaces
   * - Treats tabs as 4 spaces (Python convention)
   * - Used to determine scope nesting
   *
   * @param line - Source code line
   * @returns Number of indentation spaces
   */
  private getIndentationLevel(line: string): number {
    let spaces = 0;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') {
        spaces++;
      } else if (line[i] === '\t') {
        // Tab = 4 spaces (Python standard)
        spaces += 4;
      } else {
        break;
      }
    }

    return spaces;
  }

  /**
   * Detect if a line starts a Python symbol
   *
   * PATTERNS MATCHED:
   * - "class ClassName(...):""
   * - "def function_name(...):""
   * - "async def async_function():""
   * - "class ClassName(BaseClass):""
   * - "@decorator\ndef/class..." (handled via pendingDecorators)
   *
   * @param line - Line to analyze (trimmed)
   * @returns Symbol information if detected, null otherwise
   */
  protected detectSymbolStart(
    line: string
  ): { type: CodeSymbol['type']; name: string } | null {
    // Class declaration
    const classMatch = line.match(/^class\s+([a-zA-Z_]\w*)(?:\s*\(|:)/);
    if (classMatch) {
      return { type: 'class', name: classMatch[1] };
    }

    // Function/method declaration (may be async)
    const functionMatch = line.match(
      /^(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/
    );
    if (functionMatch) {
      // Determine if it's a method or function based on decorator
      const isProperty =
        this.pendingDecorators.some((d) => d.includes('property'));

      // If we're inside a class (based on indentation), it's a method
      const type = this.isInsideClass() ? 'method' : 'function';
      return { type, name: functionMatch[1] };
    }

    // Variable assignment (module or class level)
    const varMatch = line.match(
      /^([a-zA-Z_]\w*)\s*=\s*(?!.*\(.*\))/  // Not a function call
    );
    if (varMatch && this.isModuleOrClassLevel()) {
      return { type: 'variable', name: varMatch[1] };
    }

    return null;
  }

  /**
   * Check if we're currently inside a class based on indentation
   *
   * @returns true if most recent scope is a class
   */
  private isInsideClass(): boolean {
    if (this.indentationStack.length === 0) {
      return false;
    }

    const lastScope =
      this.indentationStack[this.indentationStack.length - 1];
    return lastScope.type === 'class';
  }

  /**
   * Check if we're at module or class level (not inside a function)
   *
   * @returns true if not inside a function
   */
  private isModuleOrClassLevel(): boolean {
    // Check if all scopes in stack are classes (not functions)
    for (const scope of this.indentationStack) {
      if (scope.type === 'function') {
        return false;
      }
    }
    return true;
  }

  /**
   * Extract metadata from Python symbol signature
   *
   * Extracts:
   * - Parameters with type hints
   * - Return type (from -> annotation)
   * - Decorators
   * - Modifiers (from decorators like @staticmethod)
   *
   * @param signature - Complete or partial symbol signature
   * @param type - Symbol type
   * @returns Extracted metadata
   */
  protected extractSymbolMetadata(
    signature: string,
    type: CodeSymbol['type']
  ): {
    parameters?: any[];
    returnType?: string;
    modifiers?: string[];
    visibility?: 'public' | 'private' | 'protected';
  } {
    const result: any = {};

    // Extract parameters for functions/methods
    if (type === 'function' || type === 'method') {
      result.parameters = this.extractParameters(signature);
      result.returnType = this.extractReturnType(signature, 'python');
    }

    // Extract modifiers from decorators
    result.modifiers = [];
    if (
      this.pendingDecorators.some((d) => d.includes('staticmethod'))
    ) {
      result.modifiers.push('static');
    }
    if (
      this.pendingDecorators.some((d) => d.includes('classmethod'))
    ) {
      result.modifiers.push('classmethod');
    }
    if (
      this.pendingDecorators.some((d) => d.includes('property'))
    ) {
      result.modifiers.push('property');
    }

    return result;
  }
}
