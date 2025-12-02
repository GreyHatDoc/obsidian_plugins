import { VariableParserRegistry } from './variableParserRegistry';
import { VariableInterface } from '../codeParser';

/**
 * USAGE EXAMPLES AND TEST CASES
 * 
 * This file demonstrates how to use the Variable Parser Registry
 * for extracting variable declarations from different languages.
 * 
 * These examples can be used for:
 * 1. Learning the API
 * 2. Writing tests
 * 3. Debugging parser behavior
 * 4. Integration examples
 */

// ============================================================================
// EXAMPLE 1: Basic Single-Line Extraction
// ============================================================================

function example1_basicExtraction() {
    console.log('\n=== EXAMPLE 1: Basic Single-Line Extraction ===\n');

    const registry = new VariableParserRegistry();

    // TypeScript: Extract a simple variable declaration
    const tsLine = 'const name: string = "Alice";';
    const tsVars = registry.extractVariablesFromLine(tsLine, 1, 'ts');
    console.log(`TypeScript: "${tsLine}"`);
    console.log(`Result: ${JSON.stringify(tsVars, null, 2)}`);
    // Expected: [{ name: 'name', type: 'string', isConst: true, startLine: 1, endLine: 1 }]

    // Python: Extract a variable with type hint
    const pyLine = 'count: int = 42';
    const pyVars = registry.extractVariablesFromLine(pyLine, 5, 'py');
    console.log(`\nPython: "${pyLine}"`);
    console.log(`Result: ${JSON.stringify(pyVars, null, 2)}`);
    // Expected: [{ name: 'count', type: 'int', startLine: 5, endLine: 5 }]

    // Rust: Extract a mutable binding
    const rsLine = 'let mut counter: u32 = 0;';
    const rsVars = registry.extractVariablesFromLine(rsLine, 10, 'rs');
    console.log(`\nRust: "${rsLine}"`);
    console.log(`Result: ${JSON.stringify(rsVars, null, 2)}`);
    // Expected: [{ name: 'counter', type: 'u32', isReadonly: false, startLine: 10, endLine: 10 }]
}

// ============================================================================
// EXAMPLE 2: Processing a Complete File Line-by-Line
// ============================================================================

function example2_processFile() {
    console.log('\n=== EXAMPLE 2: Process Entire File Line-by-Line ===\n');

    const registry = new VariableParserRegistry();

    // Sample TypeScript code (could be read from file)
    const typeScriptCode = `
    import { Component } from '@angular/core';
    
    class User {
      private id: UUID;
      public name: string;
      protected age: number;
      
      constructor(id: UUID, name: string, age: number) {
        this.id = id;
        this.name = name;
        this.age = age;
      }
      
      public displayInfo() {
        const fullInfo = \`\${this.name} is \${this.age}\`;
        console.log(fullInfo);
      }
    }
  `.trim();

    const lines = typeScriptCode.split('\n');
    const allVariables: VariableInterface[] = [];
    const variablesByLine: Map<number, VariableInterface[]> = new Map();

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const vars = registry.extractVariablesFromLine(line, lineNum, 'ts');

        if (vars.length > 0) {
            variablesByLine.set(lineNum, vars);
            allVariables.push(...vars);

            console.log(`Line ${lineNum}: ${line.trim()}`);
            console.log(`  Found: ${vars.map(v => `${v.name} (${v.type})`).join(', ')}`);
        }
    });

    console.log(`\nTotal variables found: ${allVariables.length}`);
    console.log(`Variables: ${allVariables.map(v => v.name).join(', ')}`);
}

// ============================================================================
// EXAMPLE 3: Handling Multiple Languages
// ============================================================================

