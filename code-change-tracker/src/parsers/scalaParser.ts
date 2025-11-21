import { CodeParser, FileAnalysis, CodeSymbol, CommentBlock, ImportStatement, Parameter } from './codeParser';

export class ScalaParser extends CodeParser {
    readonly language = 'scala';
    readonly extensions = ['scala', 'sc'];

    parse(content: string, filePath: string): FileAnalysis {
        const symbols: CodeSymbol[] = [];
        const comments: CommentBlock[] = [];
        const imports: ImportStatement[] = [];

        const lines = content.split('\n');

        // Extract comments
        this.extractComments(content, filePath, comments);

        // Extract imports
        this.extractImports(lines, filePath, imports);

        // Track current package and object context
        let currentPackage = '';
        let currentObject = '';
        let currentClass = '';

        // Extract packages
        const packageInfo = this.extractPackage(lines);
        if (packageInfo) {
            currentPackage = packageInfo.name;
        }

        // Extract objects (companion objects and standalone)
        const objects = this.extractObjects(lines, filePath, comments);
        symbols.push(...objects);

        // Extract classes and case classes
        const classes = this.extractClasses(lines, filePath, comments);
        symbols.push(...classes);

        // Extract traits
        const traits = this.extractTraits(lines, filePath, comments);
        symbols.push(...traits);

        // Extract top-level functions (defs)
        const functions = this.extractFunctions(lines, filePath, comments, [...classes, ...objects, ...traits]);
        symbols.push(...functions);

        // Extract vals and vars
        const variables = this.extractVariables(lines, filePath, comments);
        symbols.push(...variables);

        return {
            filePath,
            language: this.language,
            symbols,
            imports,
            comments: comments.filter(c => !this.isAttachedComment(c, symbols)),
            lastModified: new Date(),
        };
    }

