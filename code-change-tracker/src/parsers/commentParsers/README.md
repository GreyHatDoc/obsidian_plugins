# Comment Parser System - Documentation

## Overview

The Comment Parser System provides comprehensive, language-specific comment extraction from source code in TypeScript, Python, C++, Scala, and Rust.

**Key Capabilities:**
- ✅ Single-line comment extraction (e.g., `//`, `#`, etc.)
- ✅ Multi-line comment extraction (e.g., `/* */`, `""" """`)
- ✅ Documentation/docstring extraction (JSDoc, Scaladoc, Doxygen, etc.)
- ✅ Comment association with code elements (functions, classes, etc.)
- ✅ Multi-line state tracking across file boundaries
- ✅ Language auto-detection from file extensions

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│           CommentParserRegistry (Singleton)            │
│                                                         │
│  - Language routing (auto-detection)                   │
│  - Parser instance management                          │
│  - Batch processing utilities                          │
└──────────────────┬──────────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
      ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│TypeScript│ │ Python   │ │  C++     │
│ Parser   │ │ Parser   │ │ Parser   │
└──────────┘ └──────────┘ └──────────┘
      │            │            │
      └────────────┼────────────┘
                   │
                   ▼
      ┌────────────────────────┐
      │ BaseCommentParser      │
      │ (Abstract Base Class)  │
      │                        │
      │ - Helper methods       │
      │ - Common logic         │
      │ - State tracking       │
      └────────────────────────┘
```

### Key Classes

#### 1. BaseCommentParser (Abstract Base Class)

The abstract foundation for all language-specific parsers. Provides:
- Common helper methods for marker detection
- Multi-line comment state tracking
- Content cleaning and normalization
- Debugging support

```typescript
abstract class BaseCommentParser {
  abstract extractCommentsFromLine(
    line: string,
    lineNumber: number
  ): CommentInterface[];

  // Helper methods for subclasses
  protected removeCommentMarker(line: string, marker: string): string
  protected cleanCommentContent(content: string): string
  protected isDocstringStart(line: string): boolean
  // ... more helpers
}
```

#### 2. Language-Specific Parsers

Each parser extends `BaseCommentParser` and implements language-specific logic:

- **TypeScriptCommentParser**: Handles `//, /*, /**` markers
- **PythonCommentParser**: Handles `#` and triple-quote docstrings
- **CppCommentParser**: Handles `//, /*, /**, ///` with Doxygen support
- **ScalaCommentParser**: Handles `//, /*, /**` with nested comment support
- **RustCommentParser**: Handles `//,  ///, //!, /*, /**, /*!` with doc support

#### 3. CommentParserRegistry (Singleton)

Factory and dispatcher for managing parsers:

```typescript
class CommentParserRegistry {
  static getInstance(): CommentParserRegistry
  
  extractAllComments(
    sourceCode: string,
    filePath: string
  ): CommentInterface[]
  
  resetParserForFile(filePath: string): void
  extractComments(
    line: string,
    lineNumber: number,
    language?: CommentParserLanguage
  ): CommentInterface[]
  
  getLanguageFromPath(filePath: string): CommentParserLanguage | null
}
```

## Supported Languages and Comment Types

### TypeScript/JavaScript

| Type  | Marker   | Example                     |
| ----- | -------- | --------------------------- |
| Line  | `//`     | `// This is a comment`      |
| Block | `/* */`  | `/* Multi-line\ncomment */` |
| Doc   | `/** */` | `/** JSDoc\n@param x */`    |

### Python

| Type      | Marker         | Example                       |
| --------- | -------------- | ----------------------------- |
| Line      | `#`            | `# This is a comment`         |
| Docstring | `"""` or `'''` | `"""Multi-line\ndocstring"""` |

### C++

| Type          | Marker   | Example                     |
| ------------- | -------- | --------------------------- |
| Line          | `//`     | `// This is a comment`      |
| Block         | `/* */`  | `/* Multi-line\ncomment */` |
| Doxygen Line  | `///`    | `/// Doxygen comment`       |
| Doxygen Block | `/** */` | `/** Doxygen\n@param x */`  |

### Scala

| Type  | Marker   | Example                                  |
| ----- | -------- | ---------------------------------------- |
| Line  | `//`     | `// This is a comment`                   |
| Block | `/* */`  | `/* Nested\n/* comments */ supported */` |
| Doc   | `/** */` | `/** Scaladoc\n@param x */`              |

### Rust

| Type      | Marker               | Example                                  |
| --------- | -------------------- | ---------------------------------------- |
| Line      | `//`                 | `// This is a comment`                   |
| Doc Line  | `///` or `//!`       | `/// Outer doc` or `//! Inner doc`       |
| Block     | `/* */`              | `/* Nested\n/* comments */ supported */` |
| Doc Block | `/** */` or `/*! */` | `/** Rust doc\n@param x */`              |