function example3_multiLanguage() {
    console.log('\n=== EXAMPLE 3: Multiple Languages ===\n');

    const registry = new VariableParserRegistry();

    const testCases = [
        // TypeScript
        { lang: 'ts', ext: 'ts', line: 'const user: User = new User();' },
        { lang: 'TypeScript', ext: 'tsx', line: 'let state: React.State<T> = null;' },
        { lang: 'JavaScript', ext: 'js', line: 'var x = 5;' },

        // Python
        { lang: 'Python', ext: 'py', line: 'items: List[str] = []' },
        { lang: 'Python', ext: 'pyi', line: 'self.value: Optional[int] = None' },

        // C++
        { lang: 'C++', ext: 'cpp', line: 'static const int MAX_SIZE = 100;' },
        { lang: 'C++', ext: 'h', line: 'std::vector<std::string> names;' },

        // Scala
        { lang: 'Scala', ext: 'scala', line: 'val immutable: String = "fixed"' },
        { lang: 'Scala', ext: 'sc', line: 'var counter: Int = 0' },

        // Rust
        { lang: 'Rust', ext: 'rs', line: 'let mut buffer: Vec<u8> = Vec::new();' },
    ];

    for (const test of testCases) {
        const vars = registry.extractVariablesFromLine(test.line, 1, test.ext);
        const result = vars.length > 0
            ? `✓ Found: ${vars.map(v => v.name).join(', ')}`
            : '✗ No variables found';
        console.log(`${test.lang.padEnd(15)} [${test.ext.padEnd(3)}] ${result}`);
    }
}

// ============================================================================
// EXAMPLE 4: Analyzing Parser Capabilities
// ============================================================================

function example4_parserCapabilities() {
    console.log('\n=== EXAMPLE 4: Parser Capabilities ===\n');

    const registry = new VariableParserRegistry();

    console.log('Supported Languages:');
    registry.getSupportedLanguages().forEach(lang => {
        console.log(`  - ${lang}`);
    });

    console.log('\nSupported File Extensions:');
    const extensions = registry.getSupportedExtensions();
    console.log(`  Total: ${extensions.length} extensions`);
    console.log(`  Examples: ${extensions.slice(0, 10).join(', ')}...`);

    console.log('\nLanguage Support Matrix:');
    const testLangs = ['go', 'typescript', 'python', 'ruby', 'rust'];
    for (const lang of testLangs) {
        const supported = registry.supportsLanguage(lang) ? '✓' : '✗';
        console.log(`  ${supported} ${lang}`);
    }
}

// ============================================================================
// EXAMPLE 5: Edge Cases and Complex Patterns
// ============================================================================

function example5_complexPatterns() {
    console.log('\n=== EXAMPLE 5: Complex Patterns ===\n');

    const registry = new VariableParserRegistry();

    // TypeScript: Destructuring
    console.log('TypeScript - Destructuring:');
    let vars = registry.extractVariablesFromLine('const { id, name, age } = user;', 1, 'ts');
    console.log(`  Input: const { id, name, age } = user;`);
    console.log(`  Found: ${vars.map(v => v.name).join(', ')}`);
    console.log(`  Count: ${vars.length} (expected: 3)\n`);

    // Python: Tuple unpacking
    console.log('Python - Tuple Unpacking:');
    vars = registry.extractVariablesFromLine('first, *rest, last = data', 1, 'py');
    console.log(`  Input: first, *rest, last = data`);
    console.log(`  Found: ${vars.map(v => v.name).join(', ')}`);
    console.log(`  Count: ${vars.length} (expected: 3)\n`);

    // C++: Complex type with pointers
    console.log('C++ - Complex Type:');
    vars = registry.extractVariablesFromLine('const std::shared_ptr<MyClass>* ptr = nullptr;', 1, 'cpp');
    console.log(`  Input: const std::shared_ptr<MyClass>* ptr = nullptr;`);
    console.log(`  Found: ${vars.map(v => `${v.name}: ${v.type}`).join(', ')}`);
    console.log(`  Count: ${vars.length} (expected: 1)\n`);

    // Scala: Pattern matching
    console.log('Scala - Pattern Matching:');
    vars = registry.extractVariablesFromLine('val (x, y, z) = (1, 2, 3)', 1, 'scala');
    console.log(`  Input: val (x, y, z) = (1, 2, 3)`);
    console.log(`  Found: ${vars.map(v => v.name).join(', ')}`);
    console.log(`  Count: ${vars.length} (expected: 3)\n`);

    // Rust: Struct destructuring
    console.log('Rust - Struct Destructuring:');
    vars = registry.extractVariablesFromLine('let Point { x, y } = point;', 1, 'rs');
    console.log(`  Input: let Point { x, y } = point;`);
    console.log(`  Found: ${vars.map(v => v.name).join(', ')}`);
    console.log(`  Count: ${vars.length} (expected: 2)\n`);
}

