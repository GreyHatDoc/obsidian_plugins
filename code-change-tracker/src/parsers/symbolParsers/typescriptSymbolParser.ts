/**
 * TypeScript Symbol Parser
 *
 * PURPOSE:
 * Extracts code symbols (classes, functions, interfaces, types, enums, etc.)
 * from TypeScript/JavaScript code.
 *
 * SUPPORTED SYMBOL TYPES:
 * - 'class': Class declarations (including abstract classes)
 * - 'function': Standalone function declarations and arrow functions
 * - 'method': Functions inside classes (detected via parent class tracking)
 * - 'variable': Variable declarations (const, let, var)
 * - 'interface': Interface definitions (TypeScript-specific)
 * - 'type': Type aliases and type unions
 * - 'enum': Enumeration definitions
 * - 'namespace': Namespace declarations (TypeScript)
 * - 'module': Module definitions (rare, but supported)
 * - 'struct': Not used in TypeScript (mapped to class)
 *
 * KEY FEATURES:
 * - Handles decorators (@Component, @Decorator, etc.)
 * - Tracks method vs function distinction via class context
 * - Supports generic types (<T>, <K,V>, etc.)
 * - Handles async functions
 * - Detects arrow functions and function expressions
 * - Tracks parameter types and return types
 * - Handles extends/implements clauses
 * - Supports nested classes
 *
 * ALGORITHM:
 * 1. Track decorators on lines (@ prefix)
 * 2. Check for symbol declarations (class, function, interface, etc.)
 * 3. Extract symbol name using language-specific patterns
 * 4. Build signature (function parameters, return types, etc.)
 * 5. Track scope (are we inside a class?)
 * 6. Complete symbol when we detect its end (closing brace at same level)
 * 7. Return completed symbols
 *
 * EDGE CASES:
 * - Functions with no parameters: "() => {}"
 * - Arrow functions with implicit returns: "x => x + 1"
 * - Class properties with initializers: "private x: number = 5;"
 * - Computed property names: "[Symbol.iterator]() {}"
 * - Async generators: "async *generator() {}"
 */

import { BaseSymbolParser, AccumulatingSymbol, ScopeContext } from './baseSymbolParser';
import { CodeSymbol } from '../codeParser';

export class TypeScriptSymbolParser extends BaseSymbolParser {
  protected language: string = 'TypeScript';

  /**
   * Track if we're currently inside a class
   * Used to distinguish between methods (inside class) and functions
   */
  private insideClass: boolean = false;

  /**
   * Override reset to clear TypeScript-specific state
   */
  public reset(): void {
    super.reset();
    this.insideClass = false;
  }

