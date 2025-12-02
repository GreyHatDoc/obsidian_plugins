/**
 * Variable Parser with Scope Tracking - Examples and Test Cases
 *
 * This file demonstrates how to use the enhanced variable parser system
 * that now tracks class membership and visibility (especially for C++).
 *
 * NEW FEATURES:
 * - Detect if a variable is a class/struct member
 * - Track the enclosing class name
 * - Monitor visibility context (public/private/protected for C++)
 * - Track scope hierarchy (namespaces, nested classes)
 *
 * USAGE PATTERN:
 * 1. Create VariableParserRegistry instance
 * 2. Call resetFileScope() when starting a new file
 * 3. Loop through lines, calling extractVariablesFromLine()
 * 4. Variables will automatically have isClassMember, className, visibility populated
 */

import { VariableParserRegistry } from './variableParserRegistry';
import { VariableInterface } from '../codeParser';

/**
 * Example 1: C++ Class Member Detection with Visibility
 *
 * Demonstrates how the parser tracks when we enter a class and
 * automatically marks subsequent variables as class members with
 * appropriate visibility (public/private/protected).
 */
function example1_CppClassMembers() {
    console.log('\n=== Example 1: C++ Class Member Detection ===');

    const cppCode = `
class Person {
public:
  std::string name;
  int age;

private:
  std::string ssn;
  static int count;

protected:
  virtual void update();
};
`.trim();

    const registry = new VariableParserRegistry();
    registry.resetFileScope('cpp');

    const lines = cppCode.split('\n');

    console.log('Parsing C++ class:');
    console.log(cppCode);
    console.log('\nExtracted variables:');

    lines.forEach((line, idx) => {
        const variables = registry.extractVariablesFromLine(line, idx + 1, 'cpp');

        if (variables.length > 0) {
            variables.forEach((v) => {
                console.log(`  Line ${v.startLine}: "${v.name}"`);
                console.log(`    - Type: ${v.type}`);
                console.log(`    - Is Class Member: ${v.isClassMember}`);
                console.log(`    - Class Name: ${v.className}`);
                console.log(`    - Visibility: ${v.visibility}`);
                console.log(`    - Static: ${v.isStatic}`);
            });
        }
    });
}

/**
 * Example 2: TypeScript Class Properties with Visibility
 *
 * Shows how TypeScript class members are tracked with their visibility
 * (public/private/protected) and modifiers (readonly, static).
 */
function example2_TypeScriptClassProperties() {
    console.log('\n=== Example 2: TypeScript Class Properties ===');

    const tsCode = `
class Employee {
  public id: string;
  private salary: number;
  protected department: string;
  public readonly hireDate: Date;
  public static companyName: string;
}
`.trim();

    const registry = new VariableParserRegistry();
    registry.resetFileScope('typescript');

    const lines = tsCode.split('\n');

    console.log('Parsing TypeScript class:');
    console.log(tsCode);
    console.log('\nExtracted class properties:');

    lines.forEach((line, idx) => {
        const variables = registry.extractVariablesFromLine(line, idx + 1, 'ts');

        if (variables.length > 0) {
            variables.forEach((v) => {
                console.log(`  Line ${v.startLine}: "${v.name}: ${v.type}"`);
                console.log(`    - Visibility: ${v.visibility}`);
                console.log(`    - Readonly: ${v.isReadonly}`);
                console.log(`    - Static: ${v.isStatic}`);
                console.log(`    - Class Member: ${v.isClassMember}`);
            });
        }
    });
}

/**
 * Example 3: Python Class Attributes
 *
 * Demonstrates tracking of self.attribute and cls.attribute declarations
 * within Python classes, automatically marked as class members.
 */
function example3_PythonClassAttributes() {
    console.log('\n=== Example 3: Python Class Attributes ===');

    const pythonCode = `
class Database:
  def __init__(self):
    self.connection = None
    self.timeout: int = 30
    self.retry_count = 0

  @classmethod
  def setup(cls):
    cls.pool_size = 10
    cls.max_retries: int = 3
`.trim();

    const registry = new VariableParserRegistry();
    registry.resetFileScope('python');

    const lines = pythonCode.split('\n');

    console.log('Parsing Python class:');
    console.log(pythonCode);
    console.log('\nExtracted class attributes:');

    lines.forEach((line, idx) => {
        const variables = registry.extractVariablesFromLine(line, idx + 1, 'py');

        if (variables.length > 0) {
            variables.forEach((v) => {
                console.log(`  Line ${v.startLine}: "${v.name}"`);
                console.log(`    - Type: ${v.type || 'inferred'}`);
                console.log(`    - Visibility: ${v.visibility || 'public'}`);
                console.log(`    - Class Member: ${v.isClassMember}`);
            });
        }
    });
}

