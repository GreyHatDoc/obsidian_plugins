import { CodeParser, ObjectInterface, FileAnalysis, CodeSymbol, CommentBlock, ImportStatement, Parameter } from './codeParser';

export class CppParser extends CodeParser {
    readonly language = 'cpp';
    readonly extensions = ['cpp', 'cc', 'cxx', 'c++', 'c', 'h', 'hpp', 'hxx', 'h++'];

    parse(content: string, filePath: string): FileAnalysis {
        const symbols: CodeSymbol[] = [];
        const comments: CommentBlock[] = [];
        const imports: ImportStatement[] = [];
        const objectStart: number[] = []; // Stack to track object start line
        const objectEnd: number[] = [];   // Stack to track object end line
        const ObjectInterfaces: ObjectInterface[] = [];
        // Preprocess: remove strings and character literals to avoid false matches
        const processedContent = this.removeStringLiterals(content);
        const lines = content.split('\n');
        // move to single loop for performance
        // We will first extract includes and free comments
        // For classes, functions, enums we will start by using the objectInterface and then parse to symbol using the interface start line and end line
        // Since we want to put comments with the symbol we will only extract comments if objectstart and end are 0
        // This will ensure that we only get comments that are not attached to any symbol
        // We will also want to keep track of the position of comments to ensure we can attach them to symbol if they are immediately preceding

        // Extract includes
        this.extractIncludes(lines, filePath, imports);

        // Extract comments first
        this.extractComments(content, filePath, comments);

        // Extract namespaces and track current namespace
        const namespaces = this.extractNamespaces(processedContent, lines, filePath);
        symbols.push(...namespaces);

        // Extract classes and structs
        const classes = this.extractClasses(processedContent, lines, filePath, comments);
        symbols.push(...classes);

        // Extract standalone functions (not class methods)
        const functions = this.extractFunctions(processedContent, lines, filePath, comments, classes);
        symbols.push(...functions);

        // Extract enums
        const enums = this.extractEnums(processedContent, lines, filePath, comments);
        symbols.push(...enums);

        // Extract metadata
        return {
            filePath,
            language: this.language,
            symbols,
            imports,
            comments: comments.filter(c => !this.isAttachedComment(c, symbols)),
            lastModified: new Date(),
        };
    }

