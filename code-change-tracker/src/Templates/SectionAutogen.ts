class SectionAutogen {
    sectionID: number;
    codeFilePath: string;

    constructor(sectionID: number, codeFile: string) {
        this.sectionID = sectionID;
        this.codeFilePath = codeFile;
    }

    defineTemplate(): string {
        return `
        <!-- code-watch-section: ${this.sectionID} for path ${this.codeFilePath} -->
        **This section is auto-generated. Do not edit directly.**
Documentation will appear here automatically when the code file changes.

<!-- /code-watch-section -->
`;

    }
}

export { SectionAutogen };