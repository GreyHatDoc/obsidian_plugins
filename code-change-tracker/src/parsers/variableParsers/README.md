# Variable Parser System

## Overview

The Variable Parser system is a modular, language-specific extraction engine designed to identify and extract variable declarations from individual lines of source code. This system is optimized for integration into larger code analysis pipelines that process files line-by-line.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           variableParserRegistry                             │
│  (Factory & Dispatcher)                                      │
│  - Manages all language parsers                              │
│  - Routes extraction requests to correct parser              │
│  - Maps file extensions to languages                         │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┬──────────────┐
        ▼                  ▼                  ▼              ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐    ┌─────────┐
   │TypeScript│      │ Python  │      │   C++   │    │  Scala  │
   │ Parser   │      │ Parser  │      │ Parser  │    │ Parser  │
   └─────────┘      └─────────┘      └─────────┘    └─────────┘
        │                │                │               │
        └────────────────┼────────────────┴───────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
   ┌─────────────────┐          ┌─────────────────┐
   │ Rust Parser     │          │ Base Parser     │
   │ (extends Base)  │          │ (Abstract)      │
   └─────────────────┘          └─────────────────┘
```

## Design Philosophy

### 1. **Language Isolation**
Each language parser is self-contained and isolated in its own module. This allows:
- Easy addition of new languages (TypeScript, Kotlin, Ruby, etc.)
- Independent testing and debugging
- Clear separation of concerns
- Language-specific regex patterns without interference

### 2. **Line-by-Line Processing**
The system is explicitly designed for line-by-line iteration:
- Single method signature: `extractVariablesFromLine(line, lineNumber)`
- No state maintained between lines
- Efficient parsing of individual lines
- Compatible with streaming/incremental analysis

### 3. **Consistent Interface**
All parsers implement the same interface via `BaseVariableParser`:
- Uniform method signatures
- Consistent return types (`VariableInterface[]`)
- Predictable behavior across languages
- Easy to extend the registry with new parsers

### 4. **Graceful Degradation**
- Unsupported languages return empty arrays (not errors)
- Regex patterns handle edge cases conservatively
- Better to miss a variable than incorrectly identify one
- Logging for debugging (can be enhanced)

## Usage

### Basic Usage

```typescript
import { VariableParserRegistry } from './parsers/variableParsers/variableParserRegistry';

// Create registry (instantiate once, reuse)
const registry = new VariableParserRegistry();

// Parse a line
const variables = registry.extractVariablesFromLine('const x: number = 5;', 10, 'ts');
// Returns: [{ name: 'x', type: 'number', isConst: true, startLine: 10, endLine: 10 }]
```

### Integration with File Scanning

```typescript
// Example: Extract all variables from a file
const lines = fileContent.split('\n');
const allVariables: VariableInterface[] = [];

lines.forEach((line, index) => {
  const lineNum = index + 1; // 1-indexed
  const variables = registry.extractVariablesFromLine(line, lineNum, 'rs');
  allVariables.push(...variables);
});
```

### Checking Supported Languages

```typescript
// Check what's supported
const supported = registry.getSupportedLanguages();
// Returns: ['typescript', 'python', 'cpp', 'scala', 'rust']

const isSupported = registry.supportsExtension('py');
// Returns: true

