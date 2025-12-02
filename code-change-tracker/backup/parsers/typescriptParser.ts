import * as ts from 'typescript';
import { CodeParser, Parameter, ImportStatement, FileAnalysis, CodeSymbol, CommentBlock } from './codeParser';

export class TypeScriptParser extends CodeParser {
    readonly language = 'typescript';
    readonly extensions = ['ts', 'tsx', 'js', 'jsx'];

    parse(content: string, filePath: string): FileAnalysis {
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        const symbols: CodeSymbol[] = [];
        const comments: CommentBlock[] = [];
        const imports: ImportStatement[] = [];

        const visit = (node: ts.Node) => {
            // Extract classes
            if (ts.isClassDeclaration(node) && node.name) {
                symbols.push(this.extractClass(node, sourceFile, filePath));
            }

            // Extract functions
            if (ts.isFunctionDeclaration(node) && node.name) {
                symbols.push(this.extractFunction(node, sourceFile, filePath));
            }

            // Extract interfaces
            if (ts.isInterfaceDeclaration(node)) {
                symbols.push(this.extractInterface(node, sourceFile, filePath));
            }

            // Extract imports
            if (ts.isImportDeclaration(node)) {
                const importStmt = this.extractImport(node, sourceFile, filePath);
                if (importStmt) imports.push(importStmt);
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);

        // Extract standalone comments
        this.extractComments(sourceFile, content, filePath, comments);

        return {
            filePath,
            language: this.language,
            symbols,
            imports,
            comments,
            lastModified: new Date(),
        };
    }

    private extractClass(
        node: ts.ClassDeclaration,
        sourceFile: ts.SourceFile,
        filePath: string
    ): CodeSymbol {
        const name = node.name!.getText(sourceFile);
        const { line: startLine, character: startColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getEnd());

        const comments = this.getNodeComments(node, sourceFile, filePath);
        const modifiers = this.getModifiers(node);

        // Extract methods as child symbols
        const methods: CodeSymbol[] = [];
        node.members.forEach(member => {
            if (ts.isMethodDeclaration(member) && member.name) {
                methods.push(this.extractMethod(member, sourceFile, filePath, name));
            }
        });

        // Add methods to symbols array separately but mark parent
        return {
            name,
            type: 'class',
            location: this.createLocation(filePath, startLine + 1, endLine + 1, startColumn, endColumn),
            comments,
            modifiers,
            signature: this.getClassSignature(node, sourceFile),
        };
    }

    private extractFunction(
        node: ts.FunctionDeclaration,
        sourceFile: ts.SourceFile,
        filePath: string
    ): CodeSymbol {
        const name = node.name!.getText(sourceFile);
        const { line: startLine, character: startColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getEnd());

        const parameters = this.extractParameters(node, sourceFile);
        const returnType = node.type ? node.type.getText(sourceFile) : 'void';
        const comments = this.getNodeComments(node, sourceFile, filePath);

        return {
            name,
            type: 'function',
            location: this.createLocation(filePath, startLine + 1, endLine + 1, startColumn, endColumn),
            signature: this.getFunctionSignature(node, sourceFile),
            comments,
            parameters,
            returnType,
            modifiers: this.getModifiers(node),
        };
    }

    private extractMethod(
        node: ts.MethodDeclaration,
        sourceFile: ts.SourceFile,
        filePath: string,
        parentClass: string
    ): CodeSymbol {
        const name = node.name.getText(sourceFile);
        const { line: startLine, character: startColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getEnd());

        const parameters = this.extractParameters(node, sourceFile);
        const returnType = node.type ? node.type.getText(sourceFile) : 'void';
        const comments = this.getNodeComments(node, sourceFile, filePath);

        return {
            name,
            type: 'method',
            parentSymbol: parentClass,
            location: this.createLocation(filePath, startLine + 1, endLine + 1, startColumn, endColumn),
            signature: this.getMethodSignature(node, sourceFile),
            comments,
            parameters,
            returnType,
            modifiers: this.getModifiers(node),
        };
    }

    private extractInterface(
        node: ts.InterfaceDeclaration,
        sourceFile: ts.SourceFile,
        filePath: string
    ): CodeSymbol {
        const name = node.name.getText(sourceFile);
        const { line: startLine, character: startColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endColumn } =
            sourceFile.getLineAndCharacterOfPosition(node.getEnd());

        return {
            name,
            type: 'interface',
            location: this.createLocation(filePath, startLine + 1, endLine + 1, startColumn, endColumn),
            signature: node.getText(sourceFile).split('{')[0].trim(),
            comments: this.getNodeComments(node, sourceFile, filePath),
        };
    }

    private extractParameters(
        node: ts.FunctionDeclaration | ts.MethodDeclaration,
        sourceFile: ts.SourceFile
    ): Parameter[] {
        return node.parameters.map(param => ({
            name: param.name.getText(sourceFile),
            type: param.type ? param.type.getText(sourceFile) : undefined,
            optional: !!param.questionToken,
            defaultValue: param.initializer ? param.initializer.getText(sourceFile) : undefined,
        }));
    }

    private getNodeComments(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        filePath: string
    ): CommentBlock[] {
        const comments: CommentBlock[] = [];
        const fullText = sourceFile.getFullText();
        const nodePos = node.getFullStart();

        const leadingComments = ts.getLeadingCommentRanges(fullText, nodePos);

        if (leadingComments) {
            for (const comment of leadingComments) {
                const commentText = fullText.substring(comment.pos, comment.end);
                const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(comment.pos);
                const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(comment.end);

                comments.push({
                    content: this.cleanComment(commentText),
                    type: comment.kind === ts.SyntaxKind.SingleLineCommentTrivia ? 'line' : 'block',
                    location: this.createLocation(filePath, startLine + 1, endLine + 1),
                });
            }
        }

        return comments;
    }

    private extractComments(
        sourceFile: ts.SourceFile,
        content: string,
        filePath: string,
        comments: CommentBlock[]
    ): void {
        const commentRanges = ts.getLeadingCommentRanges(content, 0) || [];

        for (const range of commentRanges) {
            const text = content.substring(range.pos, range.end);
            const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(range.pos);
            const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(range.end);

            comments.push({
                content: this.cleanComment(text),
                type: range.kind === ts.SyntaxKind.SingleLineCommentTrivia ? 'line' : 'doc',
                location: this.createLocation(filePath, startLine + 1, endLine + 1),
            });
        }
    }

    private getModifiers(node: ts.Node): string[] {
        if (!ts.canHaveModifiers(node)) return [];

        const modifiers = ts.getModifiers(node);
        if (!modifiers) return [];

        return modifiers.map(mod => mod.getText());
    }

    private cleanComment(comment: string): string {
        return comment
            .replace(/^\/\*\*?|\*\/$/g, '') // Remove /** */ or /* */
            .replace(/^\/\//g, '') // Remove //
            .split('\n')
            .map(line => line.replace(/^\s*\*\s?/, '').trim())
            .join('\n')
            .trim();
    }

    private getFunctionSignature(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): string {
        const name = node.name?.getText(sourceFile) || 'anonymous';
        const params = node.parameters.map(p => p.getText(sourceFile)).join(', ');
        const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : '';
        return `function ${name}(${params})${returnType}`;
    }

    private getMethodSignature(node: ts.MethodDeclaration, sourceFile: ts.SourceFile): string {
        const name = node.name.getText(sourceFile);
        const params = node.parameters.map(p => p.getText(sourceFile)).join(', ');
        const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : '';
        return `${name}(${params})${returnType}`;
    }

    private getClassSignature(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): string {
        const name = node.name!.getText(sourceFile);
        const heritage = node.heritageClauses?.map(c => c.getText(sourceFile)).join(' ') || '';
        return `class ${name} ${heritage}`.trim();
    }

    private extractImport(
        node: ts.ImportDeclaration,
        sourceFile: ts.SourceFile,
        filePath: string
    ): ImportStatement | null {
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
            return null;
        }

        const source = node.moduleSpecifier.text;
        const imports: string[] = [];

        if (node.importClause) {
            // Default import
            if (node.importClause.name) {
                imports.push(node.importClause.name.getText(sourceFile));
            }

            // Named imports
            if (node.importClause.namedBindings) {
                if (ts.isNamedImports(node.importClause.namedBindings)) {
                    node.importClause.namedBindings.elements.forEach(element => {
                        imports.push(element.name.getText(sourceFile));
                    });
                } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                    imports.push(`* as ${node.importClause.namedBindings.name.getText(sourceFile)}`);
                }
            }
        }

        const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

        return {
            source,
            imports,
            location: this.createLocation(filePath, startLine + 1, endLine + 1),
        };
    }
}