/**
 * Example 4: Nested Classes and Scope Paths
 *
 * Shows how the parser handles nested classes and maintains
 * scope hierarchy information.
 */
function example4_NestedClasses() {
    console.log('\n=== Example 4: Nested Classes and Scope Paths ===');

    const cppCode = `
namespace Utils {
  class Container {
  public:
    class Iterator {
    private:
      void* current;
      Container* parent;
    };
    
    Iterator begin();
  };
}
`.trim();

    const registry = new VariableParserRegistry();
    registry.resetFileScope('cpp');

    const lines = cppCode.split('\n');

    console.log('Parsing nested C++ classes:');
    console.log(cppCode);
    console.log('\nExtracted variables with scope hierarchy:');

    lines.forEach((line, idx) => {
        const variables = registry.extractVariablesFromLine(line, idx + 1, 'cpp');

        if (variables.length > 0) {
            variables.forEach((v) => {
                console.log(`  Line ${v.startLine}: "${v.name}"`);
                console.log(`    - Class: ${v.className}`);
                console.log(`    - Scope Path: ${v.scopePath || '(global)'}`);
                console.log(`    - Visibility: ${v.visibility}`);
            });
        }
    });
}

/**
 * Example 5: Multi-Language File Comparison
 *
 * Parses the same logical structure in different languages
 * and compares how variables are detected across languages.
 */
function example5_MultiLanguageComparison() {
    console.log('\n=== Example 5: Multi-Language Comparison ===');

    // C++ version
    const cppClass = `class Point {
private:
  double x;
  double y;
};`;

    // TypeScript version
    const tsClass = `class Point {
  private x: number;
  private y: number;
}`;

    // Python version
    const pythonClass = `class Point:
  def __init__(self):
    self.x: float
    self.y: float`;

    const registry = new VariableParserRegistry();

    console.log('C++ Version:');
    registry.resetFileScope('cpp');
    cppClass.split('\n').forEach((line, idx) => {
        const vars = registry.extractVariablesFromLine(line, idx + 1, 'cpp');
        if (vars.length) {
            vars.forEach((v) => console.log(`  ${v.name}: ${v.visibility}`));
        }
    });

    console.log('\nTypeScript Version:');
    registry.resetFileScope('typescript');
    tsClass.split('\n').forEach((line, idx) => {
        const vars = registry.extractVariablesFromLine(line, idx + 1, 'ts');
        if (vars.length) {
            vars.forEach((v) => console.log(`  ${v.name}: ${v.visibility}`));
        }
    });

    console.log('\nPython Version:');
    registry.resetFileScope('python');
    pythonClass.split('\n').forEach((line, idx) => {
        const vars = registry.extractVariablesFromLine(line, idx + 1, 'py');
        if (vars.length) {
            vars.forEach((v) => console.log(`  ${v.name}`));
        }
    });
}

/**
 * Example 6: Visibility Context Tracking in C++
 *
 * Detailed walkthrough of how C++ visibility context (public:, private:, protected:)
 * is tracked and applied to variables declared in different sections.
 */
function example6_CppVisibilityContext() {
    console.log('\n=== Example 6: C++ Visibility Context Tracking ===');

    const cppCode = `
struct Shape {
public:
  virtual ~Shape() = default;
  double area() const;

private:
  int id;
  std::string name;

protected:
  void updateDimensions();
};
`.trim();

    const registry = new VariableParserRegistry();
    registry.resetFileScope('cpp');

    console.log('Step-by-step scope tracking:');
    console.log(cppCode);
    console.log('\nScope context at each line:');

    const lines = cppCode.split('\n');
    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const variables = registry.extractVariablesFromLine(line, lineNum, 'cpp');

        // Get current scope info
        const scopeInfo = registry.getCurrentScopeInfo('cpp');

        if (line.trim()) {
            console.log(
                `Line ${lineNum}: ${line.trim().substring(0, 40).padEnd(40)} | Scope: ${registry.getDebugScopeInfo('cpp')}`
            );

            if (variables.length > 0) {
                variables.forEach((v) => {
                    console.log(
                        `  → Found variable: "${v.name}" (${v.visibility || 'no explicit visibility'})`
                    );
                });
            }
        }
    });
}