  /**
   * Extract symbols from a single line of TypeScript code
   *
   * ALGORITHM:
   * 1. Update brace depth
   * 2. Track decorators if line starts with @
   * 3. Check if previous multi-line symbol is complete
   * 4. Detect if new symbol starts
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

    // Update brace depth
    this.updateBraceDepth(line);

    // Track decorators (lines starting with @)
    if (trimmed.startsWith('@')) {
      const decorator = this.extractDecorators(line);
      this.pendingDecorators.push(...decorator);
    }

    // Check if we're exiting a scope (closing brace)
    if (trimmed === '}' || trimmed === '};') {
      if (this.scopeStack.length > 0) {
        this.popScope();
        this.insideClass = this.scopeStack.some((s) => s.type === 'class');
      }
    }

    // CASE 1: Currently building a multi-line symbol
    if (this.currentSymbol !== null) {
      // Accumulate signature lines
      if (this.currentSymbol.signature) {
        this.currentSymbol.signature.push(trimmed);
      }

      // Check if symbol is complete (closing brace at same level)
      if (
        (trimmed === '}' || trimmed === '};') &&
        this.braceDepth === this.currentSymbol.braceDepth
      ) {
        // Complete the symbol
        this.currentSymbol.endLine = lineNumber;

        const fullSignature = this.currentSymbol.signature
          ? this.currentSymbol.signature.join(' ')
          : this.currentSymbol.name;

        const metadata = this.extractSymbolMetadata(
          fullSignature,
          this.currentSymbol.type
        );

        const symbol = this.createSymbol(
          this.currentSymbol.name,
          this.currentSymbol.type,
          this.currentSymbol.startLine,
          lineNumber,
          fullSignature,
          {
            decorators: this.currentSymbol.decorators,
            modifiers: this.currentSymbol.modifiers,
            parameters: metadata.parameters,
            returnType: metadata.returnType,
            parentSymbol: this.currentSymbol.parentSymbol,
          }
        );

        completedSymbols.push(symbol);
        this.completedSymbols.push(symbol);

        // If this was a class/interface, pop scope
        if (
          this.currentSymbol.type === 'class' ||
          this.currentSymbol.type === 'interface'
        ) {
          this.insideClass = false;
        }

        this.currentSymbol = null;
      }

      return completedSymbols;
    }

    // CASE 2: Detect new symbol start
    const symbolStart = this.detectSymbolStart(trimmed);

    if (symbolStart) {
      // Determine full signature (may span multiple lines)
      const hasOpeningBrace = line.includes('{');
      const completedOnSameLine =
        hasOpeningBrace &&
        (trimmed.endsWith('}') || trimmed.endsWith('};'));

      // If completed on same line, create and return immediately
      if (completedOnSameLine) {
        const metadata = this.extractSymbolMetadata(trimmed, symbolStart.type);

        const symbol = this.createSymbol(
          symbolStart.name,
          symbolStart.type,
          lineNumber,
          lineNumber,
          trimmed,
          {
            decorators: [...this.pendingDecorators],
            modifiers: this.extractModifiers(trimmed),
            parameters: metadata.parameters,
            returnType: metadata.returnType,
            parentSymbol:
              this.insideClass || this.scopeStack.length > 0
                ? this.getCurrentScope() || undefined
                : undefined,
          }
        );

        completedSymbols.push(symbol);
        this.completedSymbols.push(symbol);

        // Handle scope updates
        if (symbolStart.type === 'class') {
          this.insideClass = true;
          this.pushScope(
            symbolStart.name,
            'class',
            0
          );
        }

        this.pendingDecorators = [];

        return completedSymbols;
      }

      // Symbol spans multiple lines - start accumulation
      const parentSymbol =
        this.insideClass || this.scopeStack.length > 0
          ? this.getCurrentScope() || undefined
          : undefined;

      this.currentSymbol = {
        name: symbolStart.name,
        type: symbolStart.type,
        startLine: lineNumber,
        signature: [trimmed],
        modifiers: this.extractModifiers(trimmed),
        decorators: [...this.pendingDecorators],
        braceDepth: this.braceDepth - (hasOpeningBrace ? 1 : 0),
        parentSymbol: parentSymbol || undefined,
      };

      // Update scope for classes
      if (symbolStart.type === 'class') {
        this.insideClass = true;
        this.pushScope(symbolStart.name, 'class', 0);
      } else if (symbolStart.type === 'interface') {
        this.pushScope(symbolStart.name, 'namespace', 0);
      } else if (symbolStart.type === 'namespace') {
        this.pushScope(symbolStart.name, 'namespace', 0);
      }

      this.pendingDecorators = [];
    }

    return completedSymbols;
  }

  /**
   * Detect if a line starts a TypeScript symbol
   *
   * PATTERNS MATCHED:
   * - "class ClassName" or "abstract class", "export class"
   * - "function name(...)" or "export function", "async function"
   * - "interface IName"
   * - "type TypeName ="
   * - "enum EnumName"
   * - "namespace ns"
   * - "const name = ..." (variable declaration)
   * - "let name = ..." (variable)
   * - "var name = ..." (variable)
   * - "export const/let/var"
   *
   * @param line - Line to analyze
   * @returns Symbol information if detected, null otherwise
   */
  protected detectSymbolStart(
    line: string
  ): { type: CodeSymbol['type']; name: string } | null {
    const trimmed = line.trim();

    // Class declaration
    const classMatch = trimmed.match(
      /(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_$]\w*)/
    );
    if (classMatch) {
      return { type: 'class', name: classMatch[1] };
    }

