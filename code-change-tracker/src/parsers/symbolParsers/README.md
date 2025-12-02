# Symbol Parser System

A comprehensive, language-agnostic code symbol extraction system that parses source code and identifies code constructs (classes, functions, variables, interfaces, types, etc.) across multiple programming languages.

## Supported Languages

- **TypeScript** (.ts, .tsx, .js, .jsx)
- **Python** (.py)
- **C++** (.cpp, .cc, .cxx, .c++, .h, .hpp, .hxx)
- **Scala** (.scala)
- **Rust** (.rs)

## Supported Symbol Types

### Core Symbol Types

The parser recognizes the following code symbol types via the `CodeSymbol` interface:

| Type        | Description                   | Languages                   |
| ----------- | ----------------------------- | --------------------------- |
| `class`     | Class definition              | TS, Py, C++, Scala, Rust    |
| `function`  | Top-level function            | TS, Py, C++, Scala, Rust    |
| `method`    | Function inside class/struct  | TS, Py, C++, Scala, Rust    |
| `variable`  | Variable/constant declaration | TS, Py, C++, Scala, Rust    |
| `interface` | Interface/protocol definition | TS, Py*, C++*, Scala*, Rust |
| `type`      | Type alias definition         | TS, Scala, Rust             |
| `enum`      | Enumeration definition        | TS, C++, Scala, Rust        |
| `namespace` | Namespace/package/module      | TS, C++, Scala, Rust        |
| `module`    | Module/object definition      | TS, Scala, Rust             |
| `struct`    | Struct definition             | C++, Rust                   |

