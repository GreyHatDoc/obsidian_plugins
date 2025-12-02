# Comment Parser Quick Reference

## Quick Start (30 seconds)

```typescript
import { CommentParserRegistry } from './parsers/commentParsers/commentParserRegistry';

const registry = CommentParserRegistry.getInstance();
const comments = registry.extractAllComments(sourceCode, 'file.ts');

// Done! Access comment data:
comments.forEach(c => console.log(c.content, c.type, c.parent));
```

---

## API Cheat Sheet

### Registry (Singleton)
```typescript
const registry = CommentParserRegistry.getInstance();

// Extract all comments from code + filename
registry.extractAllComments(sourceCode, 'file.ts');

// Line-by-line processing
registry.resetParserForFile('file.py');
registry.extractComments(line, lineNumber);

// Utilities
registry.getLanguageFromPath('file.cpp');           // → 'cpp'
registry.isLanguageSupported('typescript');        // → true
registry.getSupportedExtensions();                 // → ['.ts', '.py', ...]
```

### Direct Parser Usage
```typescript
import { TypeScriptCommentParser } from './parsers/commentParsers/typescriptCommentParser';

const parser = new TypeScriptCommentParser();
parser.reset();

const comments = parser.extractCommentsFromLine(line, lineNumber);
console.log(parser.getDebugInfo());
```

---

## Supported Languages

| Language   | Extensions             | Markers                                   |
| ---------- | ---------------------- | ----------------------------------------- |
| TypeScript | `.ts, .tsx, .js, .jsx` | `//`, `/* */`, `/** */`                   |
| Python     | `.py, .pyi`            | `#`, `"""`, `'''`                         |
| C++        | `.cpp, .cc, .h, .hpp`  | `//`, `/* */`, `/**`, `///`               |
| Scala      | `.scala`               | `//`, `/* */`, `/**`                      |
| Rust       | `.rs`                  | `//`, `///`, `//!`, `/* */`, `/**`, `/*!` |

---

## CommentInterface

```typescript
interface CommentInterface {
  content: string;                    // The comment text
  type: 'line' | 'block' | 'docstring';
  parent?: string;                    // Associated symbol (function, class)
  startLine: number;                  // Line number (1-indexed)
  endLine: number;                    // Line number (1-indexed)
}
```

---

## Comment Types

| Type          | When                  | Example         |
| ------------- | --------------------- | --------------- |
| `'line'`      | Single-line comment   | `// comment`    |
| `'block'`     | Multi-line comment    | `/* comment */` |
| `'docstring'` | Documentation comment | `/** JSDoc */`  |

---

## Common Patterns

### Pattern 1: Process File
```typescript
const registry = CommentParserRegistry.getInstance();
const comments = registry.extractAllComments(code, 'myFile.ts');
```

### Pattern 2: Stream Lines
```typescript
const parser = new TypeScriptCommentParser();
parser.reset();

lines.forEach((line, i) => {
  const comments = parser.extractCommentsFromLine(line, i + 1);
  // Process...
});
```

### Pattern 3: Multi-Language
```typescript
const registry = CommentParserRegistry.getInstance();

['file.ts', 'script.py', 'code.cpp'].forEach(file => {
  registry.resetParserForFile(file);
  const comments = registry.extractAllComments(readFile(file), file);
  // Process...
});
```

---

## Important Rules

⚠️ **Always reset between files**:
```typescript
parser.reset();  // ← DO THIS
const comments = extractFromFile();

parser.reset();  // ← DO THIS TOO
const comments = extractFromFile2();
```

⚠️ **Process lines sequentially**:
```typescript
// ✅ CORRECT
lines.forEach((line, i) => parser.extractCommentsFromLine(line, i + 1));

// ❌ WRONG
const result = lines.map(line => parser.extractCommentsFromLine(line, 1));
```

---

## Examples

### Extract comments from TypeScript file
```typescript
const code = `
  // Initialize
  const x = 5;
  /**
   * Greet someone
   */
  function greet(name) {
    return "Hello " + name;
  }
`;

const registry = CommentParserRegistry.getInstance();
const comments = registry.extractAllComments(code, 'example.ts');

// Output: 3 comments
// - Line 1: type='line', content='Initialize'
// - Line 4-6: type='docstring', content='Greet someone', parent='greet'
```

### Extract comments from Python file
```typescript
const code = `
# Calculate total
def sum(numbers):
    """Sum all numbers in list"""
    return sum(numbers)
`;

const comments = registry.extractAllComments(code, 'example.py');

// Output: 2 comments
// - Line 1: type='line', content='Calculate total'
// - Line 3-4: type='docstring', content='Sum all numbers in list', parent='sum'
```

---

## Troubleshooting

**Comments in strings not ignored?**
→ Already handled! The parser tracks string context automatically.

**Multi-line comments not detected?**
→ Make sure to call `reset()` between files.

**Comment not associated with function?**
→ Place the comment immediately before the function declaration.

**Language not detected?**
→ Check file extension. See `getSupportedExtensions()`.

---

## Files in System

```
commentParsers/
├── baseCommentParser.ts          # Base class
├── typescriptCommentParser.ts    # TypeScript
├── pythonCommentParser.ts        # Python
├── cppCommentParser.ts           # C++
├── scalaCommentParser.ts         # Scala
├── rustCommentParser.ts          # Rust
├── commentParserRegistry.ts      # Registry (use this!)
├── commentExamples.ts            # 14 examples
├── README.md                     # Full documentation
├── IMPLEMENTATION_SUMMARY.md     # Implementation details
└── QUICK_REFERENCE.md            # This file
```

---

## Get Help

- **API Details**: See `README.md`
- **Examples**: See `commentExamples.ts` (14 examples)
- **Implementation**: See `IMPLEMENTATION_SUMMARY.md`
- **Full Docs**: See `README.md`

---

## Performance

- **Time**: O(n) where n = number of lines
- **Memory**: Minimal per-file state
- **Parsing**: Line-by-line (streaming compatible)
- **Caching**: Parser instances cached for reuse

---

**Status**: ✅ Production Ready
**Last Updated**: 2024
