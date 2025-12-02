/**
 * Comment Parser Examples
 *
 * COMPREHENSIVE USAGE EXAMPLES showing how to use the comment parser system
 * across all 5 supported languages (TypeScript, Python, C++, Scala, Rust).
 *
 * Each example demonstrates:
 * - Single-line comment extraction
 * - Multi-line comment extraction
 * - Documentation/docstring extraction
 * - Comment association with code elements
 * - State management across lines
 *
 * STRUCTURE:
 * - TypeScript examples
 * - Python examples
 * - C++ examples
 * - Scala examples
 * - Rust examples
 * - Integration examples (using registry)
 */

import { CommentParserRegistry } from './commentParserRegistry';
import { TypeScriptCommentParser } from './typescriptCommentParser';
import { PythonCommentParser } from './pythonCommentParser';
import { CppCommentParser } from './cppCommentParser';
import { ScalaCommentParser } from './scalaCommentParser';
import { RustCommentParser } from './rustCommentParser';
import { CommentInterface } from '../codeParser';

// ============================================================================
// TYPESCRIPT EXAMPLES
// ============================================================================

/**
 * Example 1: TypeScript single-line and multi-line comments
 */
export function exampleTypeScriptBasic(): void {
    const parser = new TypeScriptCommentParser();
    parser.reset();

    const lines = [
        '// This is a single-line comment',
        'const x = 5;  // inline comment',
        '/* This is a multi-line',
        ' * comment block',
        ' */',
        '/**',
        ' * This is a JSDoc documentation comment',
        ' * @param name - The name parameter',
        ' * @returns The result',
        ' */',
        'function myFunction(name: string): string {',
        '  return "Hello " + name;',
        '}',
    ];

    console.log('=== TypeScript Example ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(`Line ${comment.startLine}: [${comment.type}] ${comment.content.substring(0, 50)}`);
        });
    });
}

/**
 * Example 2: TypeScript with function and class association
 */
export function exampleTypeScriptAssociation(): void {
    const parser = new TypeScriptCommentParser();
    parser.reset();

    const lines = [
        '// Utility class for calculations',
        'class Calculator {',
        '  // Add two numbers',
        '  add(a: number, b: number): number {',
        '    return a + b;',
        '  }',
        '',
        '  /**',
        '   * Subtract two numbers',
        '   * @param a First number',
        '   * @param b Second number',
        '   */',
        '  subtract(a: number, b: number): number {',
        '    return a - b;',
        '  }',
        '}',
    ];

    console.log('\n=== TypeScript with Association ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(
                `Line ${comment.startLine}: [${comment.type}] parent="${comment.parent}" "${comment.content.substring(0, 40)}"`
            );
        });
    });
}

// ============================================================================
// PYTHON EXAMPLES
// ============================================================================

/**
 * Example 3: Python single-line and docstring comments
 */
export function examplePythonBasic(): void {
    const parser = new PythonCommentParser();
    parser.reset();

    const lines = [
        '# This is a single-line comment',
        'x = 5  # inline comment',
        '"""',
        'This is a module-level docstring',
        'explaining the purpose of this module',
        '"""',
        '',
        'def greet(name):',
        '    """',
        '    Greet someone by name',
        '    """',
        '    return f"Hello {name}"',
    ];

    console.log('\n=== Python Example ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(`Line ${comment.startLine}: [${comment.type}] ${comment.content.substring(0, 50)}`);
        });
    });
}

/**
 * Example 4: Python with function and class association
 */
export function examplePythonAssociation(): void {
    const parser = new PythonCommentParser();
    parser.reset();

    const lines = [
        '# Helper functions for data processing',
        'class DataProcessor:',
        '    """',
        '    Processes and analyzes data sets',
        '    """',
        '',
        '    def process(self, data):',
        '        """Process the data array"""',
        '        # Filter out None values',
        '        return [x for x in data if x is not None]',
    ];

    console.log('\n=== Python with Association ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(
                `Line ${comment.startLine}: [${comment.type}] parent="${comment.parent}" "${comment.content.substring(0, 40)}"`
            );
        });
    });
}

// ============================================================================
// C++ EXAMPLES
// ============================================================================

/**
 * Example 5: C++ single-line and multi-line comments
 */