*Note: Some languages map similar constructs (e.g., Python's ABC to interface, C++ templates to interfaces)*

## Quick Start

### Basic Usage

```typescript
import { SymbolParserRegistry } from './symbolParserRegistry';

// Get the registry singleton
const registry = SymbolParserRegistry.getInstance();

// Parse a single file
const result = registry.parseFile('app.ts', sourceCode);

console.log(`Found ${result.symbols.length} symbols`);
for (const symbol of result.symbols) {
  console.log(`${symbol.type}: ${symbol.name}`);
}
```

### Parse Multiple Files

```typescript
const files = [
  { filePath: 'app.ts', content: tsCode },
  { filePath: 'main.py', content: pyCode },
  { filePath: 'lib.cpp', content: cppCode },
];

const results = registry.parseMultipleFiles(files);

for (const result of results) {
  console.log(`${result.filePath}: ${result.symbols.length} symbols`);
}
```

### Language Detection

```typescript
// Automatic language detection from file extension
const language = registry.getLanguageForFile('myFile.rs');
console.log(language); // Output: Rust

// Get all supported extensions
const extensions = registry.getSupportedExtensions();
console.log(extensions); // ['.cpp', '.h', '.hpp', '.js', '.jsx', '.py', '.rs', '.scala', '.ts', '.tsx']
```

## Architecture

### System Design

```
┌─────────────────────────────────────────────────┐
│      SymbolParserRegistry (Singleton)           │
│    - Language detection                         │
│    - Parser lifecycle management               │
│    - Factory/dispatch pattern                  │
└──────────────────┬──────────────────────────────┘
                   │
         ┌─────────┼─────────┬───────────┬─────────┐
         │         │         │           │         │
    ┌────▼───┐ ┌───▼───┐ ┌──▼───┐ ┌────▼───┐ ┌──▼────┐
    │   TS   │ │  Py   │ │ C++  │ │ Scala  │ │ Rust  │
    │ Parser │ │Parser │ │Parser│ │Parser  │ │Parser │
    └────┬───┘ └───┬───┘ └──┬───┘ └────┬───┘ └──┬────┘
         │         │        │          │        │
         └─────────┼────────┼──────────┼────────┘
                   │
         ┌─────────▼──────────────────┐
         │ BaseSymbolParser (Abstract)│
         │ - Symbol detection         │
         │ - Scope tracking           │
         │ - Metadata extraction      │
         │ - Line-by-line processing  │
         └────────────────────────────┘
```

### File Structure

```
src/parsers/symbolParsers/
├── baseSymbolParser.ts         # Abstract base class (578 lines)
├── typescriptSymbolParser.ts   # TypeScript implementation (341 lines)
├── pythonSymbolParser.ts       # Python implementation (~450 lines)
├── cppSymbolParser.ts          # C++ implementation (~500 lines)
├── scalaSymbolParser.ts        # Scala implementation (~400 lines)
├── rustSymbolParser.ts         # Rust implementation (~450 lines)
├── symbolParserRegistry.ts     # Factory/registry (350+ lines)
├── symbolExamples.ts           # Examples and demos (500+ lines)
├── README.md                   # This file
├── IMPLEMENTATION_SUMMARY.md   # Technical details
├── QUICK_REFERENCE.md          # Quick API reference
└── FILE_INDEX.md              # File descriptions
```

## Core Concepts

### Symbol Type Definition

Each parsed symbol is represented as a `CodeSymbol` object:

```typescript
interface CodeSymbol {
  name: string;                               // Symbol identifier
  type: 'class' | 'function' | 'method' | 
        'variable' | 'interface' | 'type' | 
        'enum' | 'namespace' | 'module' | 'struct';
  startLine: number;                         // 1-indexed line number
  endLine: number;                           // 1-indexed line number
  signature?: string;                        // Full signature if available
  comments?: CommentInterface[];             // Associated comments
  decorators?: string[];                     // Decorators/attributes
  modifiers?: string[];                      // public, private, static, etc.
  parameters?: VariableInterface[];          // Function parameters
  returnType?: string;                       // Return type annotation
  parentSymbol?: string;                     // Parent class/namespace name
}
```

### Parser Processing Model

Each language parser extends `BaseSymbolParser` and processes code **line-by-line**:

1. **Input**: Source code line + line number
2. **Processing**: 
   - Update scope tracking (brace depth, indentation)
   - Detect symbol start
   - Extract metadata (name, type, parameters, etc.)
3. **Output**: Array of completed `CodeSymbol` objects

This line-by-line approach enables:
- **Streaming processing** of large files
- **Incremental parsing** as code is typed
- **Memory efficiency** (no need to load entire file)
- **Position accuracy** (exact line numbers)

### Scope Tracking

Different languages use different scope mechanisms:

| Language   | Scope Indicator | Method                     |
| ---------- | --------------- | -------------------------- |
| TypeScript | Braces `{ }`    | Brace depth counting       |
| Python     | Indentation     | Indentation level tracking |
| C++        | Braces `{ }`    | Brace depth counting       |
| Scala      | Braces `{ }`    | Brace depth counting       |
| Rust       | Braces `{ }`    | Brace depth counting       |

Each parser's base class handles the appropriate scope tracking method.

## Language-Specific Features

### TypeScript

Detects:
- Classes (abstract, export)
- Functions (async, arrow)
- Methods
- Variables (const, let, var)
- Interfaces
- Type aliases
- Enums
- Namespaces
- Decorators (@Component, @Override, etc.)
- Generic types

### Python

Detects:
- Classes
- Functions (def) and async functions
- Methods
- Variables (val, var)
- Decorators (@property, @staticmethod, @classmethod)
- Type hints (: annotation, -> return type)
- Indentation-based scope

### C++

Detects:
- Classes and structs
- Functions (global and member)
- Methods (with visibility tracking)
- Templates and template specializations
- Namespaces
- Enums
- Variables (const, static, extern)
- Operator overloads
- Visibility keywords (public:, private:, protected:)
- Const member functions

### Scala

Detects:
- Classes and case classes
- Objects and case objects
- Traits
- Functions (def)
- Methods
- Variables (val, var, lazy val)
- Type aliases
- Type parameters and context bounds
- Decorators
- Implicit definitions

### Rust

Detects:
- Structs
- Enums
- Traits
- Functions (async, unsafe, const)
- Methods (via impl blocks)
- Modules
- Type aliases
- Constants and static variables
- Generics and lifetime annotations
- Macro attributes (#[derive], #[...])
- Visibility modifiers (pub, pub(crate))

## API Reference

### SymbolParserRegistry

Singleton factory for language-specific parsers.

#### Methods

```typescript
// Get singleton instance
static getInstance(): SymbolParserRegistry

// Get parser for a file
getParserForFile(filePath: string): BaseSymbolParser

// Parse single file
parseFile(filePath: string, content: string): ParseResult

// Parse multiple files
parseMultipleFiles(files: Array<{filePath, content}>): ParseResult[]

// Get supported extensions
getSupportedExtensions(): string[]

// Get supported languages
getSupportedLanguages(): string[]

// Get language for file
getLanguageForFile(filePath: string): string

// Reset all cached parsers
resetAllParsers(): void

// Get statistics
getStatistics(): { cachedParsers, supportedLanguages, supportedExtensions }
```

### BaseSymbolParser

Abstract base class for language-specific parsers.

#### Main Method

```typescript
// Process single line of code
extractSymbolsFromLine(line: string, lineNumber: number): CodeSymbol[]

// Reset parser state
reset(): void
```

## Examples

See `symbolExamples.ts` for comprehensive examples including:

- TypeScript class with methods and decorators
- Python class with decorators and type hints
- C++ templates and visibility
- Scala case classes and traits
- Rust structs and impl blocks

Run examples:

```typescript
import { runAllExamples } from './symbolExamples';

runAllExamples();
```

## Error Handling

The registry gracefully handles errors:

```typescript
const result = registry.parseFile('unknown.xyz', code);

if (result.error) {
  console.error(`Parse error: ${result.error}`);
  // Unsupported file type
}
```

## Performance Characteristics

- **Time Complexity**: O(n) where n is number of lines
- **Space Complexity**: O(s) where s is number of symbols
- **Parser Reuse**: Single parser instance per language (cached)
- **Memory Optimization**: Line-by-line processing, no large buffering

## Testing

The parsers have been tested against:
- Real-world source files
- Edge cases (nested declarations, multi-line signatures)
- All supported languages
- Large files (1000+ lines)

## Integration

### With Obsidian Plugins

The symbol parsers integrate seamlessly with the Code Change Tracker plugin:

```typescript
const registry = SymbolParserRegistry.getInstance();
const result = registry.parseFile(filePath, fileContent);

// Process symbols for change tracking
for (const symbol of result.symbols) {
  // Track symbol changes
  // Generate documentation
  // Extract metadata
}
```

### With External Tools

Can be used in:
- Code documentation generators
- IDE extensions
- Code analysis tools
- AST/symbol table builders
- Refactoring tools
- Change tracking systems

## Future Enhancements

Possible additions:
- Additional languages (Java, Go, C#, etc.)
- Symbol relationship tracking (inheritance, composition)
- Full AST generation (beyond symbol extraction)
- Incremental parsing callbacks
- Symbol diff detection
- Import/export tracking
- Circular dependency detection

## License

Part of the Code Change Tracker plugin ecosystem.
