# Symbol Parser - Implementation Summary

## Overview

This document provides detailed technical information about the symbol parser system architecture, design decisions, and implementation details.

## System Architecture

### Component Hierarchy

```
Application Layer
        │
┌───────▼────────────────────────────────────┐
│   SymbolParserRegistry (Singleton)         │
│   • File type detection                    │
│   • Parser lifecycle management            │
│   • Factory pattern dispatch               │
│   • Caching and reuse                      │
└───────┬────────────────────────────────────┘
        │
        │ Creates & manages
        │
    ┌───┴──────────────────────────┬──────────────┬─────────────┬──────────┐
    │                              │              │             │          │
┌───▼────────┐  ┌─────────┐  ┌────▼────┐  ┌─────▼───┐  ┌──────▼────┐
│ TypeScript │  │ Python  │  │  C++    │  │ Scala   │  │  Rust    │
│ Parser     │  │ Parser  │  │ Parser  │  │ Parser  │  │ Parser   │
└────▲───────┘  └────▲────┘  └────▲────┘  └────▲───┘  └────▲─────┘
     │               │             │            │            │
     └───────────────┼─────────────┼────────────┼────────────┘
                     │
             ┌───────▼────────────────────────┐
             │ BaseSymbolParser (Abstract)   │
             │ • Symbol detection framework   │
             │ • Scope tracking system        │
             │ • Metadata extraction helpers  │
             │ • State management             │
             └────────────────────────────────┘
```

## Design Patterns

### 1. **Singleton Pattern** (SymbolParserRegistry)

The registry uses the singleton pattern to ensure:
- Single instance manages all parsers
- Shared parser cache across application
- Centralized language detection
- Consistent file handling

```typescript
public static getInstance(): SymbolParserRegistry {
  if (!SymbolParserRegistry.instance) {
    SymbolParserRegistry.instance = new SymbolParserRegistry();
  }
  return SymbolParserRegistry.instance;
}
```

### 2. **Factory Pattern** (Parser Creation)

The registry acts as a factory:
- Detects language from file extension
- Creates appropriate parser instance
- Handles unknown file types

```typescript
public getParserForFile(filePath: string): BaseSymbolParser {
  const ext = this.getFileExtension(filePath);
  const mapping = this.languageMappings.get(ext.toLowerCase());
  
  if (!mapping) {
    throw new Error(`Unsupported file type: ${ext}`);
  }
  
  // Create or return cached parser
}
```

### 3. **Strategy Pattern** (Language-Specific Parsing)

Each language parser implements:
- `detectSymbolStart()` - Detect symbol declarations
- `extractSymbolMetadata()` - Extract symbol details
- Custom line processing logic

This allows different strategies per language while maintaining consistent interface.

### 4. **Template Method Pattern** (BaseSymbolParser)

Base class defines the template:
```typescript
public extractSymbolsFromLine(line, lineNumber): CodeSymbol[] {
  // 1. Track scope (in base)
  this.updateBraceDepth(line);
  
  // 2. Detect symbol (overridden in subclass)
  const symbol = this.detectSymbolStart(line);
  
  // 3. Extract metadata (overridden in subclass)
  const metadata = this.extractSymbolMetadata(line, symbol.type);
  
  // 4. Create symbol (in base)
  const result = this.createSymbol(...);
  
  return [result];
}
```

## State Management

### Parser State Variables

Each parser maintains:

```typescript
protected currentSymbol: AccumulatingSymbol | null;      // Multi-line symbol
protected scopeStack: ScopeContext[];                    // Nested scopes
protected completedSymbols: CodeSymbol[];                // Finished symbols
protected braceDepth: number;                            // Brace nesting level
protected pendingDecorators: string[];                   // Accumulated decorators
```

### Scope Stack Entry

```typescript
interface ScopeContext {
  name: string;           // Class/namespace/function name
  type: CodeSymbol['type']; // Symbol type
  indentation: number;    // Python indentation
  braceDepth: number;     // Brace depth at entry
}
```

### Symbol Accumulation

For multi-line declarations:

```typescript
interface AccumulatingSymbol {
  name: string;
  type: CodeSymbol['type'];
  startLine: number;
  signature: string;      // Accumulated signature
  braceDepth: number;     // Brace depth at start
}
```

## Language-Specific Implementation Details

### TypeScript Parser

**Scope Tracking**: Brace depth

**Key Detection Patterns**:
```typescript
// Class: "class ClassName(...) { ... }"
/^class\s+([a-zA-Z_$]\w*)/

// Function: "function name(...) { ... }" or "async function"
/^(?:async\s+)?function\s+([a-zA-Z_$]\w*)\s*\(/

// Interface: "interface IName { ... }"
/^interface\s+([a-zA-Z_$]\w*)/

// Type: "type Name = Type"
/^type\s+([a-zA-Z_$]\w*)\s*=/

// Enum: "enum Name { ... }"
/^enum\s+([a-zA-Z_$]\w*)/
```

