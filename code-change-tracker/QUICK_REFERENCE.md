# Quick Reference - Scope Tracking System

## 🚀 Quick Start (30 seconds)

```typescript
// 1. Import and create registry (once)
import { VariableParserRegistry } from './variableParsers/variableParserRegistry';
const registry = new VariableParserRegistry();

// 2. Process a file
registry.resetFileScope('cpp');  // Reset for new file
sourceCode.split('\n').forEach((line, idx) => {
  const variables = registry.extractVariablesFromLine(line, idx + 1, 'cpp');
  
  // 3. Use scope info
  variables.forEach(v => {
    console.log(`${v.className}.${v.name} (${v.visibility})`);
  });
});
```

---

## 🎯 Common Patterns

### Find All Private Members
```typescript
const privateMembers = variables.filter(v => 
  v.isClassMember && v.visibility === 'private'
);
```

### Get Class Structure
```typescript
const classMembers = variables
  .filter(v => v.isClassMember && v.className === 'MyClass')
  .groupBy(v => v.visibility);
```

### Check Encapsulation Issues
```typescript
const publicMutable = variables.filter(v =>
  v.visibility === 'public' && !v.isConst && v.isClassMember
);
```

### Process Multiple Files
```typescript
['file1.ts', 'file2.cpp', 'file3.py'].forEach(file => {
  registry.resetFileScope(getExtension(file));
  const content = readFile(file);
  // ... process file ...
});
```

---

## 📖 Key Methods

### VariableParserRegistry

```typescript
// Main extraction method
extractVariablesFromLine(line: string, lineNumber: number, extension: string): VariableInterface[]

// Reset scope for new file
resetFileScope(language?: string): void

// Debug/inspect scope
getCurrentScopeInfo(language: string)
getDebugScopeInfo(language: string): string

// Query support
getSupportedLanguages(): string[]
getSupportedExtensions(): string[]
supportsLanguage(language: string): boolean
supportsExtension(extension: string): boolean
```

### ScopeContextTracker

```typescript
// Update scope based on current line
processLine(line: string, lineNumber: number, language?: string): void

// Query current state
getCurrentScope(): ScopeLevel | undefined
getParentClassName(): string | undefined
isInClass(): boolean
getCurrentVisibility(): 'public' | 'private' | 'protected' | 'default'
getScopeInfo()
getScopePath(): string

// Utility
reset(): void
getDebugInfo(): string
```

---

## 📊 VariableInterface Scope Fields

```typescript
interface VariableInterface {
  name: string;                    // Variable name (always present)
  type?: string;                   // Type annotation
  visibility?: 'public' | 'private' | 'protected';  // NEW
  isStatic?: boolean;              // Static modifier
  isReadonly?: boolean;            // Readonly modifier
  isConst?: boolean;               // Const modifier
  startLine: number;               // Line where declared
  endLine: number;                 // Line where declared (same for single-line)
  
  // NEW FIELDS (populated by scope tracking):
  isClassMember?: boolean;         // true if in class/struct
  className?: string;              // Name of enclosing class
  scopeType?: 'class' | 'struct' | 'namespace' | 'function' | 'block' | 'global';
  scopePath?: string;              // Full scope path
}
```

---

## 🌐 Language Support

| Language   | Class Detection | Visibility   | Scope Path | Notes                                     |
| ---------- | --------------- | ------------ | ---------- | ----------------------------------------- |
| C++        | ✅ Yes           | ✅ Yes        | ✅ Yes      | Full support for public/private/protected |
| TypeScript | ✅ Yes           | ✅ Yes        | ✅ Yes      | Respects explicit modifiers               |
| Python     | ✅ Yes           | ⚠️ Convention | ✅ Limited  | self.x = private, cls.x = protected       |
| Scala      | ✅ Yes           | ✅ Yes        | ✅ Yes      | val/var with visibility                   |
| Rust       | ✅ Yes           | ⚠️ Implicit   | ✅ Limited  | pub fn context                            |

---

## 📁 File Extensions

| Language   | Extensions                             |
| ---------- | -------------------------------------- |
| TypeScript | ts, tsx, js, jsx                       |
| Python     | py, pyi                                |
| C++        | cpp, cc, cxx, c++, c, h, hpp, hxx, h++ |
| Scala      | scala, sc                              |
| Rust       | rs                                     |

---

## 💡 Tips & Tricks

### 1. Reuse Registry for Multiple Files
```typescript
const registry = new VariableParserRegistry();
// Process file 1
registry.resetFileScope('cpp');
processFile('file1.cpp', registry);

// Process file 2
registry.resetFileScope('ts');
processFile('file2.ts', registry);
```

### 2. Debug Scope Issues
```typescript
console.log(registry.getDebugScopeInfo('cpp'));
// Output: "block(global) > class(Person) > ..."
```

### 3. Filter by Scope Type
```typescript
const inClasses = variables.filter(v => v.scopeType === 'class');
const globalVars = variables.filter(v => !v.isClassMember);
```

### 4. Nested Class Access
```typescript
// Get all members in nested class
const nestedMembers = variables.filter(v => 
  v.scopePath?.includes('::')
);
```

### 5. Combine with Other Analysis
```typescript
variables
  .filter(v => v.isClassMember && v.type === 'int')
  .filter(v => v.visibility === 'private')
  .forEach(v => console.log(`Private int: ${v.name}`));
```

---

## 🔍 Common Questions

### Q: Do I need to import ScopeContextTracker?
**A:** No. Registry manages it automatically. Just use `VariableParserRegistry`.

### Q: What if I don't call resetFileScope()?
**A:** Scope from previous file carries over. Always call it when processing new file.

### Q: Is scope tracking automatic?
**A:** Yes. Registry automatically updates scope on each line.

### Q: What about nested functions?
**A:** Scope tracking works, but variables inside functions get function's scope.

### Q: Can I use scope tracking with other parsers?
**A:** ScopeContextTracker is language-agnostic and can be extended.

---

## 🚨 Common Mistakes

❌ **Don't:** Create new registry for each line
```typescript
// SLOW AND WRONG
lines.forEach(line => {
  const registry = new VariableParserRegistry();  // ❌
  registry.extractVariablesFromLine(line, ...);
});
```

✅ **Do:** Reuse registry instance
```typescript
// CORRECT
const registry = new VariableParserRegistry();
lines.forEach((line, idx) => {
  registry.extractVariablesFromLine(line, idx + 1, 'cpp');
});
```

---

❌ **Don't:** Forget to reset scope between files
```typescript
// WRONG - scope from file1 affects file2
processFile('file1.cpp', registry);
processFile('file2.cpp', registry);  // ❌ Wrong scope
```

✅ **Do:** Reset scope for new file
```typescript
// CORRECT
registry.resetFileScope('cpp');
processFile('file1.cpp', registry);

registry.resetFileScope('cpp');
processFile('file2.cpp', registry);
```

---

## 📚 Learn More

- **Complete API Reference**: See `SCOPE_TRACKING_README.md`
- **Architecture Details**: See `SCOPE_TRACKING_SUMMARY.md`
- **Examples**: Run `scopeExamples.ts`
- **Original System**: See `IMPLEMENTATION_SUMMARY.md`

---

## ✨ Summary

**Scope tracking is automatic!** Just:
1. Create registry once
2. Call `resetFileScope()` for each file
3. Call `extractVariablesFromLine()` for each line
4. Use the scope fields in returned variables

Done! 🎉
