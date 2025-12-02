# Symbol Parser - Quick Reference

## Installation

```typescript
import { SymbolParserRegistry } from './parsers/symbolParsers/symbolParserRegistry';
import { CodeSymbol } from './parsers/codeParser';
```

## Basic Usage

### Single File Parsing

```typescript
const registry = SymbolParserRegistry.getInstance();
const result = registry.parseFile('app.ts', sourceCode);

if (result.error) {
  console.error('Parse error:', result.error);
} else {
  console.log(`Found ${result.symbols.length} symbols in ${result.language}`);
}
```

### Multiple Files

```typescript
const files = [
  { filePath: 'app.ts', content: tsCode },
  { filePath: 'main.py', content: pyCode },
];

const results = registry.parseMultipleFiles(files);
```

## Common Operations

### Get All Classes

```typescript
const classes = result.symbols.filter(s => s.type === 'class');
```

### Get All Functions

```typescript
const functions = result.symbols.filter(s => s.type === 'function');
```

### Get All Methods in a Class

```typescript
const classMethods = result.symbols.filter(
  s => s.type === 'method' && s.parentSymbol === 'MyClass'
);
```

### Filter by Modifier

```typescript
const publicMethods = result.symbols.filter(
  s => s.type === 'method' && 
       s.modifiers?.includes('public')
);

const asyncFunctions = result.symbols.filter(
  s => s.type === 'function' && 
       s.modifiers?.includes('async')
);
```

### Find Symbol by Name

```typescript
const symbol = result.symbols.find(s => s.name === 'getUserById');
```

### Count Symbols by Type

```typescript
const counts = new Map<string, number>();
for (const symbol of result.symbols) {
  counts.set(symbol.type, (counts.get(symbol.type) ?? 0) + 1);
}
```

## Language Detection

```typescript
// Get language for file
const language = registry.getLanguageForFile('app.ts');
// Output: TypeScript

// Supported extensions
const extensions = registry.getSupportedExtensions();
// Output: ['.cpp', '.h', '.hpp', '.js', '.jsx', '.py', '.rs', '.scala', '.ts', '.tsx']

// Supported languages
const languages = registry.getSupportedLanguages();
// Output: ['C++', 'Python', 'Rust', 'Scala', 'TypeScript']
```

## Symbol Information

### Access Symbol Properties

```typescript
const symbol: CodeSymbol = result.symbols[0];

console.log(`Name: ${symbol.name}`);
console.log(`Type: ${symbol.type}`);
console.log(`Location: Lines ${symbol.startLine}-${symbol.endLine}`);
console.log(`Modifiers: ${symbol.modifiers?.join(', ')}`);
console.log(`Decorators: ${symbol.decorators?.join(', ')}`);
console.log(`Return Type: ${symbol.returnType}`);
console.log(`Parent: ${symbol.parentSymbol}`);
console.log(`Parameters: ${symbol.parameters?.length ?? 0}`);
```

### Extract Signature

```typescript
const symbol = result.symbols.find(s => s.name === 'myFunction');
console.log(`Signature: ${symbol?.signature}`);
```

### List Function Parameters

```typescript
const func = result.symbols.find(s => s.type === 'function');
if (func?.parameters) {
  for (const param of func.parameters) {
    console.log(`- ${param.name}: ${param.type}`);
  }
}
```

## Filtering Examples

### Find All Classes with a Decorator

```typescript
const decorated = result.symbols.filter(
  s => s.type === 'class' && 
       s.decorators && 
       s.decorators.length > 0
);
```

### Find All Static Methods

```typescript
const staticMethods = result.symbols.filter(
  s => s.type === 'method' && 
       s.modifiers?.includes('static')
);
```

### Find Symbols in a Line Range

```typescript
const symbols = result.symbols.filter(
  s => s.startLine >= 10 && s.endLine <= 50
);
```

### Find All Exported Symbols (TypeScript)

```typescript
const exported = result.symbols.filter(
  s => s.modifiers?.includes('export')
);
```

### Find Private Members (C++)

```typescript
const privateMembers = result.symbols.filter(
  s => s.type === 'method' || s.type === 'variable' &&
       s.modifiers?.includes('private')
);
```

## Iteration Patterns

### Process All Symbols

```typescript
for (const symbol of result.symbols) {
  console.log(`${symbol.type}: ${symbol.name}`);
}
```

### Group by Type

```typescript
const grouped = new Map<string, CodeSymbol[]>();
for (const symbol of result.symbols) {
  if (!grouped.has(symbol.type)) {
    grouped.set(symbol.type, []);
  }
  grouped.get(symbol.type)!.push(symbol);
}

for (const [type, symbols] of grouped) {
  console.log(`${type}: ${symbols.length} symbols`);
}
```

### Build Hierarchy

```typescript
const symbolMap = new Map<string, CodeSymbol>();
for (const symbol of result.symbols) {
  symbolMap.set(symbol.name, symbol);
}

// Find children of a class
const classMembers = result.symbols.filter(
  s => s.parentSymbol === 'MyClass'
);
```

## Error Handling

