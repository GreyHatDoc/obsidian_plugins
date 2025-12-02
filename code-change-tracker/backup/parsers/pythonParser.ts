import { CodeParser, Parameter, ImportStatement, FileAnalysis, CodeSymbol, CommentBlock } from './codeParser';

export class PythonParser extends CodeParser {
    readonly language = 'python';
    readonly extensions = ['py', 'pyi'];

    parse(content: string, filePath: string): FileAnalysis {
        const symbols: CodeSymbol[] = [];
        const comments: CommentBlock[] = [];
        const imports: ImportStatement[] = [];

        const lines = content.split('\n');

        // Simple regex-based parsing (for production, use tree-sitter or ast)
        let currentClass: string | null = null;
        let lineNumber = 0;

        for (const line of lines) {
            lineNumber++;

            // Extract classes
            const classMatch = line.match(/^class\s+(\w+)(\([^)]*\))?:/);
            if (classMatch) {
                currentClass = classMatch[1];
                symbols.push({
                    name: currentClass,
                    type: 'class',
                    location: this.createLocation(filePath, lineNumber, lineNumber),
                    signature: line.trim(),
                    comments: this.extractPrecedingComment(lines, lineNumber - 1, filePath),
                });
                continue;
            }

            // Extract functions/methods
            const funcMatch = line.match(/^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(->\s*[^:]+)?:/);
            if (funcMatch) {
                const indent = funcMatch[1];
                const name = funcMatch[2];
                const params = funcMatch[3];
                const returnType = funcMatch[4]?.trim();

                const isMethod = currentClass && indent.length > 0;

                symbols.push({
                    name,
                    type: isMethod ? 'method' : 'function',
                    parentSymbol: isMethod ? currentClass ?? undefined : undefined,
                    location: this.createLocation(filePath, lineNumber, lineNumber),
                    signature: line.trim(),
                    comments: this.extractPrecedingComment(lines, lineNumber - 1, filePath),
                    parameters: this.parsePythonParams(params),
                    returnType: returnType?.replace(/^->\s*/, ''),
                });
                continue;
            }

            // Extract imports
            const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
            if (importMatch) {
                const source = importMatch[1] || 'builtin';
                const importNames = importMatch[2].split(',').map(s => s.trim());

                imports.push({
                    source,
                    imports: importNames,
                    location: this.createLocation(filePath, lineNumber, lineNumber),
                });
                continue;
            }

            // Extract standalone comments
            const commentMatch = line.match(/^\s*#\s*(.+)/);
            if (commentMatch) {
                comments.push({
                    content: commentMatch[1],
                    type: 'line',
                    location: this.createLocation(filePath, lineNumber, lineNumber),
                });
            }

            // Reset current class if we've de-indented
            if (currentClass && line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
                currentClass = null;
            }
        }

        return {
            filePath,
            language: this.language,
            symbols,
            imports,
            comments,
            lastModified: new Date(),
        };
    }

    private extractPrecedingComment(
        lines: string[],
        lineIndex: number,
        filePath: string
    ): CommentBlock[] {
        const comments: CommentBlock[] = [];
        let i = lineIndex;

        // Check for docstring
        if (lineIndex + 1 < lines.length) {
            const nextLine = lines[lineIndex + 1].trim();
            if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
                const docstringLines: string[] = [];
                let j = lineIndex + 1;
                const quote = nextLine.startsWith('"""') ? '"""' : "'''";

                while (j < lines.length) {
                    const line = lines[j];
                    docstringLines.push(line);

                    if (j > lineIndex + 1 && line.includes(quote)) {
                        break;
                    }
                    j++;
                }

                comments.push({
                    content: docstringLines.join('\n').replace(/"""|'''/g, '').trim(),
                    type: 'doc',
                    location: this.createLocation(filePath, lineIndex + 2, j + 1),
                });

                return comments;
            }
        }

        // Check for preceding # comments
        while (i >= 0) {
            const line = lines[i].trim();
            if (line.startsWith('#')) {
                comments.unshift({
                    content: line.replace(/^#\s*/, ''),
                    type: 'line',
                    location: this.createLocation(filePath, i + 1, i + 1),
                });
                i--;
            } else if (line.length === 0) {
                i--;
            } else {
                break;
            }
        }

        return comments;
    }

    private parsePythonParams(paramsStr: string): Parameter[] {
        if (!paramsStr.trim()) return [];

        return paramsStr.split(',').map(param => {
            const parts = param.trim().split(':');
            const namePart = parts[0].trim();
            const typePart = parts[1]?.split('=')[0].trim();
            const defaultValue = param.includes('=') ? param.split('=')[1].trim() : undefined;

            return {
                name: namePart,
                type: typePart,
                defaultValue,
                optional: !!defaultValue,
            };
        });
    }
}