    // Interface declaration
    const interfaceMatch = trimmed.match(
      /(?:export\s+)?interface\s+([a-zA-Z_$]\w*)/
    );
    if (interfaceMatch) {
      return { type: 'interface', name: interfaceMatch[1] };
    }

    // Type alias
    const typeMatch = trimmed.match(/(?:export\s+)?type\s+([a-zA-Z_$]\w*)\s*=/);
    if (typeMatch) {
      return { type: 'type', name: typeMatch[1] };
    }

    // Enum declaration
    const enumMatch = trimmed.match(
      /(?:export\s+)?enum\s+([a-zA-Z_$]\w*)/
    );
    if (enumMatch) {
      return { type: 'enum', name: enumMatch[1] };
    }

    // Namespace declaration
    const namespaceMatch = trimmed.match(
      /(?:export\s+)?namespace\s+([a-zA-Z_$]\w*)/
    );
    if (namespaceMatch) {
      return { type: 'namespace', name: namespaceMatch[1] };
    }

    // Function declaration (not async generator to avoid conflicts)
    const functionMatch = trimmed.match(
      /(?:export\s+)?(?:async\s+)?(?:function|\bfunction\*)\s+([a-zA-Z_$]\w*)\s*\(/
    );
    if (functionMatch) {
      // Determine if it's a method (inside class)
      const type = this.insideClass ? 'method' : 'function';
      return { type, name: functionMatch[1] };
    }

    // Variable declaration with initialization (const/let/var)
    // These are generally method properties or module-level variables
    const varMatch = trimmed.match(
      /(?:public\s+)?(?:private\s+)?(?:protected\s+)?(?:static\s+)?(?:readonly\s+)?(?:async\s+)?(const|let|var)\s+([a-zA-Z_$]\w*)\s*(?::\s*[^=;]+)?\s*=/
    );
    if (varMatch) {
      return { type: 'variable', name: varMatch[2] };
    }

    // Property declaration (in classes, without initialization)
    const propertyMatch = trimmed.match(
      /(?:public\s+)?(?:private\s+)?(?:protected\s+)?(?:static\s+)?(?:readonly\s+)?([a-zA-Z_$]\w*)\s*:\s*[^=;]+\s*;/
    );
    if (propertyMatch && this.insideClass) {
      return { type: 'variable', name: propertyMatch[1] };
    }

    // Arrow function or method shorthand: "name = () => {}" or "name() {}"
    const arrowMatch = trimmed.match(
      /(?:public\s+)?(?:private\s+)?(?:protected\s+)?(?:static\s+)?([a-zA-Z_$]\w*)\s*(?::\s*\w+)?\s*=\s*(?:\([^)]*\)\s*)?=>/
    );
    if (arrowMatch && this.insideClass) {
      return { type: 'method', name: arrowMatch[1] };
    }

    // Method shorthand: "methodName(...) {}"
    const methodMatch = trimmed.match(
      /(?:public\s+)?(?:private\s+)?(?:protected\s+)?(?:static\s+)?(?:async\s+)?([a-zA-Z_$]\w*)\s*\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/
    );
    if (methodMatch && this.insideClass) {
      return { type: 'method', name: methodMatch[1] };
    }

    return null;
  }

  /**
   * Extract metadata from TypeScript symbol signature
   *
   * Extracts:
   * - Parameters and their types
   * - Return type (from : annotation or =>)
   * - Modifiers (public, private, static, etc.)
   * - Visibility
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
    const result: any = {
      modifiers: this.extractModifiers(signature),
      visibility: undefined,
    };

    // Extract visibility
    if (signature.includes('public')) {
      result.visibility = 'public';
    } else if (signature.includes('private')) {
      result.visibility = 'private';
    } else if (signature.includes('protected')) {
      result.visibility = 'protected';
    }

    // Extract return type
    if (type === 'function' || type === 'method') {
      result.returnType = this.extractReturnType(signature, 'typescript');
      result.parameters = this.extractParameters(signature);
    }

    return result;
  }
}
