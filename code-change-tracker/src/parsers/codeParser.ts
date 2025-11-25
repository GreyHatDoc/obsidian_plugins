
export interface CodeSymbol {
    name: string;
    type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type' | 'enum' | 'namespace' | 'module' | 'struct';
    startLine: number;
    endLine: number;
    signature?: string;
    comments?: CommentInterface[];
    decorators?: string[];
    modifiers?: string[]; // public, private, static, etc.
    parameters?: VariableInterface[];
    returnType?: string;
    parentSymbol?: string; // For methods, the parent class name
}
export interface ObjectInterface {
    name: string;
    startLine: number;
    endLine: number;
}
export interface CommentInterface {
    content: string;
    startLine: number;
    endLine: number;
}

export interface VariableInterface {
    name: string;
    type?: string;
    startLine: number;
    endLine: number;
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
    comments: CommentInterface[];
    lastModified: Date;
    gitInfo?: GitFileInfo;

}

export interface ImportStatement {
    source: string;
    imports: string[];
    startLine: number;
    endLine: number;
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

}