// ============================================================================
// EXAMPLE 6: Integration with Type System
// ============================================================================

function example6_typeSystemIntegration() {
    console.log('\n=== EXAMPLE 6: Type System Information ===\n');

    const registry = new VariableParserRegistry();

    interface ParsedVariable extends VariableInterface {
        language: string;
    }

    // Parse variables from multiple languages and track type info
    const multiLangVars: ParsedVariable[] = [];

    const samples = [
        { ext: 'ts', line: 'const id: UUID = generateId();', lang: 'TypeScript' },
        { ext: 'py', line: 'name: str = get_name()', lang: 'Python' },
        { ext: 'rs', line: 'let age: u32 = 42;', lang: 'Rust' },
    ];

    for (const sample of samples) {
        const vars = registry.extractVariablesFromLine(sample.line, 1, sample.ext);
        for (const v of vars) {
            multiLangVars.push({
                ...v,
                language: sample.lang,
            });
        }
    }

    console.log('Variables with Type Information:');
    for (const v of multiLangVars) {
        const type = v.type || '(inferred)';
        console.log(`  ${v.language.padEnd(12)} : ${v.name.padEnd(10)} : ${type}`);
    }
}

// ============================================================================
// EXAMPLE 7: Error Handling and Unsupported Cases
// ============================================================================

function example7_errorHandling() {
    console.log('\n=== EXAMPLE 7: Error Handling ===\n');

    const registry = new VariableParserRegistry();

    // Test unsupported language
    console.log('Unsupported Language:');
    let vars = registry.extractVariablesFromLine('let x = 5', 1, 'go');
    console.log(`  Input (Go): let x = 5`);
    console.log(`  Result: ${vars.length === 0 ? '✓ Empty array (graceful)' : '✗ Unexpected result'}`);

    // Test comment line
    console.log('\nComment Lines (should be skipped):');
    vars = registry.extractVariablesFromLine('// const x = 5;', 1, 'ts');
    console.log(`  Input: // const x = 5;`);
    console.log(`  Result: ${vars.length === 0 ? '✓ Empty array' : '✗ Incorrectly parsed'}`);

    // Test control structures (should not create variables)
    console.log('\nControl Structures (should not create variables):');
    vars = registry.extractVariablesFromLine('if (condition) { doSomething(); }', 1, 'ts');
    console.log(`  Input: if (condition) { doSomething(); }`);
    console.log(`  Result: ${vars.length === 0 ? '✓ Correctly ignored' : '✗ False positive'}`);
}

// ============================================================================
// RUNNER: Execute Examples
// ============================================================================

function runAllExamples() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       Variable Parser Registry - Usage Examples              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    try {
        example1_basicExtraction();
        example2_processFile();
        example3_multiLanguage();
        example4_parserCapabilities();
        example5_complexPatterns();
        example6_typeSystemIntegration();
        example7_errorHandling();

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║                   All Examples Completed!                    ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
    } catch (error) {
        console.error('Error running examples:', error);
    }
}

// Export for use in tests or other files
export {
    example1_basicExtraction,
    example2_processFile,
    example3_multiLanguage,
    example4_parserCapabilities,
    example5_complexPatterns,
    example6_typeSystemIntegration,
    example7_errorHandling,
    runAllExamples,
};

// Uncomment to run examples:
// runAllExamples();