const variables = registry.extractVariablesFromLine('x = 5', 1, 'py');
// Returns: [{ name: 'x', startLine: 1, endLine: 1 }]
```

## Language Coverage

### TypeScript / JavaScript
**Supported Patterns:**
- Variable declarations: `const x = 5`, `let y: string`, `var z`
- Class properties: `private x: Type`, `public readonly y`
- Type annotations: Full TypeScript type syntax
- Destructuring: `const { a, b } = obj`, `let [x, y] = array`

**Examples:**
```typescript
const name: string = 'John';        // ✓ Extracted: name
let age: number = 30;               // ✓ Extracted: age
private readonly id: UUID;          // ✓ Extracted: id
const { x, y } = point;            // ✓ Extracted: x, y
```

### Python
**Supported Patterns:**
- Variable assignments: `x = 5`, `name = "John"`
- Type hints: `x: int = 5`, `items: List[str]`
- Self/class attributes: `self.name = value`, `cls.count = 0`
- Tuple unpacking: `a, b = 1, 2`, `x, *rest = list`
- Annotations: `count: int` (no assignment)

**Examples:**
```python
x: int = 5                          # ✓ Extracted: x
self.name = "John"                  # ✓ Extracted: name
a, b = (1, 2)                       # ✓ Extracted: a, b
items: List[str]                    # ✓ Extracted: items
```

### C++
**Supported Patterns:**
- Variable declarations with types: `int x = 5;`, `float* ptr;`
- Modifiers: `const int y`, `static int counter`, `volatile T var`
- Pointers/references: `int* p`, `const string& ref`
- Templates: `vector<int> v`, `map<string, int> m`
- Class members: `private: int x;`, `public: Type y;`

**Examples:**
```cpp
int x = 5;                          // ✓ Extracted: x
const float* ptr = nullptr;         // ✓ Extracted: ptr
static int counter = 0;             // ✓ Extracted: counter
std::vector<int> vec;               // ✓ Extracted: vec
private: Type member;               // ✓ Extracted: member
```

### Scala
**Supported Patterns:**
- Immutable values: `val x = 5`, `val name: String = "John"`
- Mutable variables: `var x = 5`, `var counter: Int = 0`
- Visibility modifiers: `private val x`, `protected var y`
- Pattern matching: `val (a, b) = tuple`, `val List(head, tail) = list`
- For-comprehensions: `for (i <- 1 to 10)` binds `i`
- Lazy values: `lazy val computed = expensive()`

**Examples:**
```scala
val x: Int = 5                      // ✓ Extracted: x
var name: String = "John"           // ✓ Extracted: name
private val id = UUID()             // ✓ Extracted: id
val (a, b) = (1, 2)                // ✓ Extracted: a, b
for (i <- 1 to 10) println(i)      // ✓ Extracted: i
lazy val cache = load()             // ✓ Extracted: cache
```

### Rust
**Supported Patterns:**
- Immutable bindings: `let x = 5;`, `let y: i32 = 10;`
- Mutable bindings: `let mut x = 5;`, `let mut y: u32`
- Constants: `const MAX: u32 = 100;`
- Statics: `static COUNTER: usize = 0;`
- Destructuring: `let (a, b) = (1, 2);`, `let Some(x) = option;`
- Struct destructuring: `let Point { x, y } = point;`
- Function parameters: `fn func(x: i32, mut y: String)`

**Examples:**
```rust
let x: i32 = 5;                     // ✓ Extracted: x
let mut y = 10;                     // ✓ Extracted: y (mutable)
const MAX: u32 = 100;               // ✓ Extracted: MAX
let (a, b) = (1, 2);               // ✓ Extracted: a, b
let Point { x, y } = point;        // ✓ Extracted: x, y
fn func(x: i32, mut z: f64)        // ✓ Extracted: x, z
```

## Implementation Details

### Base Parser Class
Located in `baseVariableParser.ts`:
- Abstract base class that all language parsers extend
- Provides common helper methods:
  - `trim()`: String normalization
  - `isEmpty()`: Empty check
  - `isCommentLine()`: Comment detection
  - `createVariable()`: Consistent VariableInterface creation
- Ensures consistent interface across all parsers

### Regex Strategy

**Why Regex?**
- Fast line-level parsing
- Minimal dependencies
- Easy to understand and debug
- Sufficient for variable declarations
- Good performance profile

**Performance Optimizations:**
1. **Early Exits**: Skip comment/empty lines immediately
2. **Non-greedy Quantifiers**: Use `...?` to prevent excessive backtracking
3. **Specific Patterns**: Match language-specific syntax precisely
4. **No Lookaround**: Generally avoid lookahead/lookbehind for speed

**Example Pattern (TypeScript):**
```regex
\b(const|let|var)\s+(\w+)(?:\s*:\s*([^=;,]+?))?(?:\s*=)?(?:[;,]|$)/g
```
- `\b`: Word boundary (prevents matching inside identifiers)
- `(const|let|var)`: Exact keyword match
- `\s+`: Required whitespace
- `(\w+)`: Variable name
- `(?:...)?`: Optional non-capturing groups
- `[^=;,]+?`: Non-greedy match (stops at first = or ;)

### Error Handling

**Philosophy: Graceful Degradation**
- No exceptions thrown from extractors
- Unsupported languages return empty arrays
- Regex mismatches return empty arrays (not errors)
- False negatives preferred over false positives

**Validation:**
- Each parser validates captured variable names
- Filters out control structure keywords
- Skips invalid identifiers
- Checks for meaningful patterns before returning results

## Adding New Language Parsers

### Step 1: Create Parser Class
```typescript
import { VariableInterface } from '../codeParser';
import { BaseVariableParser } from './baseVariableParser';