    private removeStringLiterals(content: string): string {
        // Remove string literals but keep structure
        return content
            .replace(/"(?:[^"\\]|\\.)*"/g, '""') // Double-quoted strings
            .replace(/'(?:[^'\\]|\\.)*'/g, "''") // Single-quoted chars
            .replace(/R"([^(]*)\([\s\S]*?\)\1"/g, '""'); // Raw strings
    }

    private extractIncludes(lines: string[], filePath: string, imports: ImportStatement[]): void {
        lines.forEach((line, index) => {
            const includeMatch = line.match(/^\s*#include\s+[<"]([^>"]+)[>"]/);
            if (includeMatch) {
                const headerFile = includeMatch[1];
                imports.push({
                    source: headerFile,
                    imports: [headerFile],
                    location: this.createLocation(filePath, index + 1, index + 1),
                });
            }
        });
    }

    private extractComments(content: string, filePath: string, comments: CommentBlock[]): void {
        const lines = content.split('\n');
        let inBlockComment = false;
        let blockCommentStart = -1;
        let blockCommentLines: string[] = [];

        lines.forEach((line, index) => {
            const lineNum = index + 1;

            // Handle block comments
            if (!inBlockComment && line.includes('/*')) {
                inBlockComment = true;
                blockCommentStart = lineNum;
                blockCommentLines = [];

                const startIdx = line.indexOf('/*');
                const endIdx = line.indexOf('*/', startIdx);

                if (endIdx !== -1) {
                    // Single-line block comment
                    const commentText = line.substring(startIdx + 2, endIdx).trim();
                    comments.push({
                        content: commentText,
                        type: line.trim().startsWith('/**') ? 'doc' : 'block',
                        location: this.createLocation(filePath, lineNum, lineNum),
                    });
                    inBlockComment = false;
                } else {
                    blockCommentLines.push(line.substring(startIdx + 2));
                }
            } else if (inBlockComment) {
                const endIdx = line.indexOf('*/');
                if (endIdx !== -1) {
                    // End of block comment
                    blockCommentLines.push(line.substring(0, endIdx));
                    const commentText = blockCommentLines
                        .map(l => l.replace(/^\s*\*\s?/, '').trim())
                        .join('\n')
                        .trim();

                    comments.push({
                        content: commentText,
                        type: 'block',
                        location: this.createLocation(filePath, blockCommentStart, lineNum),
                    });

                    inBlockComment = false;
                    blockCommentLines = [];
                } else {
                    blockCommentLines.push(line);
                }
            }

            // Handle single-line comments (not inside block comments)
            if (!inBlockComment) {
                const commentMatch = line.match(/\/\/(.*)$/);
                if (commentMatch) {
                    const commentText = commentMatch[1].trim();
                    if (commentText) {
                        comments.push({
                            content: commentText,
                            type: 'line',
                            location: this.createLocation(filePath, lineNum, lineNum),
                        });
                    }
                }
            }
        });
    }

    private extractNamespaces(content: string, lines: string[], filePath: string): CodeSymbol[] {
        const namespaces: CodeSymbol[] = [];

        lines.forEach((line, index) => {
            const namespaceMatch = line.match(/^\s*namespace\s+(\w+)(?:\s*::\s*(\w+))?\s*\{?/);
            if (namespaceMatch) {
                const name = namespaceMatch[2] ? `${namespaceMatch[1]}::${namespaceMatch[2]}` : namespaceMatch[1];
                namespaces.push({
                    name,
                    type: 'namespace',
                    location: this.createLocation(filePath, index + 1, index + 1),
                    signature: `namespace ${name}`,
                });
            }
        });

        return namespaces;
    }

    private extractClasses(
        content: string,
        lines: string[],
        filePath: string,
        existingComments: CommentBlock[]
    ): CodeSymbol[] {
        const classes: CodeSymbol[] = [];

        // Pattern matches: class/struct Name : inheritance { or class Name {
        const classRegex = /^\s*(template\s*<[^>]+>\s*)?(class|struct)\s+(\w+)(?:\s*:\s*([^{]+))?\s*\{?/gm;

        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const templatePart = match[1] || '';
            const type = match[2]; // 'class' or 'struct'
            const name = match[3];
            const inheritance = match[4]?.trim();

            const lineNum = this.getLineNumber(content, match.index);
            const endLine = this.findMatchingBrace(lines, lineNum - 1);

            let signature = templatePart + type + ' ' + name;
            if (inheritance) {
                signature += ' : ' + inheritance;
            }

            const symbol: CodeSymbol = {
                name,
                type: 'class',
                location: this.createLocation(filePath, lineNum, endLine),
                signature,
                comments: this.findPrecedingComments(existingComments, lineNum),
                modifiers: [type], // 'class' or 'struct'
            };

            classes.push(symbol);

            // Extract methods from this class
            const methods = this.extractMethods(lines, lineNum - 1, endLine, filePath, name, existingComments);
            classes.push(...methods);
        }

        return classes;
    }

    private extractMethods(
        lines: string[],
        startLine: number,
        endLine: number,
        filePath: string,
        className: string,
        existingComments: CommentBlock[]
    ): CodeSymbol[] {
        const methods: CodeSymbol[] = [];

        // Look for methods within the class body
        for (let i = startLine; i < endLine && i < lines.length; i++) {
            const line = lines[i];

            // Skip lines that are clearly not method declarations
            if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;

            // Method pattern: return_type method_name(params) modifiers
            // Also handles: explicit/virtual/static/inline modifiers
            const methodMatch = line.match(
                /^\s*(?:(virtual|static|inline|explicit|friend|constexpr|const)\s+)*([~\w:<>*&]+)\s+([~\w]+)\s*\(([^)]*)\)\s*(const|override|final|noexcept|=\s*0|=\s*default|=\s*delete)?/
            );

            if (methodMatch) {
                const modifiersPart = methodMatch[1];
                const returnType = methodMatch[2];
                const methodName = methodMatch[3];
                const params = methodMatch[4];
                const suffixModifiers = methodMatch[5];

                // Skip if this looks like a control structure
                if (['if', 'for', 'while', 'switch', 'return'].includes(methodName)) continue;

                // Find the end of the method
                let methodEndLine = i + 1;
                if (line.includes('{')) {
                    methodEndLine = this.findMatchingBrace(lines, i);
                } else if (line.trim().endsWith(';')) {
                    methodEndLine = i + 1;
                }

                const modifiers: string[] = [];
                if (modifiersPart) modifiers.push(modifiersPart);
                if (suffixModifiers) modifiers.push(suffixModifiers);

                // Determine method type
                let methodType: 'method' | 'function' = 'method';
                const signature = this.buildMethodSignature(returnType, methodName, params, modifiers);

                methods.push({
                    name: methodName,
                    type: methodType,
                    parentSymbol: className,
                    location: this.createLocation(filePath, i + 1, methodEndLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, i + 1),
                    parameters: this.parseCppParameters(params),
                    returnType,
                    modifiers,
                });
            }
        }

        return methods;
    }

    private extractFunctions(
        content: string,
        lines: string[],
        filePath: string,
        existingComments: CommentBlock[],
        classes: CodeSymbol[]
    ): CodeSymbol[] {
        const functions: CodeSymbol[] = [];

        // Get line ranges occupied by classes to exclude them
        const classRanges = classes
            .filter(c => c.type === 'class')
            .map(c => ({ start: c.location.startLine, end: c.location.endLine }));

        // Function pattern: return_type function_name(params) {
        const functionRegex = /^\s*(?:(inline|static|extern|constexpr)\s+)*([~\w:<>*&]+)\s+([~\w]+)\s*\(([^)]*)\)\s*\{?/;

        lines.forEach((line, index) => {
            const lineNum = index + 1;

            // Skip if inside a class
            if (this.isLineInRanges(lineNum, classRanges)) return;

            // Skip comments and preprocessor directives
            if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('#')) return;

            const match = line.match(functionRegex);
            if (match) {
                const modifiers = match[1] ? [match[1]] : [];
                const returnType = match[2];
                const funcName = match[3];
                const params = match[4];

                // Skip common non-function keywords
                if (['if', 'for', 'while', 'switch', 'return', 'namespace'].includes(funcName)) return;

                // Find function end
                const endLine = this.findMatchingBrace(lines, index);

                const signature = this.buildMethodSignature(returnType, funcName, params, modifiers);

                functions.push({
                    name: funcName,
                    type: 'function',
                    location: this.createLocation(filePath, lineNum, endLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, lineNum),
                    parameters: this.parseCppParameters(params),
                    returnType,
                    modifiers,
                });
            }
        });

        return functions;
    }

    private extractEnums(
        content: string,
        lines: string[],
        filePath: string,
        existingComments: CommentBlock[]
    ): CodeSymbol[] {
        const enums: CodeSymbol[] = [];

        lines.forEach((line, index) => {
            const enumMatch = line.match(/^\s*enum\s+(class\s+)?(\w+)(?:\s*:\s*(\w+))?\s*\{?/);
            if (enumMatch) {
                const isEnumClass = !!enumMatch[1];
                const name = enumMatch[2];
                const underlyingType = enumMatch[3];

                const endLine = this.findMatchingBrace(lines, index);

                let signature = isEnumClass ? 'enum class ' : 'enum ';
                signature += name;
                if (underlyingType) signature += ' : ' + underlyingType;

                enums.push({
                    name,
                    type: 'enum',
                    location: this.createLocation(filePath, index + 1, endLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, index + 1),
                    modifiers: [isEnumClass ? 'enum class' : 'enum'],
                });
            }
        });

        return enums;
    }

    private parseCppParameters(paramsStr: string): Parameter[] {
        if (!paramsStr.trim()) return [];

        const params: Parameter[] = [];
        let currentParam = '';
        let depth = 0; // Track template/generic depth

        // Split by comma, but respect template brackets
        for (let i = 0; i < paramsStr.length; i++) {
            const char = paramsStr[i];

            if (char === '<' || char === '(') depth++;
            else if (char === '>' || char === ')') depth--;
            else if (char === ',' && depth === 0) {
                params.push(this.parseSingleCppParameter(currentParam.trim()));
                currentParam = '';
                continue;
            }

            currentParam += char;
        }

        if (currentParam.trim()) {
            params.push(this.parseSingleCppParameter(currentParam.trim()));
        }

        return params;
    }

    private parseSingleCppParameter(param: string): Parameter {
        // Handle default values
        let defaultValue: string | undefined;
        if (param.includes('=')) {
            const parts = param.split('=');
            param = parts[0].trim();
            defaultValue = parts[1].trim();
        }

        // Parse type and name
        // Pattern: type name or type& name or type* name or type<T> name
        const tokens = param.split(/\s+/);

        if (tokens.length === 1) {
            // Just a type, no name
            return {
                name: '',
                type: tokens[0],
                defaultValue,
                optional: !!defaultValue,
            };
        }

        // Last token is usually the name
        const name = tokens[tokens.length - 1].replace(/[&*\[\]]/g, '');
        const type = tokens.slice(0, -1).join(' ') + tokens[tokens.length - 1].match(/[&*\[\]]*/)?.[0] || '';

        return {
            name,
            type: type.trim(),
            defaultValue,
            optional: !!defaultValue,
        };
    }

    private buildMethodSignature(
        returnType: string,
        name: string,
        params: string,
        modifiers: string[]
    ): string {
        const modPrefix = modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
        return `${modPrefix}${returnType} ${name}(${params})`;
    }

    private findMatchingBrace(lines: string[], startLine: number): number {
        let braceCount = 0;
        let foundOpen = false;

        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];

            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                    foundOpen = true;
                } else if (char === '}') {
                    braceCount--;
                    if (foundOpen && braceCount === 0) {
                        return i + 1;
                    }
                }
            }
        }

        return startLine + 1;
    }

    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }

    private findPrecedingComments(comments: CommentBlock[], lineNum: number): CommentBlock[] {
        return comments.filter(c =>
            c.location.endLine < lineNum &&
            c.location.endLine >= lineNum - 5 // Look back max 5 lines
        );
    }

    private isAttachedComment(comment: CommentBlock, symbols: CodeSymbol[]): boolean {
        return symbols.some(s =>
            s.comments?.some(c =>
                c.location.startLine === comment.location.startLine &&
                c.location.endLine === comment.location.endLine
            )
        );
    }

    private isLineInRanges(lineNum: number, ranges: Array<{ start: number, end: number }>): boolean {
        return ranges.some(r => lineNum >= r.start && lineNum <= r.end);
    }
}