/**
 * Example 7: Using Scope Information in Analysis
 *
 * Practical example of how to use the scope tracking for code analysis,
 * such as finding all private members or counting class members.
 */
function example7_ScopeAnalysis() {
    console.log('\n=== Example 7: Practical Scope Analysis ===');

    const cppCode = `
class Account {
public:
  double balance;
  void deposit(double amount);

private:
  std::string accountNumber;
  bool isActive;
  int transactionCount;
};
`.trim();

    const registry = new VariableParserRegistry();
    registry.resetFileScope('cpp');

    const allVariables: VariableInterface[] = [];

    cppCode.split('\n').forEach((line, idx) => {
        const vars = registry.extractVariablesFromLine(line, idx + 1, 'cpp');
        allVariables.push(...vars);
    });

    // Analysis: Group by visibility
    const byVisibility: Record<string, VariableInterface[]> = {
        public: [],
        private: [],
        protected: [],
    };

    allVariables.forEach((v) => {
        if (v.visibility) {
            byVisibility[v.visibility].push(v);
        }
    });

    console.log('Code:');
    console.log(cppCode);
    console.log('\n\nAnalysis Results:');
    console.log(`Public members: ${byVisibility.public.length}`);
    byVisibility.public.forEach((v) => console.log(`  - ${v.name}: ${v.type}`));

    console.log(`\nPrivate members: ${byVisibility.private.length}`);
    byVisibility.private.forEach((v) => console.log(`  - ${v.name}: ${v.type}`));

    console.log(
        `\nTotal class members: ${allVariables.filter((v) => v.isClassMember).length}`
    );
}

/**
 * Example 8: Integration Pattern - Processing a Complete File
 *
 * Shows the recommended pattern for processing an entire source file,
 * maintaining scope across all lines.
 */
function example8_FileProcessingPattern() {
    console.log('\n=== Example 8: Complete File Processing Pattern ===');

    const sourceFile = `
// database.ts
export class Database {
  private connection: Connection;
  private pool: ConnectionPool;
  public readonly maxRetries: number = 3;

  constructor(config: DatabaseConfig) {
    this.pool = new ConnectionPool(config);
  }

  public async connect(): Promise<void> {
    this.connection = await this.pool.getConnection();
  }

  private validateConfig(config: DatabaseConfig): boolean {
    let isValid = true;
    return isValid;
  }
}
`.trim();

    const registry = new VariableParserRegistry();
    registry.resetFileScope('typescript');

    interface FileMetadata {
        classMembers: VariableInterface[];
        globalVariables: VariableInterface[];
        privateMembers: VariableInterface[];
        publicMembers: VariableInterface[];
    }

    const metadata: FileMetadata = {
        classMembers: [],
        globalVariables: [],
        privateMembers: [],
        publicMembers: [],
    };

    console.log('Processing file line-by-line:');
    sourceFile.split('\n').forEach((line, idx) => {
        const vars = registry.extractVariablesFromLine(line, idx + 1, 'ts');

        vars.forEach((v) => {
            if (v.isClassMember) {
                metadata.classMembers.push(v);
                if (v.visibility === 'private') metadata.privateMembers.push(v);
                if (v.visibility === 'public') metadata.publicMembers.push(v);
            } else {
                metadata.globalVariables.push(v);
            }
        });
    });

    console.log('\n\nFile Analysis Summary:');
    console.log(`Total class members: ${metadata.classMembers.length}`);
    console.log(`  Public: ${metadata.publicMembers.length}`);
    console.log(`  Private: ${metadata.privateMembers.length}`);
    console.log(`Global variables: ${metadata.globalVariables.length}`);

    console.log('\n\nAll Class Members:');
    metadata.classMembers.forEach((v) => {
        console.log(
            `  ${v.name}: ${v.type} (${v.visibility}, ${v.isReadonly ? 'readonly' : 'mutable'})`
        );
    });
}

/**
 * Run all examples
 */
export function runAllExamples() {
    try {
        example1_CppClassMembers();
        example2_TypeScriptClassProperties();
        example3_PythonClassAttributes();
        example4_NestedClasses();
        example5_MultiLanguageComparison();
        example6_CppVisibilityContext();
        example7_ScopeAnalysis();
        example8_FileProcessingPattern();

        console.log('\n\n✅ All examples completed successfully!');
    } catch (error) {
        console.error('❌ Error running examples:', error);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    runAllExamples();
}
