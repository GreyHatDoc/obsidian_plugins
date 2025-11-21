import { FileAnalysis, CodeSymbol } from '../parsers/codeParser';
import { CommitInfo } from '../watchers/gitWatcher';

export interface GeneratorOptions {
    includeComments?: boolean;
    includeGitInfo?: boolean;
    includeImports?: boolean;
    groupByType?: boolean;
    sortAlphabetically?: boolean;
}

export class MarkdownGenerator {
    generate(analyses: FileAnalysis[], options: GeneratorOptions = {}): string {
        const {
            includeComments = true,
            includeGitInfo = true,
            includeImports = true,
            groupByType = true,
            sortAlphabetically = true,
        } = options;

        let markdown = '# Code Documentation\n\n';
        markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
        markdown += `Total Files: ${analyses.length}\n\n`;

        markdown += '## Table of Contents\n\n';
        for (const analysis of analyses) {
            const fileName = this.getFileName(analysis.filePath);
            markdown += `- [[#${fileName}|${fileName}]]\n`;
        }
        markdown += '\n---\n\n';

        for (const analysis of analyses) {
            markdown += this.generateFileSection(analysis, options);
        }

        return markdown;
    }

    private generateFileSection(analysis: FileAnalysis, options: GeneratorOptions): string {
        const fileName = this.getFileName(analysis.filePath);
        let section = `## ${fileName}\n\n`;

        section += `**Path:** \`${analysis.filePath}\`\n`;
        section += `**Language:** ${analysis.language}\n`;
        section += `**Last Modified:** ${analysis.lastModified.toLocaleString()}\n\n`;

        // Git info
        if (options.includeGitInfo && analysis.gitInfo) {
            section += '### Git Information\n\n';
            section += `- **Last Commit:** \`${analysis.gitInfo.lastCommit.substring(0, 7)}\`\n`;
            section += `- **Message:** ${analysis.gitInfo.lastCommitMessage}\n`;
            section += `- **Date:** ${analysis.gitInfo.lastCommitDate.toLocaleString()}\n`;
            section += `- **Total Commits:** ${analysis.gitInfo.totalCommits}\n`;
            section += `- **Contributors:** ${analysis.gitInfo.contributors.join(', ')}\n\n`;
        }

        // Imports
        if (options.includeImports && analysis.imports.length > 0) {
            section += '### Imports\n\n';
            for (const imp of analysis.imports) {
                section += `- \`${imp.source}\`: ${imp.imports.join(', ')}\n`;
            }
            section += '\n';
        }

        // Symbols
        if (options.groupByType) {
            section += this.generateSymbolsByType(analysis.symbols, options);
        } else {
            section += this.generateSymbolsInOrder(analysis.symbols, options);
        }

        section += '\n---\n\n';

        return section;
    }

    private generateSymbolsByType(symbols: CodeSymbol[], options: GeneratorOptions): string {
        let output = '';

        const groups = {
            class: symbols.filter(s => s.type === 'class'),
            interface: symbols.filter(s => s.type === 'interface'),
            function: symbols.filter(s => s.type === 'function'),
            method: symbols.filter(s => s.type === 'method'),
        };

        if (options.sortAlphabetically) {
            for (const key in groups) {
                groups[key as keyof typeof groups].sort((a, b) => a.name.localeCompare(b.name));
            }
        }

        if (groups.class.length > 0) {
            output += '### Classes\n\n';
            for (const symbol of groups.class) {
                output += this.generateSymbolEntry(symbol, options);
            }
        }

        if (groups.interface.length > 0) {
            output += '### Interfaces\n\n';
            for (const symbol of groups.interface) {
                output += this.generateSymbolEntry(symbol, options);
            }
        }

        if (groups.function.length > 0) {
            output += '### Functions\n\n';
            for (const symbol of groups.function) {
                output += this.generateSymbolEntry(symbol, options);
            }
        }

        if (groups.method.length > 0) {
            output += '### Methods\n\n';
            for (const symbol of groups.method) {
                output += this.generateSymbolEntry(symbol, options);
            }
        }

        return output;
    }

    private generateSymbolsInOrder(symbols: CodeSymbol[], options: GeneratorOptions): string {
        let output = '### Code Structure\n\n';

        for (const symbol of symbols) {
            output += this.generateSymbolEntry(symbol, options);
        }

        return output;
    }

    private generateSymbolEntry(symbol: CodeSymbol, options: GeneratorOptions): string {
        let entry = `#### \`${symbol.name}\`\n\n`;

        if (symbol.signature) {
            entry += '```' + this.getLanguageForSymbol(symbol) + '\n';
            entry += symbol.signature + '\n';
            entry += '```\n\n';
        }

        entry += `- **Type:** ${symbol.type}\n`;
        entry += `- **Location:** Lines ${symbol.location.startLine}-${symbol.location.endLine}\n`;

        if (symbol.parentSymbol) {
            entry += `- **Parent:** \`${symbol.parentSymbol}\`\n`;
        }

        if (symbol.modifiers && symbol.modifiers.length > 0) {
            entry += `- **Modifiers:** ${symbol.modifiers.join(', ')}\n`;
        }

        if (symbol.parameters && symbol.parameters.length > 0) {
            entry += '- **Parameters:**\n';
            for (const param of symbol.parameters) {
                const typeInfo = param.type ? `: ${param.type}` : '';
                const defaultInfo = param.defaultValue ? ` = ${param.defaultValue}` : '';
                const optionalInfo = param.optional ? ' (optional)' : '';
                entry += `  - \`${param.name}${typeInfo}${defaultInfo}\`${optionalInfo}\n`;
            }
        }

        if (symbol.returnType) {
            entry += `- **Returns:** \`${symbol.returnType}\`\n`;
        }

        if (options.includeComments && symbol.comments && symbol.comments.length > 0) {
            entry += '\n**Documentation:**\n\n';
            for (const comment of symbol.comments) {
                entry += `${comment.content}\n\n`;
            }
        }

        entry += '\n';

        return entry;
    }

    private getLanguageForSymbol(symbol: CodeSymbol): string {
        // Infer from file path
        const ext = symbol.location.filePath.split('.').pop();
        const langMap: Record<string, string> = {
            ts: 'typescript',
            js: 'javascript',
            py: 'python',
            scala: 'scala',
            cpp: 'cpp',
            c: 'c',
        };
        return langMap[ext || ''] || '';
    }

    private getFileName(path: string): string {
        return path.split('/').pop() || path;
    }
}
