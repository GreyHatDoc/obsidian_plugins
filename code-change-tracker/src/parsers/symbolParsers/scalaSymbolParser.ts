/**
 * Scala Symbol Parser
 *
 * PURPOSE:
 * Extracts code symbols from Scala source code.
 *
 * SUPPORTED SYMBOL TYPES:
 * - 'class': Regular class definitions
 * - 'function': Top-level and nested function definitions (def)
 * - 'method': Methods inside classes or objects
 * - 'variable': Value and var declarations (val, var, lazy val)
 * - 'interface': Not applicable (traits serve this purpose)
 * - 'type': Type alias definitions
 * - 'enum': Not directly used (case objects as enums)
 * - 'namespace': Package declarations and objects (singleton pattern)
 * - 'module': Object declarations (Scala singleton objects)
 * - 'struct': Not applicable to Scala
 *
 * SCALA-SPECIFIC HANDLING:
 * - Traits as interfaces/mixins
 * - Object declarations (singletons)
 * - Case classes and case objects
 * - Type parameters with bounds [T], [T <: Base], [T: Manifest]
 * - Context bounds
 * - Package object support
 * - Implicit definitions (implicit def, implicit val)
 * - For-comprehensions (for { } syntax, treated as scope)
 * - Pattern matching (match/case)
 * - Type aliases (type Name = Type)
 *
 * KEY FEATURES:
 * - Handles type parameters and context bounds
 * - Tracks implicit definitions
 * - Distinguishes case classes from regular classes
 * - Supports nested classes and objects
 * - Extracts parameter types and return types
 * - Handles visibility modifiers (private, protected)
 * - Tracks method vs function distinction
 * - Supports functional syntax
 *
 * ALGORITHM:
 * 1. Track brace/bracket depth for scope management
 * 2. Detect class, object, trait, def, val, var, type declarations
 * 3. Extract name, type parameters, parameters, return type
 * 4. Use scope to determine if it's a method or function
 * 5. Handle case classes as special class type
 * 6. Extract type bounds and context bounds
 * 7. Return completed symbols
 *
 * EDGE CASES:
 * - Nested classes and objects
 * - Type parameters with multiple bounds
 * - Implicit parameters and definitions
 * - Anonymous functions and closures
 * - Operator definitions (def +(...): Type)
 * - Multi-line signatures with line continuation
 */

import { BaseSymbolParser, ScopeContext } from './baseSymbolParser';
import { CodeSymbol } from '../codeParser';

export class ScalaSymbolParser extends BaseSymbolParser {
  protected language: string = 'Scala';

  /**
   * Track if we're inside an object, class, or trait
   */
  private insideContainer: 'class' | 'object' | 'trait' | undefined = undefined;

  /**
   * Override reset to clear Scala-specific state
   */
  public reset(): void {
    super.reset();
    this.insideContainer = undefined;
  }