export function exampleCppBasic(): void {
    const parser = new CppCommentParser();
    parser.reset();

    const lines = [
        '// This is a single-line comment',
        'int x = 5;  // inline comment',
        '/* This is a multi-line',
        ' * comment block',
        ' */',
        '/**',
        ' * This is Doxygen documentation',
        ' * @param count The number of items',
        ' * @return The result',
        ' */',
        'int calculate(int count);',
    ];

    console.log('\n=== C++ Example ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(`Line ${comment.startLine}: [${comment.type}] ${comment.content.substring(0, 50)}`);
        });
    });
}

/**
 * Example 6: C++ with class and method association
 */
export function exampleCppAssociation(): void {
    const parser = new CppCommentParser();
    parser.reset();

    const lines = [
        '/// Represents a geometric point',
        'class Point {',
        'private:',
        '    /// X coordinate',
        '    double x;',
        'public:',
        '    /**',
        '     * Calculate distance to another point',
        '     * @param other The other point',
        '     */',
        '    double distance(const Point& other) const;',
        '};',
    ];

    console.log('\n=== C++ with Association ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(
                `Line ${comment.startLine}: [${comment.type}] parent="${comment.parent}" "${comment.content.substring(0, 40)}"`
            );
        });
    });
}

// ============================================================================
// SCALA EXAMPLES
// ============================================================================

/**
 * Example 7: Scala single-line and Scaladoc comments
 */
export function exampleScalaBasic(): void {
    const parser = new ScalaCommentParser();
    parser.reset();

    const lines = [
        '// This is a single-line comment',
        'val x = 5  // inline comment',
        '/**',
        ' * Calculate the sum of numbers',
        ' * @param numbers Array of numbers',
        ' * @return The sum',
        ' */',
        'def sum(numbers: Array[Int]): Int = {',
        '  numbers.reduce(_ + _)',
        '}',
    ];

    console.log('\n=== Scala Example ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(`Line ${comment.startLine}: [${comment.type}] ${comment.content.substring(0, 50)}`);
        });
    });
}

/**
 * Example 8: Scala with class and object association
 */
export function exampleScalaAssociation(): void {
    const parser = new ScalaCommentParser();
    parser.reset();

    const lines = [
        '/** Utility object for math operations */',
        'object MathUtils {',
        '  /**',
        '   * Add two numbers',
        '   * @param a First number',
        '   * @param b Second number',
        '   */',
        '  def add(a: Int, b: Int): Int = a + b',
        '}',
    ];

    console.log('\n=== Scala with Association ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(
                `Line ${comment.startLine}: [${comment.type}] parent="${comment.parent}" "${comment.content.substring(0, 40)}"`
            );
        });
    });
}

// ============================================================================
// RUST EXAMPLES
// ============================================================================

/**
 * Example 9: Rust single-line and doc comments
 */
export function exampleRustBasic(): void {
    const parser = new RustCommentParser();
    parser.reset();

    const lines = [
        '// This is a single-line comment',
        'let x = 5;  // inline comment',
        '/// Outer documentation comment',
        '/// describing the function',
        '//! Inner documentation comment',
        '/**',
        ' * Calculate the sum',
        ' * @param a First number',
        ' * @param b Second number',
        ' */',
        'fn add(a: i32, b: i32) -> i32 {',
        '    a + b',
        '}',
    ];

    console.log('\n=== Rust Example ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(`Line ${comment.startLine}: [${comment.type}] ${comment.content.substring(0, 50)}`);
        });
    });
}

/**
 * Example 10: Rust with struct and impl association
 */
export function exampleRustAssociation(): void {
    const parser = new RustCommentParser();
    parser.reset();

    const lines = [
        '/// A 2D point in space',
        'struct Point {',
        '    /// X coordinate',
        '    x: f64,',
        '    /// Y coordinate',
        '    y: f64,',
        '}',
        '',
        '/// Methods for Point',
        'impl Point {',
        '    /// Create a new point',
        '    fn new(x: f64, y: f64) -> Point {',
        '        Point { x, y }',
        '    }',
        '}',
    ];

    console.log('\n=== Rust with Association ===');
    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        comments.forEach((comment) => {
            console.log(
                `Line ${comment.startLine}: [${comment.type}] parent="${comment.parent}" "${comment.content.substring(0, 40)}"`
            );
        });
    });
}

