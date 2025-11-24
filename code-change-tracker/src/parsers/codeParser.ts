
export interface CodeSymbol {
    name: string;
    type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type' | 'enum' | 'namespace' | 'module' | 'struct';
    location: CodeLocation;
    signature?: string;
    comments?: CommentBlock[];
    decorators?: string[];
    modifiers?: string[]; // public, private, static, etc.
    parameters?: Parameter[];
    returnType?: string;
    parentSymbol?: string; // For methods, the parent class name
}

export interface CodeLocation {
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}

export interface CommentBlock {
    content: string;
    type: 'line' | 'block' | 'doc';
    location: CodeLocation;
}

export interface Parameter {
    name: string;
    type?: string;
    defaultValue?: string;
    optional?: boolean;
}

export interface fileMetaData {
    filePath: string;
    fileSize: number;
    lastModified: Date;
}

export interface FileAnalysis {
    filePath: string;
    language: string;
    symbols: CodeSymbol[];
    imports: ImportStatement[];
    comments: CommentBlock[];
    lastModified: Date;
    gitInfo?: GitFileInfo;

}

export interface ImportStatement {
    source: string;
    imports: string[];
    location: CodeLocation;
}

export interface GitFileInfo {
    lastCommit: string;
    lastCommitMessage: string;
    lastCommitDate: Date;
    totalCommits: number;
    contributors: string[];
}

export abstract class CodeParser {
    abstract readonly language: string;
    abstract readonly extensions: string[];

    abstract parse(content: string, filePath: string): FileAnalysis;


    protected createLocation(
        filePath: string,
        startLine: number,
        endLine: number,
        startColumn: number = 0,
        endColumn: number = 0
    ): CodeLocation {
        return { filePath, startLine, endLine, startColumn, endColumn };
    }
}