    private extractComments(content: string, filePath: string, comments: CommentBlock[]): void {
        const lines = content.split('\n');
        let inBlockComment = false;
        let blockCommentStart = -1;
        let blockCommentLines: string[] = [];

        lines.forEach((line, index) => {
            const lineNum = index + 1;

            // Handle block comments (/* */ and /** */)
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
                        type: line.includes('/**') ? 'doc' : 'block',
                        location: this.createLocation(filePath, lineNum, lineNum),
                    });
                    inBlockComment = false;
                } else {
                    const isDoc = line.includes('/**');
                    blockCommentLines.push(line.substring(startIdx + (isDoc ? 3 : 2)));
                }
            } else if (inBlockComment) {
                const endIdx = line.indexOf('*/');
                if (endIdx !== -1) {
                    blockCommentLines.push(line.substring(0, endIdx));
                    const commentText = blockCommentLines
                        .map(l => l.replace(/^\s*\*\s?/, '').trim())
                        .join('\n')
                        .trim();

                    comments.push({
                        content: commentText,
                        type: 'doc',
                        location: this.createLocation(filePath, blockCommentStart, lineNum),
                    });

                    inBlockComment = false;
                    blockCommentLines = [];
                } else {
                    blockCommentLines.push(line);
                }
            }

            // Handle single-line comments
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

    private extractImports(lines: string[], filePath: string, imports: ImportStatement[]): void {
        lines.forEach((line, index) => {
            const importMatch = line.match(/^\s*import\s+(.+)$/);
            if (importMatch) {
                const importPath = importMatch[1].trim();

                // Handle multiple imports: import a.b.{C, D, E}
                const multiMatch = importPath.match(/^([^{]+)\{([^}]+)\}/);
                if (multiMatch) {
                    const basePath = multiMatch[1].trim();
                    const items = multiMatch[2].split(',').map(s => s.trim());

                    imports.push({
                        source: basePath,
                        imports: items,
                        location: this.createLocation(filePath, index + 1, index + 1),
                    });
                } else {
                    // Single import or wildcard
                    const parts = importPath.split('.');
                    const source = parts.slice(0, -1).join('.');
                    const item = parts[parts.length - 1];

                    imports.push({
                        source: source || importPath,
                        imports: [item || importPath],
                        location: this.createLocation(filePath, index + 1, index + 1),
                    });
                }
            }
        });
    }

    private extractPackage(lines: string[]): { name: string; line: number } | null {
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/^\s*package\s+([\w.]+)/);
            if (match) {
                return { name: match[1], line: i + 1 };
            }
        }
        return null;
    }

    private extractObjects(lines: string[], filePath: string, existingComments: CommentBlock[]): CodeSymbol[] {
        const objects: CodeSymbol[] = [];

        lines.forEach((line, index) => {
            // Match: object Name extends/with traits { or just object Name {
            const objectMatch = line.match(/^\s*(case\s+)?object\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{?/);
            if (objectMatch) {
                const isCaseObject = !!objectMatch[1];
                const name = objectMatch[2];
                const extendsClause = objectMatch[3]?.trim();

                const endLine = this.findMatchingBrace(lines, index);

                let signature = isCaseObject ? 'case object ' : 'object ';
                signature += name;
                if (extendsClause) signature += ' extends ' + extendsClause;

                const modifiers = [];
                if (isCaseObject) modifiers.push('case');

                objects.push({
                    name,
                    type: 'class', // Scala objects are singleton classes
                    location: this.createLocation(filePath, index + 1, endLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, index + 1),
                    modifiers,
                });

                // Extract methods from this object
                const methods = this.extractMethodsFromBlock(lines, index, endLine, filePath, name, existingComments);
                objects.push(...methods);
            }
        });

        return objects;
    }

    private extractClasses(lines: string[], filePath: string, existingComments: CommentBlock[]): CodeSymbol[] {
        const classes: CodeSymbol[] = [];

        lines.forEach((line, index) => {
            // Match: class Name(params) extends/with traits { or case class Name(params)
            const classMatch = line.match(
                /^\s*(abstract\s+|sealed\s+|final\s+)?(case\s+)?class\s+(\w+)(?:\[([^\]]+)\])?(?:\s*\(([^)]*)\))?(?:\s+extends\s+([^{]+))?\s*\{?/
            );

            if (classMatch) {
                const modifier1 = classMatch[1]?.trim();
                const isCaseClass = !!classMatch[2];
                const name = classMatch[3];
                const typeParams = classMatch[4];
                const constructorParams = classMatch[5];
                const extendsClause = classMatch[6]?.trim();

                const endLine = this.findMatchingBrace(lines, index);

                const modifiers = [];
                if (modifier1) modifiers.push(modifier1);
                if (isCaseClass) modifiers.push('case');

                let signature = modifiers.join(' ');
                if (signature) signature += ' ';
                signature += 'class ' + name;
                if (typeParams) signature += `[${typeParams}]`;
                if (constructorParams) signature += `(${constructorParams})`;
                if (extendsClause) signature += ' extends ' + extendsClause;

                const parameters = constructorParams ? this.parseScalaParameters(constructorParams) : [];

                classes.push({
                    name,
                    type: 'class',
                    location: this.createLocation(filePath, index + 1, endLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, index + 1),
                    modifiers,
                    parameters,
                });

                // Extract methods from this class
                const methods = this.extractMethodsFromBlock(lines, index, endLine, filePath, name, existingComments);
                classes.push(...methods);
            }
        });

        return classes;
    }

    private extractTraits(lines: string[], filePath: string, existingComments: CommentBlock[]): CodeSymbol[] {
        const traits: CodeSymbol[] = [];

        lines.forEach((line, index) => {
            // Match: trait Name extends/with other traits {
            const traitMatch = line.match(/^\s*(sealed\s+)?trait\s+(\w+)(?:\[([^\]]+)\])?(?:\s+extends\s+([^{]+))?\s*\{?/);

            if (traitMatch) {
                const sealed = traitMatch[1]?.trim();
                const name = traitMatch[2];
                const typeParams = traitMatch[3];
                const extendsClause = traitMatch[4]?.trim();

                const endLine = this.findMatchingBrace(lines, index);

                const modifiers = sealed ? [sealed] : [];

                let signature = sealed ? 'sealed trait ' : 'trait ';
                signature += name;
                if (typeParams) signature += `[${typeParams}]`;
                if (extendsClause) signature += ' extends ' + extendsClause;

                traits.push({
                    name,
                    type: 'interface', // Traits are similar to interfaces
                    location: this.createLocation(filePath, index + 1, endLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, index + 1),
                    modifiers,
                });

                // Extract methods from this trait
                const methods = this.extractMethodsFromBlock(lines, index, endLine, filePath, name, existingComments);
                traits.push(...methods);
            }
        });

        return traits;
    }

    private extractMethodsFromBlock(
        lines: string[],
        startLine: number,
        endLine: number,
        filePath: string,
        parentName: string,
        existingComments: CommentBlock[]
    ): CodeSymbol[] {
        const methods: CodeSymbol[] = [];

        for (let i = startLine + 1; i < endLine && i < lines.length; i++) {
            const line = lines[i];

            // Match def method(params): ReturnType = or def method[T](params): ReturnType
            const defMatch = line.match(
                /^\s*(private|protected|override|final|implicit)?\s*(def)\s+(\w+)(?:\[([^\]]+)\])?\s*(\([^)]*\))?(?:\s*:\s*([^=\{]+))?/
            );

            if (defMatch) {
                const modifier = defMatch[1]?.trim();
                const name = defMatch[3];
                const typeParams = defMatch[4];
                const params = defMatch[5]?.replace(/^\(|\)$/g, '');
                const returnType = defMatch[6]?.trim();

                // Find method end
                let methodEndLine = this.findMethodEnd(lines, i);

                const modifiers = modifier ? [modifier] : [];

                let signature = modifier ? `${modifier} def ` : 'def ';
                signature += name;
                if (typeParams) signature += `[${typeParams}]`;
                if (params) signature += `(${params})`;
                if (returnType) signature += `: ${returnType}`;

                const parameters = params ? this.parseScalaParameters(params) : [];

                methods.push({
                    name,
                    type: 'method',
                    parentSymbol: parentName,
                    location: this.createLocation(filePath, i + 1, methodEndLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, i + 1),
                    modifiers,
                    parameters,
                    returnType,
                });
            }
        }

        return methods;
    }

    private extractFunctions(
        lines: string[],
        filePath: string,
        existingComments: CommentBlock[],
        containers: CodeSymbol[]
    ): CodeSymbol[] {
        const functions: CodeSymbol[] = [];

        // Get ranges of classes/objects/traits to exclude
        const containerRanges = containers
            .filter(c => ['class', 'interface'].includes(c.type))
            .map(c => ({ start: c.location.startLine, end: c.location.endLine }));

        lines.forEach((line, index) => {
            const lineNum = index + 1;

            // Skip if inside a container
            if (this.isLineInRanges(lineNum, containerRanges)) return;

            // Match top-level def
            const defMatch = line.match(
                /^\s*(private|implicit)?\s*def\s+(\w+)(?:\[([^\]]+)\])?\s*(\([^)]*\))?(?:\s*:\s*([^=\{]+))?/
            );

            if (defMatch) {
                const modifier = defMatch[1]?.trim();
                const name = defMatch[2];
                const typeParams = defMatch[3];
                const params = defMatch[4]?.replace(/^\(|\)$/g, '');
                const returnType = defMatch[5]?.trim();

                const methodEndLine = this.findMethodEnd(lines, index);

                const modifiers = modifier ? [modifier] : [];

                let signature = modifier ? `${modifier} def ` : 'def ';
                signature += name;
                if (typeParams) signature += `[${typeParams}]`;
                if (params) signature += `(${params})`;
                if (returnType) signature += `: ${returnType}`;

                const parameters = params ? this.parseScalaParameters(params) : [];

                functions.push({
                    name,
                    type: 'function',
                    location: this.createLocation(filePath, lineNum, methodEndLine),
                    signature,
                    comments: this.findPrecedingComments(existingComments, lineNum),
                    modifiers,
                    parameters,
                    returnType,
                });
            }
        });

        return functions;
    }

    private extractVariables(
        lines: string[],
        filePath: string,
        existingComments: CommentBlock[]
    ): CodeSymbol[] {
        const variables: CodeSymbol[] = [];

        lines.forEach((line, index) => {
            // Match: val/var name: Type = value
            const valMatch = line.match(/^\s*(private|protected)?\s*(val|var)\s+(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?/);

            if (valMatch) {
                const modifier = valMatch[1]?.trim();
                const kind = valMatch[2]; // 'val' or 'var'
                const name = valMatch[3];
                const type = valMatch[4]?.trim();
                const value = valMatch[5]?.trim();

                const modifiers = [kind];
                if (modifier) modifiers.push(modifier);

                let signature = modifier ? `${modifier} ${kind}` : kind;
                signature += ` ${name}`;
                if (type) signature += `: ${type}`;
                if (value) signature += ` = ${value}`;

                variables.push({
                    name,
                    type: 'variable',
                    location: this.createLocation(filePath, index + 1, index + 1),
                    signature,
                    comments: this.findPrecedingComments(existingComments, index + 1),
                    modifiers,
                });
            }
        });

        return variables;
    }

    private parseScalaParameters(paramsStr: string): Parameter[] {
        if (!paramsStr.trim()) return [];

        const params: Parameter[] = [];
        let currentParam = '';
        let depth = 0;

        // Handle nested parameter lists and type parameters
        for (let i = 0; i < paramsStr.length; i++) {
            const char = paramsStr[i];

            if (char === '[' || char === '(' || char === '{') depth++;
            else if (char === ']' || char === ')' || char === '}') depth--;
            else if (char === ',' && depth === 0) {
                params.push(this.parseSingleScalaParameter(currentParam.trim()));
                currentParam = '';
                continue;
            }

            currentParam += char;
        }

        if (currentParam.trim()) {
            params.push(this.parseSingleScalaParameter(currentParam.trim()));
        }

        return params;
    }

    private parseSingleScalaParameter(param: string): Parameter {
        // Handle: name: Type = defaultValue or implicit name: Type
        let defaultValue: string | undefined;
        const isImplicit = param.startsWith('implicit');

        if (isImplicit) {
            param = param.replace(/^implicit\s+/, '');
        }

        if (param.includes('=')) {
            const parts = param.split('=');
            param = parts[0].trim();
            defaultValue = parts.slice(1).join('=').trim();
        }

        // Split by colon
        const colonIndex = param.indexOf(':');
        if (colonIndex === -1) {
            // No type annotation
            return {
                name: param.trim(),
                defaultValue,
                optional: !!defaultValue,
            };
        }

        const name = param.substring(0, colonIndex).trim();
        const type = param.substring(colonIndex + 1).trim();

        return {
            name,
            type,
            defaultValue,
            optional: !!defaultValue,
        };
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

    private findMethodEnd(lines: string[], startLine: number): number {
        const line = lines[startLine];

        // If the line ends with = {, find matching brace
        if (line.trim().endsWith('= {')) {
            return this.findMatchingBrace(lines, startLine);
        }

        // If line has {, find matching brace
        if (line.includes('{')) {
            return this.findMatchingBrace(lines, startLine);
        }

        // Single line definition
        return startLine + 1;
    }

    private findPrecedingComments(comments: CommentBlock[], lineNum: number): CommentBlock[] {
        return comments.filter(c =>
            c.location.endLine < lineNum &&
            c.location.endLine >= lineNum - 5
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