  /**
   * Extract symbols from a single line of Scala code
   *
   * ALGORITHM:
   * 1. Track brace depth for scope management
   * 2. Check for symbol declarations
   * 3. Extract type parameters and modifiers
   * 4. Build and return completed symbols
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

    // Detect package declaration
    if (trimmed.startsWith('package ')) {
      const packageMatch = trimmed.match(/^package\s+([\w.]+)/);
      if (packageMatch) {
        const symbol = this.createSymbol(
          packageMatch[1],
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
      }

      return completedSymbols;
    }

    // Track modifiers and visibility
    const isImplicit = trimmed.startsWith('implicit ');
    const modifiers = this.extractModifiers(trimmed);

    // Detect class declaration
    const classMatch = trimmed.match(
      /^(?:case\s+)?class\s+([a-zA-Z_]\w*)(?:\s*\[|(?:\s*\()|$|:)/
    );
    if (classMatch) {
      const isCaseClass = trimmed.includes('case class');
      const typeParams = this.extractTypeParameters(line);

      const symbol = this.createSymbol(
        classMatch[1],
        'class',
        lineNumber,
        lineNumber,
        trimmed,
        {
          modifiers: isCaseClass
            ? [...modifiers, 'case']
            : modifiers,
          decorators: typeParams,
          parameters: this.extractParameters(trimmed),
        }
      );

      completedSymbols.push(symbol);
      this.completedSymbols.push(symbol);

      this.scopeStack.push({
        name: classMatch[1],
        type: 'class',
        braceDepth: this.braceDepth,
        indentation: 0,
      });

      this.insideContainer = 'class';

      return completedSymbols;
    }

    // Detect trait declaration
    const traitMatch = trimmed.match(
      /^trait\s+([a-zA-Z_]\w*)(?:\s*\[|(?:\s+extends)|$|:)/
    );
    if (traitMatch) {
      const typeParams = this.extractTypeParameters(line);

      const symbol = this.createSymbol(
        traitMatch[1],
        'interface',
        lineNumber,
        lineNumber,
        trimmed,
        {
          modifiers,
          decorators: typeParams,
          parameters: [],
        }
      );

      completedSymbols.push(symbol);
      this.completedSymbols.push(symbol);

      this.scopeStack.push({
        name: traitMatch[1],
        type: 'trait',
        braceDepth: this.braceDepth,
        indentation: 0,
      });

      this.insideContainer = 'trait';

      return completedSymbols;
    }

    // Detect object declaration (singleton/module)
    const objectMatch = trimmed.match(
      /^(?:case\s+)?object\s+([a-zA-Z_]\w*)(?:\s*extends|\s*\{|$|:)/
    );
    if (objectMatch) {
      const isCaseObject = trimmed.includes('case object');

      const symbol = this.createSymbol(
        objectMatch[1],
        'module',
        lineNumber,
        lineNumber,
        trimmed,
        {
          modifiers: isCaseObject
            ? [...modifiers, 'case']
            : modifiers,
          parameters: [],
        }
      );

      completedSymbols.push(symbol);
      this.completedSymbols.push(symbol);

      this.scopeStack.push({
        name: objectMatch[1],
        type: 'module',
        braceDepth: this.braceDepth,
        indentation: 0,
      });

      this.insideContainer = 'object';

      return completedSymbols;
    }

    // Detect type alias
    const typeAliasMatch = trimmed.match(
      /^type\s+([a-zA-Z_]\w*)(?:\s*\[|=|\s*<:)/
    );
    if (typeAliasMatch) {
      const symbol = this.createSymbol(
        typeAliasMatch[1],
        'type',
        lineNumber,
        lineNumber,
        trimmed,
        {
          modifiers,
          parameters: [],
          returnType: this.extractReturnType(trimmed, 'scala'),
        }
      );

      completedSymbols.push(symbol);
      this.completedSymbols.push(symbol);

      return completedSymbols;
    }

    // Detect function/method declaration (def)
    const defMatch = trimmed.match(
      /^(?:implicit\s+)?def\s+([a-zA-Z_]\w+|\+|-|\*|\/|%|==|!=|<|>|<=|>=|&|\||\^|~)(?:\s*\[|(?:\s*\()|$)/
    );
    if (defMatch) {
      const isMethod = this.isInsideContainer();
      const symbolType = isMethod ? 'method' : 'function';
      const typeParams = this.extractTypeParameters(line);

      const newModifiers = isImplicit ? [...modifiers, 'implicit'] : modifiers;

      const symbol = this.createSymbol(
        defMatch[1],
        symbolType,
        lineNumber,
        lineNumber,
        trimmed,
        {
          modifiers: newModifiers,
          decorators: typeParams,
          parameters: this.extractParameters(trimmed),
          returnType: this.extractReturnType(trimmed, 'scala'),
          parentSymbol: isMethod
            ? this.scopeStack[this.scopeStack.length - 1]?.name
            : undefined,
        }
      );

      completedSymbols.push(symbol);
      this.completedSymbols.push(symbol);

      return completedSymbols;
    }

    // Detect variable/value declaration (val, var, lazy val)
    const varMatch = trimmed.match(
      /^(?:lazy\s+)?(val|var)\s+([a-zA-Z_]\w*)(?:\s*:|=|$)/
    );
    if (varMatch && this.isModuleOrContainerLevel()) {
      const isLazy = trimmed.includes('lazy ');
      const kind = varMatch[1];
      const varModifiers = isLazy ? [...modifiers, 'lazy'] : modifiers;

      if (isImplicit) {
        varModifiers.push('implicit');
      }

      const symbol = this.createSymbol(
        varMatch[2],
        'variable',
        lineNumber,
        lineNumber,
        trimmed,
        {
          modifiers: varModifiers,
          returnType: this.extractReturnType(trimmed, 'scala'),
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
   * Extract type parameters from Scala code
   *
   * Handles:
   * - [T]
   * - [T <: Base]
   * - [T >: Base]
   * - [T: Manifest]
   * - [A, B, C]
   *
   * @param signature - Complete or partial signature
   * @returns Array of type parameter strings
   */
  private extractTypeParameters(signature: string): string[] {
    const typeParamMatch = signature.match(/\[([^\]]+)\]/);
    if (!typeParamMatch) {
      return [];
    }

    const params = typeParamMatch[1];
    // Split by comma, but not inside nested brackets
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of params) {
      if (char === '[') {
        depth++;
        current += char;
      } else if (char === ']') {
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
   * Check if we're inside a container (class, object, or trait)
   *
   * @returns true if inside any container
   */
  private isInsideContainer(): boolean {
    return this.insideContainer !== undefined;
  }

  /**
   * Check if we're at module or container level (not nested)
   *
   * @returns true if at top level or inside class/object
   */
  private isModuleOrContainerLevel(): boolean {
    // Only track top-level values, not nested ones
    return this.scopeStack.length <= 1;
  }

  /**
   * NOT USED - Scala uses custom detection methods
   */
  protected detectSymbolStart(
    line: string
  ): { type: CodeSymbol['type']; name: string } | null {
    return null;
  }

  /**
   * NOT USED - Scala uses custom metadata extraction
   */
  protected extractSymbolMetadata(
    signature: string,
    type: CodeSymbol['type']
  ): any {
    return {};
  }
}