export class GoVariableParser extends BaseVariableParser {
  extractVariablesFromLine(line: string, lineNumber: number): VariableInterface[] {
    const variables: VariableInterface[] = [];
    
    // Implement Go-specific pattern matching
    // Examples: var x int; const y = 5; x := 10
    
    return variables;
  }
}
```

### Step 2: Register in Registry
```typescript
// In variableParserRegistry.ts constructor:
const goParser = new GoVariableParser();
this.parsers.set('go', goParser);
this.registerExtensions('go', ['go']);
```

### Step 3: Document Patterns
Add comprehensive comments explaining:
- Supported language features
- Regex patterns used
- Edge cases handled
- Examples of correctly parsed lines

## Testing

Suggested test cases for each parser:

```typescript
// Basic declarations
const line1 = 'const x = 5;';
const vars1 = parser.extractVariablesFromLine(line1, 1);
assert(vars1.length === 1 && vars1[0].name === 'x');

// Type annotations
const line2 = 'let y: string = "hi";';
const vars2 = parser.extractVariablesFromLine(line2, 1);
assert(vars2[0].type === 'string');

// Modifiers
const line3 = 'private readonly id: UUID;';
const vars3 = parser.extractVariablesFromLine(line3, 1);
assert(vars3[0].visibility === 'private' && vars3[0].isReadonly === true);

// Destructuring
const line4 = 'const { a, b } = obj;';
const vars4 = parser.extractVariablesFromLine(line4, 1);
assert(vars4.length === 2 && vars4.map(v => v.name).includes('a'));

// Comments
const line5 = '// const x = 5;';
const vars5 = parser.extractVariablesFromLine(line5, 1);
assert(vars5.length === 0);
```

## Performance Characteristics

- **Time Complexity**: O(n) where n = line length (single regex pass)
- **Space Complexity**: O(k) where k = number of variables on line (typically 1-3)
- **Regex Compilation**: Done once per parser instance (not per line)
- **Typical Performance**: <1ms per line on modern hardware

## Future Enhancements

1. **Additional Languages**: Kotlin, Java, C#, Go, Ruby, PHP
2. **Type Inference**: Track type flows across lines
3. **Semantic Analysis**: Connect declarations with usages
4. **Caching**: Cache parsed results for unchanged files
5. **Performance Profiling**: Measure and optimize bottlenecks
6. **Advanced Patterns**: Complex destructuring, type generics
7. **Error Recovery**: Better handling of malformed code

## Debugging

Enable debugging by adding console logs to parsers:

```typescript
extractVariablesFromLine(line: string, lineNumber: number): VariableInterface[] {
  console.log(`[${this.constructor.name}] Parsing line ${lineNumber}: ${line}`);
  // ... parsing logic
  console.log(`[${this.constructor.name}] Found ${variables.length} variables`);
  return variables;
}
```

## License

MIT (Same as parent project)

---

**Author**: Code Change Tracker Development Team  
**Last Updated**: November 28, 2025