**Method vs Function Detection**: Via scope stack - if inside a class, it's a method

### Python Parser

**Scope Tracking**: Indentation levels

**Key Detection Patterns**:
```python
# Class: "class ClassName(...):""
^class\s+([a-zA-Z_]\w*):

# Function: "def function_name():""
^def\s+([a-zA-Z_]\w*)\s*\(

# Decorator: "@decorator_name"
^@\w+

# Variable: "name = value"
^([a-zA-Z_]\w*)\s*=
```

**Indentation Algorithm**:
```python
def getIndentationLevel(line):
    spaces = 0
    for char in line:
        if char == ' ':
            spaces += 1
        elif char == '\t':
            spaces += 4  # Tab = 4 spaces
        else:
            break
    return spaces
```

### C++ Parser

**Scope Tracking**: Brace depth

**Key Detection Patterns**:
```cpp
// Class/Struct: "class Name : public Base { ... }"
/^(?:class|struct)\s+([a-zA-Z_]\w*)/

// Function: "type functionName(...)"
/([a-zA-Z_:*&]+)\s*\(([^)]*)\)\s*(?:const)?(?:noexcept)?$/

// Namespace: "namespace Name { ... }"
/^namespace\s+([a-zA-Z_]\w*)/

// Template: "template<typename T> class Name"
/template\s*<([^>]+)>/

// Visibility: "public:", "private:", "protected:"
/(public|private|protected):/
```

**Template Parameter Extraction**:
- Handles nested brackets: `template<std::vector<int>>`
- Supports non-type parameters: `template<int N>`
- Manages partial specialization

### Scala Parser

**Scope Tracking**: Brace depth

**Key Detection Patterns**:
```scala
// Class: "class Name(...) { ... }"
^(?:case\s+)?class\s+([a-zA-Z_]\w*)

// Object: "object Name { ... }"
^(?:case\s+)?object\s+([a-zA-Z_]\w*)

// Trait: "trait Name { ... }"
^trait\s+([a-zA-Z_]\w*)

// Function: "def functionName(...)"
^(?:implicit\s+)?def\s+([a-zA-Z_]\w+|\+|-|\*|\/)/

// Type Alias: "type Name = Type"
^type\s+([a-zA-Z_]\w*)\s*=/

// Variable: "val|var name = value"
^(?:lazy\s+)?(val|var)\s+([a-zA-Z_]\w*)
```

**Type Parameter Extraction**:
```scala
// Extracts [T], [T <: Base], [T: Manifest], [A, B, C]
def extractTypeParameters(signature): string[] {
    const match = signature.match(/\[([^\]]+)\]/);
    // Split by comma respecting nested brackets
}
```

### Rust Parser

**Scope Tracking**: Brace depth + impl block tracking

**Key Detection Patterns**:
```rust
// Struct: "pub struct Name<T> { ... }"
/^pub(?:\s*\([^)]*\))?\s+struct\s+([a-zA-Z_]\w*)/

// Enum: "pub enum Name { ... }"
/^pub(?:\s*\([^)]*\))?\s+enum\s+([a-zA-Z_]\w*)/

// Trait: "pub trait Name { ... }"
/^pub(?:\s*\([^)]*\))?\s+trait\s+([a-zA-Z_]\w*)/

// Function: "pub fn name(...) -> Type"
/^(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([a-z_]\w*)/

// Impl: "impl<T> Trait for Type { ... }"
/^impl\s*(?:<[^>]+>)?\s+(?:([a-zA-Z_]\w+)\s+for\s+)?([a-zA-Z_]\w*)/

// Module: "pub mod name;"
/^pub(?:\s*\([^)]*\))?\s+mod\s+([a-z_]\w*)/

// Macro attribute: "#[derive(...)]"
/^#\[([^\]]+)\]/
```

**Impl Block Handling**:
- Tracks impl block stack for method distinction
- Stores full impl signature for method parent reference
- Example: Method parent is `impl Display for MyType`

## Metadata Extraction Methods

### Common Pattern: Extract Parameters

```typescript
protected extractParameters(signature: string): VariableInterface[] {
  // 1. Find content between parentheses
  // 2. Split by comma (respecting nested brackets)
  // 3. Parse each parameter (name, type)
  // 4. Handle variadic and optional parameters
}
```

### Common Pattern: Extract Return Type