// ============================================================================
// INTEGRATION EXAMPLES (using the Registry)
// ============================================================================

/**
 * Example 11: Using CommentParserRegistry for automatic language detection
 */
export function exampleRegistryAutoDetect(): void {
    const registry = CommentParserRegistry.getInstance();

    const tsCode = `
    // TypeScript comment
    const greet = (name: string) => "Hello " + name;
  `;

    const pyCode = `
    # Python comment
    def greet(name):
        return "Hello " + name
  `;

    console.log('\n=== Registry Auto-Detect Example ===');

    // Extract from TypeScript file
    const tsComments = registry.extractAllComments(tsCode, 'example.ts');
    console.log(`TypeScript comments: ${tsComments.length} found`);
    tsComments.forEach((c) => console.log(`  - [${c.type}] ${c.content}`));

    // Extract from Python file
    const pyComments = registry.extractAllComments(pyCode, 'example.py');
    console.log(`Python comments: ${pyComments.length} found`);
    pyComments.forEach((c) => console.log(`  - [${c.type}] ${c.content}`));
}

/**
 * Example 12: Multi-language file processing
 */
export function exampleMultiLanguageProcessing(): void {
    const registry = CommentParserRegistry.getInstance();

    const files = [
        { path: 'calculator.ts', language: 'typescript' as const },
        { path: 'utils.py', language: 'python' as const },
        { path: 'math.cpp', language: 'cpp' as const },
    ];

    console.log('\n=== Multi-Language Processing ===');

    files.forEach((file) => {
        console.log(`\nProcessing ${file.path}...`);

        // In real usage, you would read the file content here
        const isDeclared = registry.isLanguageSupported(file.language);
        console.log(`  Language supported: ${isDeclared}`);

        if (isDeclared) {
            const language = registry.getLanguageFromPath(file.path);
            console.log(`  Detected language: ${language}`);
        }
    });
}

/**
 * Example 13: Processing multi-line comments across boundaries
 */
export function exampleMultiLineComments(): void {
    const parser = new TypeScriptCommentParser();
    parser.reset();

    const lines = [
        'const x = 5;',
        '/* Multi-line comment',
        ' * spanning multiple',
        ' * lines in the',
        ' * source file',
        ' */',
        'const y = 10;',
    ];

    console.log('\n=== Multi-Line Comment Example ===');

    const allComments: CommentInterface[] = [];

    lines.forEach((line, idx) => {
        const comments = parser.extractCommentsFromLine(line, idx + 1);
        allComments.push(...comments);

        console.log(`Line ${idx + 1}: "${line}"`);
        if (comments.length > 0) {
            console.log(`  Found ${comments.length} comment(s)`);
        }
    });

    console.log(`\nTotal comments found: ${allComments.length}`);
    allComments.forEach((c) => {
        console.log(`  [${c.startLine}-${c.endLine}] [${c.type}] ${c.content.substring(0, 40)}`);
    });
}

/**
 * Example 14: Getting parser state information
 */
export function exampleDebugInfo(): void {
    const registry = CommentParserRegistry.getInstance();

    console.log('\n=== Debug Information ===');

    console.log('Registry debug info:');
    const regInfo = registry.getDebugInfo();
    console.log(`  Cached parsers: ${regInfo.cachedParsers.join(', ')}`);
    console.log(`  Supported languages: ${regInfo.supportedLanguages.join(', ')}`);

    console.log('\nSupported extensions:');
    registry.getSupportedExtensions().forEach((ext) => {
        console.log(`  ${ext}`);
    });
}

/**
 * Run all examples
 */
export function runAllExamples(): void {
    exampleTypeScriptBasic();
    exampleTypeScriptAssociation();
    examplePythonBasic();
    examplePythonAssociation();
    exampleCppBasic();
    exampleCppAssociation();
    exampleScalaBasic();
    exampleScalaAssociation();
    exampleRustBasic();
    exampleRustAssociation();
    exampleRegistryAutoDetect();
    exampleMultiLanguageProcessing();
    exampleMultiLineComments();
    exampleDebugInfo();
}

// Uncomment to run:
// runAllExamples();