## Usage Examples

### Example 1: Basic Usage with Registry

```typescript
const registry = CommentParserRegistry.getInstance();

// Extract all comments from a file
const comments = registry.extractAllComments(sourceCode, 'myFile.ts');

comments.forEach(comment => {
  console.log(`[${comment.startLine}] ${comment.type}: ${comment.content}`);
});
```

### Example 2: Line-by-Line Processing

```typescript
const registry = CommentParserRegistry.getInstance();

registry.resetParserForFile('script.py');

const lines = sourceCode.split('\n');
lines.forEach((line, idx) => {
  const comments = registry.extractComments(line, idx + 1, 'python');
  // Process comments
});
```

### Example 3: Direct Parser Usage

```typescript
const parser = new TypeScriptCommentParser();
parser.reset();

const line1 = '// Initialize counter';
const line2 = 'let count = 0;  // Start at zero';

const comments1 = parser.extractCommentsFromLine(line1, 1);
const comments2 = parser.extractCommentsFromLine(line2, 2);
```

### Example 4: Multi-Language Project

```typescript
const registry = CommentParserRegistry.getInstance();

const files = [
  'src/main.ts',
  'src/utils.py',
  'lib/math.cpp'
];

files.forEach(filePath => {
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  const comments = registry.extractAllComments(sourceCode, filePath);
  
  console.log(`${filePath}: ${comments.length} comments found`);
});
```

## CommentInterface

All parsers return `CommentInterface` objects:

```typescript
interface CommentInterface {
  content: string;                              // The comment text
  type: 'line' | 'block' | 'docstring';        // Comment type
  parent?: string;                              // Associated code element
  startLine: number;                            // 1-indexed start line
  endLine: number;                              // 1-indexed end line
}
```

### Field Descriptions

- **content**: The actual comment text, cleaned of markers and formatting
- **type**:
  - `'line'`: Single-line comment (`//`, `#`, etc.)
  - `'block'`: Multi-line comment (`/* */`, `""" """`, etc.)
  - `'docstring'`: Documentation comment (`/** */`, `///`, docstrings)
- **parent**: Name of the associated code element (function, class, etc.)
- **startLine**: Line number where the comment begins (1-indexed)
- **endLine**: Line number where the comment ends

## Advanced Features

### 1. Comment Association with Code Elements

The parsers track recent code element declarations and associate comments:

```typescript
// This comment will be associated with the function
/**
 * Greet someone by name
 */
function greet(name: string) {
  return `Hello ${name}`;
}
```

Result:
```javascript
{
  content: "Greet someone by name",
  type: "docstring",
  parent: "greet",        // ← Associated with function
  startLine: 8,
  endLine: 10
}
```

### 2. Multi-Line State Management

Parsers maintain state across line boundaries to track multi-line comments:

```typescript
parser.reset();

const result1 = parser.extractCommentsFromLine('/* Start', 1);    // Empty (in-progress)
const result2 = parser.extractCommentsFromLine(' * Middle', 2);   // Empty (still in-progress)
const result3 = parser.extractCommentsFromLine(' */', 3);         // Returns complete comment
```

### 3. Language Detection from File Path

```typescript
const registry = CommentParserRegistry.getInstance();

registry.getLanguageFromPath('myFile.ts');      // Returns 'typescript'
registry.getLanguageFromPath('script.py');      // Returns 'python'
registry.getLanguageFromPath('code.cpp');       // Returns 'cpp'
```

Supported extensions:
- TypeScript: `.ts, .tsx, .js, .jsx, .mjs, .cjs`
- Python: `.py, .pyi`
- C++: `.cpp, .cc, .cxx, .c, .h, .hpp, .hxx`
- Scala: `.scala`
- Rust: `.rs`

### 4. Parser State Debugging

```typescript
const parser = new TypeScriptCommentParser();

const debugInfo = parser.getDebugInfo();
console.log(debugInfo);
// Output:
// {
//   language: 'TypeScript',
//   inMultiLineComment: true,
//   currentCommentType: 'block',
//   currentCommentStartLine: 5,
//   previousSymbol: 'myFunction',
//   currentScope: null
// }
```

## Important Design Patterns

### 1. Stateful Parsing

Parsers are **stateful** across lines in a file:

```typescript
// ✅ CORRECT: Process all lines sequentially
parser.reset();
lines.forEach((line, idx) => {
  const comments = parser.extractCommentsFromLine(line, idx + 1);
  // ...
});

// ❌ WRONG: Reusing parser without reset between files
parser.extractCommentsFromLine(line1, 1);
parser.extractCommentsFromLine(line2, 2);  // From file1
// ... switch to file2 ...
parser.extractCommentsFromLine(line3, 1);  // From file2 - WRONG! Parser still has state from file1
```

### 2. Reset for New Files

Always call `reset()` or `resetParserForFile()` when starting a new file:

```typescript
// ✅ CORRECT: Reset between files
parser.reset();
const comments1 = extractFromFile1();

parser.reset();  // ← Important!
const comments2 = extractFromFile2();
```

### 3. Registry Pattern for Multi-Language

Use the registry when working with multiple languages:

```typescript
const registry = CommentParserRegistry.getInstance();

// ✅ CORRECT: Registry handles state management
registry.resetParserForFile('file1.ts');
const comments1 = registry.extractAllComments(code1, 'file1.ts');

registry.resetParserForFile('file2.py');
const comments2 = registry.extractAllComments(code2, 'file2.py');
```

## Performance Considerations

### 1. Line-by-Line Processing

Comments are extracted line-by-line, enabling streaming:

```typescript
// Can process large files with streaming
parser.reset();
fileStream.on('line', (line, lineNum) => {
  const comments = parser.extractCommentsFromLine(line, lineNum);
  processComments(comments);
});
```

### 2. Parser Caching

The registry caches parser instances:

```typescript
const registry = CommentParserRegistry.getInstance();

// First call creates parser, caches it
registry.extractAllComments(code1, 'file1.ts');

// Second call reuses cached parser
registry.extractAllComments(code2, 'file2.ts');
```

Clear cache if memory is a concern:

```typescript
registry.clearCache();  // Frees all cached parser instances
```

### 3. Complexity

- Time: O(n) where n = number of lines
- Space: O(m) where m = number of comments (plus multi-line state)

## Troubleshooting

### Comments Not Being Detected

**Problem**: Comments in strings aren't being ignored

```typescript
// ❌ WRONG: Parser sees // in URL as comment
const url = "http://example.com";
```

**Solution**: This is handled automatically via `findCommentMarker()` which tracks string context.

### Multi-Line Comments Not Completing

**Problem**: Multi-line comment spans multiple files

```typescript
// ❌ Parser state lost between files
parser.extractCommentsFromLine('/*', 1);
// ... file ends ...
// ... new file starts ...
parser.extractCommentsFromLine(' */', 1);  // ← Not associated with comment start
```

**Solution**: Always call `reset()` between files.

### Wrong Parent Association

**Problem**: Comment not associated with intended function

```typescript
/**
 * Does something
 */
// <-- Comment here

function myFunc() {}
```

**Solution**: Move comment immediately before the function declaration.

## API Reference

### CommentParserRegistry

```typescript
class CommentParserRegistry {
  static getInstance(): CommentParserRegistry
  
  resetParserForFile(filePath: string): void
  extractComments(
    line: string,
    lineNumber: number,
    language?: CommentParserLanguage
  ): CommentInterface[]
  
  extractAllComments(
    sourceCode: string,
    filePath: string
  ): CommentInterface[]
  
  getLanguageFromPath(filePath: string): CommentParserLanguage | null
  isLanguageSupported(language: string): boolean
  getSupportedExtensions(): string[]
  getSupportedLanguages(): CommentParserLanguage[]
  
  createNewParser(language: CommentParserLanguage): BaseCommentParser
  clearCache(): void
  getDebugInfo(): object
}
```

### BaseCommentParser

```typescript
abstract class BaseCommentParser {
  abstract extractCommentsFromLine(
    line: string,
    lineNumber: number
  ): CommentInterface[]
  
  reset(): void
  getDebugInfo(): object
  
  // Protected helpers
  protected removeCommentMarker(line: string, marker: string): string
  protected cleanCommentContent(
    content: string,
    preserveEmptyLines?: boolean
  ): string
  protected createComment(
    content: string,
    type: 'line' | 'block' | 'docstring',
    startLine: number,
    endLine: number,
    parent?: string
  ): CommentInterface
  protected extractSymbolName(line: string): string | null
  protected isDocstringStart(line: string): boolean
  protected findCommentMarker(line: string, marker: string): number
}
```

## See Also

- `commentExamples.ts` - 14 comprehensive examples
- `baseCommentParser.ts` - Abstract base with helper methods
- `typescriptCommentParser.ts` - TypeScript/JavaScript implementation
- `pythonCommentParser.ts` - Python implementation
- `cppCommentParser.ts` - C++ implementation
- `scalaCommentParser.ts` - Scala implementation
- `rustCommentParser.ts` - Rust implementation