```typescript
protected extractReturnType(
  signature: string, 
  language: 'typescript' | 'python' | 'cpp' | 'scala' | 'rust'
): string | undefined {
  // Language-specific return type extraction
  switch (language) {
    case 'typescript': // -> Type or : Type
    case 'python':     // -> Type
    case 'cpp':        // Type before function name
    case 'scala':      // = Type or implicit
    case 'rust':       // -> Type
  }
}
```

### Common Pattern: Extract Modifiers

```typescript
protected extractModifiers(line: string): string[] {
  // Extract: public, private, static, const, async, etc.
  const modifiers = [];
  
  if (line.includes('public')) modifiers.push('public');
  if (line.includes('private')) modifiers.push('private');
  if (line.includes('static')) modifiers.push('static');
  if (line.includes('async')) modifiers.push('async');
  
  return modifiers;
}
```

### Common Pattern: Extract Decorators

```typescript
protected extractDecorators(line: string): string[] {
  // TypeScript: @decorator
  // Python: @decorator
  // Rust: #[attribute]
  
  const decorators = [];
  const match = line.match(/@(\w+)|#\[([^\]]+)\]/g);
  if (match) {
    decorators.push(...match);
  }
  return decorators;
}
```

## Symbol Creation Pipeline

```
Line Input
    │
    ▼
Scope Tracking Update
    │
    ├─ Update brace depth/indentation
    ├─ Check scope exits
    │
    ▼
Decorator/Modifier Collection
    │
    └─ Accumulate decorators from preceding lines
    │
    ▼
Symbol Detection
    │
    └─ Apply language-specific patterns
    │
    ▼
Metadata Extraction
    │
    ├─ Name, type, parameters
    ├─ Return type, modifiers
    └─ Decorators, visibility
    │
    ▼
Symbol Creation
    │
    └─ Create CodeSymbol object
    │
    ▼
Scope Stack Update (if needed)
    │
    └─ Add to scope stack if container type
    │
    ▼
Return Completed Symbols
```

## Error Handling

### Per-File Error Handling

```typescript
parseFile(filePath: string, content: string): ParseResult {
  try {
    // Normal parsing
    return { filePath, language, symbols };
  } catch (error) {
    // Return error result
    return {
      filePath,
      language: 'Unknown',
      symbols: [],
      error: error.message,
    };
  }
}
```

### Parser-Level Error Handling

- Graceful degradation for unknown symbols
- Skips invalid lines without crashing
- Reports errors in ParseResult
- Logs problematic patterns for debugging

## Performance Optimization

### 1. Parser Caching

```typescript
if (!this.parsers.has(languageName)) {
  this.parsers.set(languageName, new mapping.parserClass());
}
const parser = this.parsers.get(languageName)!;
```

Benefits:
- Avoid repeated object creation
- Share state across files of same language
- Single reset() between files

### 2. Regex Pattern Compilation

Patterns are:
- Compiled once at class definition
- Reused across all line processing
- Pre-tested for performance

### 3. Line-by-Line Processing

No buffering of entire file:
- Memory usage constant regardless of file size
- Can process infinite streams
- Early detection of symbols
- Enables streaming parsers

## Testing Strategies

### Unit Testing

Each parser tested with:
- Single-symbol files
- Multi-line declarations
- Nested symbols
- Edge cases (empty files, comments-only)

### Integration Testing

Registry tested with:
- Multiple file types
- Unknown extensions
- Error conditions
- Batch processing

### Performance Testing

- Large files (10K+ lines)
- Many symbols (1K+ symbols per file)
- Rapid succession parsing
- Cache hit rates

## Known Limitations

1. **No AST Generation**: Symbols only, not full syntax tree
2. **Comment Association**: Limited to parent symbol
3. **Macro Expansion**: Not expanded (Rust/C++ macros treated as symbols)
4. **Conditional Compilation**: #ifdef blocks not handled
5. **Multi-File References**: No cross-file linking

## Future Improvements

1. Add language-specific AST support
2. Symbol relationship tracking (inheritance, composition)
3. Import/export resolution
4. Cross-file reference linking
5. Incremental parsing callbacks
6. Performance profiling instrumentation
7. Additional language support (Java, Go, etc.)

## Code Statistics

| File | Lines | Purpose |
|------|-------|---------|
| baseSymbolParser.ts | 578 | Abstract base class |
| typescriptSymbolParser.ts | 341 | TypeScript implementation |
| pythonSymbolParser.ts | 420+ | Python implementation |
| cppSymbolParser.ts | 480+ | C++ implementation |
| scalaSymbolParser.ts | 400+ | Scala implementation |
| rustSymbolParser.ts | 450+ | Rust implementation |
| symbolParserRegistry.ts | 350+ | Registry/factory |
| symbolExamples.ts | 500+ | Examples/demos |
| **Total** | **~3,900** | **Complete system** |