```typescript
try {
  const result = registry.parseFile(filePath, content);
  
  if (result.error) {
    console.error(`Failed to parse ${result.filePath}: ${result.error}`);
    // Unsupported file type or parsing error
  } else {
    // Process result.symbols
  }
} catch (error) {
  // File not found, read error, etc.
  console.error('Error:', error);
}
```

## Registry Information

```typescript
// Get statistics
const stats = registry.getStatistics();
console.log(`Cached parsers: ${stats.cachedParsers}`);
console.log(`Supported languages: ${stats.supportedLanguages}`);
console.log(`Supported extensions: ${stats.supportedExtensions}`);

// Reset parsers (useful for testing)
registry.resetAllParsers();
```

## Symbol Type Reference

```typescript
// 'class' - Class definition
type: 'class'
// Examples: class MyClass { }

// 'function' - Top-level function
type: 'function'
// Examples: function foo() { }, def bar():

// 'method' - Function inside class
type: 'method'
// Examples: foo() { } inside class, def method(self):

// 'variable' - Variable/constant
type: 'variable'
// Examples: const x = 1, val name = "test"

// 'interface' - Interface/trait/protocol
type: 'interface'
// Examples: interface I { }, trait T { }

// 'type' - Type alias
type: 'type'
// Examples: type X = number, type Name = String

// 'enum' - Enumeration
type: 'enum'
// Examples: enum Color { Red, Green }

// 'namespace' - Namespace/package/module
type: 'namespace'
// Examples: namespace Foo { }, package com.example

// 'module' - Module/object
type: 'module'
// Examples: object Singleton { }, export module M { }

// 'struct' - Structure
type: 'struct'
// Examples: struct Point { }, struct S { int x; }
```

## Language Mappings

| Extension | Language   | Parser                 |
| --------- | ---------- | ---------------------- |
| .ts       | TypeScript | TypeScriptSymbolParser |
| .tsx      | TypeScript | TypeScriptSymbolParser |
| .js       | TypeScript | TypeScriptSymbolParser |
| .jsx      | TypeScript | TypeScriptSymbolParser |
| .py       | Python     | PythonSymbolParser     |
| .cpp      | C++        | CppSymbolParser        |
| .h        | C++        | CppSymbolParser        |
| .hpp      | C++        | CppSymbolParser        |
| .cc       | C++        | CppSymbolParser        |
| .cxx      | C++        | CppSymbolParser        |
| .c++      | C++        | CppSymbolParser        |
| .hxx      | C++        | CppSymbolParser        |
| .scala    | Scala      | ScalaSymbolParser      |
| .rs       | Rust       | RustSymbolParser       |

## Advanced Usage

### Custom Processing Chain

```typescript
const registry = SymbolParserRegistry.getInstance();
const result = registry.parseFile('app.ts', code);

// Transform symbols
const documentedSymbols = result.symbols
  .filter(s => s.comments && s.comments.length > 0)
  .map(s => ({
    name: s.name,
    type: s.type,
    docs: s.comments?.[0].content,
  }));

// Use in your application
for (const symbol of documentedSymbols) {
  console.log(`${symbol.name}: ${symbol.docs}`);
}
```

### Batch Processing with Error Recovery

```typescript
const files = ['a.ts', 'b.py', 'c.cpp', 'd.xyz'];
const registry = SymbolParserRegistry.getInstance();

const successful: ParseResult[] = [];
const failed: ParseResult[] = [];

for (const file of files) {
  const result = registry.parseFile(file, fileContent[file]);
  
  if (result.error) {
    failed.push(result);
  } else {
    successful.push(result);
  }
}

console.log(`Processed: ${successful.length} successful, ${failed.length} failed`);
```

### Generate Documentation Index

```typescript
const result = registry.parseFile('api.ts', code);

const index = result.symbols
  .filter(s => s.type === 'function' || s.type === 'class')
  .map(s => ({
    name: s.name,
    type: s.type,
    line: s.startLine,
    signature: s.signature,
    returns: s.returnType,
  }))
  .sort((a, b) => a.line - b.line);

// Print index
for (const item of index) {
  console.log(`${item.line}: ${item.type} ${item.name}`);
}
```

## Troubleshooting

### Symbols Not Found

```typescript
// Check if language is supported
const language = registry.getLanguageForFile('myfile.xyz');
if (language === 'Unknown') {
  console.log('Unsupported file type');
}

// Verify parser is returning symbols
const result = registry.parseFile('file.ts', code);
console.log(`Symbols: ${result.symbols.length}`);
console.log(`Error: ${result.error}`);
```

### Wrong File Language

```typescript
// SymbolParserRegistry detects by extension
// If wrong language is detected, check file extension

// Manual language override (not built-in)
// You would need to use language-specific parser directly:
import { TypeScriptSymbolParser } from './typescriptSymbolParser';
const parser = new TypeScriptSymbolParser();
parser.reset();
const symbols = parser.extractSymbolsFromLine(line, 1);
```

## See Also

- **README.md** - Full documentation
- **IMPLEMENTATION_SUMMARY.md** - Technical details
- **symbolExamples.ts** - Working examples
- **baseSymbolParser.ts** - Abstract base class
- **{language}SymbolParser.ts** - Language-specific implementations
