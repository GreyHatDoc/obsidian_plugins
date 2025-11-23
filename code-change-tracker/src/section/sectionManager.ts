import { App, TFile, Notice } from 'obsidian';

export interface SectionBoundary {
    sectionPath: string;
    startLine: number;
    endLine: number;
    indentation: string;
}

export class SectionManager {
    constructor(private app: App) { }

    /**
     * Find section boundaries in markdown content
     */
    findSection(content: string, sectionPath: string): SectionBoundary | null {
        const lines = content.split('\n');

        let startLine = -1;
        let endLine = -1;
        let indentation = '';

        // Look for section markers
        const startMarker = `<!-- code-watch: ${sectionPath} -->`;
        const endMarker = `<!-- /code-watch -->`;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes(startMarker)) {
                startLine = i;
                indentation = line.match(/^(\s*)/)?.[1] || '';
                continue;
            }

            if (startLine !== -1 && line.includes(endMarker)) {
                endLine = i;
                break;
            }
        }

        if (startLine === -1 || endLine === -1) {
            return null;
        }

        return {
            sectionPath,
            startLine,
            endLine,
            indentation,
        };
    }

    /**
     * Replace section content
     */
    async replaceSection(
        file: TFile,
        sectionPath: string,
        newContent: string
    ): Promise<boolean> {
        try {
            const content = await this.app.vault.read(file);
            const section = this.findSection(content, sectionPath);

            if (!section) {
                console.warn(`Section not found: ${sectionPath} in ${file.path}`);
                new Notice(`Section "${sectionPath}" not found in ${file.name}`);
                return false;
            }

            const lines = content.split('\n');

            // Prepare new content with proper indentation
            const indentedContent = newContent
                .split('\n')
                .map(line => line ? section.indentation + line : '')
                .join('\n');

            // Add timestamp comment
            const timestamp = new Date().toLocaleString();
            const updateComment = `${section.indentation}<!-- Last updated: ${timestamp} -->`;

            // Build new content
            const beforeSection = lines.slice(0, section.startLine + 1);
            const afterSection = lines.slice(section.endLine);

            const newLines = [
                ...beforeSection,
                '',
                updateComment,
                '',
                indentedContent,
                '',
                ...afterSection,
            ];

            const newFileContent = newLines.join('\n');

            // Write back to file
            await this.app.vault.modify(file, newFileContent);

            console.log(`Updated section "${sectionPath}" in ${file.path}`);
            return true;

        } catch (error) {
            console.error(`Error updating section:`, error);
            new Notice(`Failed to update section "${sectionPath}"`);
            return false;
        }
    }

    /**
     * Create a new section if it doesn't exist
     */
    async createSection(
        file: TFile,
        sectionPath: string,
        title?: string
    ): Promise<boolean> {
        try {
            const content = await this.app.vault.read(file);

            // Check if section already exists
            if (this.findSection(content, sectionPath)) {
                return true; // Already exists
            }

            // Add section at the end
            const sectionTitle = title || this.humanizeSectionId(sectionPath);
            const newSection = [
                '',
                `## ${sectionTitle}`,
                `<!-- code-watch: ${sectionPath} -->`,
                '',
                '*Documentation will appear here automatically*',
                '',
                `<!-- /code-watch -->`,
                '',
            ].join('\n');

            const newContent = content + newSection;
            await this.app.vault.modify(file, newContent);

            console.log(`Created section "${sectionPath}" in ${file.path}`);
            new Notice(`Created section "${sectionTitle}" in ${file.name}`);

            return true;

        } catch (error) {
            console.error(`Error creating section:`, error);
            return false;
        }
    }

    /**
     * Convert section ID to human-readable title
     */
    private humanizeSectionId(sectionPath: string): string {
        return sectionPath
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Get all section IDs in a file
     */
    async getSections(file: TFile): Promise<string[]> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        const sections: string[] = [];
        const sectionRegex = /<!-- code-watch: ([a-zA-Z0-9-_\.]+) -->/;

        for (const line of lines) {
            const match = line.match(sectionRegex);
            if (match) {
                sections.push(match[1]);
            }
        }

        return sections;
    }
}