
import { Plugin, TFile, Notice, MarkdownView, Menu, Editor } from 'obsidian';
import { ParserRegistry } from './parsers/parserRegistry';
import { TypeScriptParser } from './parsers/typescriptParser';
import { PythonParser } from './parsers/pythonParser';
import { CppParser } from './parsers/cppParser';
import { ScalaParser } from './parsers/scalaParser';
import { FileScanner } from './coordinators/fileCoordinator';
import { MarkdownGenerator } from './generator/markdownGenerator';
import { GitIntegration } from './watchers/gitWatcher';
import { UpdateCoordinator } from './coordinators/updateCoordinator';
import { SectionManager } from './section/sectionManager';
import { CodeFileSuggestModal } from './modals/codeFileSuggestModal';
import { CodeFileSectionSuggestModal } from './modals/codeFileSectionSuggestModal';
import { CodeDocSettings, CodeDocSettingTab, DEFAULT_SETTINGS } from './settings';

export default class CodeDocumentationPlugin extends Plugin {
    settings!: CodeDocSettings;
    parserRegistry!: ParserRegistry;
    fileScanner!: FileScanner;
    markdownGenerator!: MarkdownGenerator;
    gitIntegration: GitIntegration | null = null;
    updateCoordinator!: UpdateCoordinator;
    sectionManager!: SectionManager;
    codeFileSuggestModal!: CodeFileSuggestModal;
    codeFileSectionSuggestModal!: CodeFileSectionSuggestModal;

    async onload() {
        await this.loadSettings();

        // Initialize components
        this.parserRegistry = new ParserRegistry();
        this.fileScanner = new FileScanner(this.app.vault, this.parserRegistry);
        this.markdownGenerator = new MarkdownGenerator();
        this.sectionManager = new SectionManager(this.app);

        // Register parsers
        this.parserRegistry.register(new TypeScriptParser());
        this.parserRegistry.register(new PythonParser());
        this.parserRegistry.register(new CppParser());
        this.parserRegistry.register(new ScalaParser());

        // Initialize git
        const vaultPath = (this.app.vault.adapter as any).basePath;
        this.gitIntegration = new GitIntegration(vaultPath);

        // Initialize update coordinator
        this.updateCoordinator = new UpdateCoordinator(
            this.app,
            this.parserRegistry,
            this.markdownGenerator,
            this.gitIntegration,
            {
                includeComments: this.settings.includeComments,
                includeGitInfo: this.settings.includeGitInfo,
                includeImports: this.settings.includeImports,
                groupByType: this.settings.groupByType,
                sortAlphabetically: this.settings.sortAlphabetically,
            }
        );

        // Start watching all configured files
        await this.updateCoordinator.initializeAllWatches();

        // Add ribbon icon
        this.addRibbonIcon('code', 'Generate Code Documentation', async () => {
            await this.generateDocumentation();
        });

        // Add status bar item
        const statusBarItem = this.addStatusBarItem();
        this.updateStatusBar(statusBarItem);

        // Commands
        this.addCommand({
            id: 'generate-code-docs',
            name: 'Generate Code Documentation',
            callback: async () => {
                await this.generateDocumentation();
            },
        });

        this.addCommand({
            id: 'generate-docs-for-file',
            name: 'Generate Documentation for Current File',
            editorCallback: async (editor, view) => {
                const file = view.file;
                if (!file) return;
                await this.generateDocumentationForFile(file);
            },
        });
        this.addCommand({
            id: 'generate-docs-for-selected-file',
            name: 'Generate Documentation for Selected Code File',
            callback: async () => {
                new CodeFileSuggestModal(this.app, this).open();
            },
        });
        this.addCommand({
            id: 'start-watching-current',
            name: 'Start Watching Code Files (Current Document)',
            editorCallback: async (editor, view) => {
                const file = view.file;
                if (!file) return;
                await this.updateCoordinator.initializeWatchesForFile(file);
                new Notice(`Started watching code files for ${file.name}`);
            },
        });

        this.addCommand({
            id: 'stop-watching-current',
            name: 'Stop Watching Code Files (Current Document)',
            editorCallback: async (editor, view) => {
                const file = view.file;
                if (!file) return;
                this.updateCoordinator.stopWatchesForFile(file);
                new Notice(`Stopped watching code files for ${file.name}`);
            },
        });

        this.addCommand({
            id: 'manual-update-section',
            name: 'Manually Update Current Section',
            editorCallback: async (editor, view) => {
                if (view instanceof MarkdownView) {
                    await this.manualUpdateSection(editor, view);
                }
            },
        });

        this.addCommand({
            id: 'insert-code-watch-template',
            name: 'Insert Code Watch Template',
            editorCallback: (editor) => {
                this.insertCodeWatchTemplate(editor, null);
            },
        });

        this.addCommand({
            id: 'insert-code-watch-template-selected',
            name: 'Insert Code Watch Template (Selected File)',
            editorCallback: (editor) => {
                let selModal: typeof this.codeFileSectionSuggestModal = new CodeFileSectionSuggestModal(this.app, this);
                let selectedFile: TFile | null = null;
                selModal.open();
                selModal.onClose = () => {
                    selectedFile = selModal.getSelected();
                }
                this.insertCodeWatchTemplate(editor, selectedFile);
            },
        });

        // Settings tab
        this.addSettingTab(new CodeDocSettingTab(this.app, this));

        console.log('Code Documentation Plugin loaded with real-time watching');
    }

    onunload() {
        // Clean up watchers
        this.updateCoordinator.destroy();
        console.log('Code Documentation Plugin unloaded');
    }

    private updateStatusBar(statusBarItem: HTMLElement): void {
        const watchCount = this.updateCoordinator.getWatchStatus().size;
        statusBarItem.setText(`📝 Watching: ${watchCount} doc(s)`);

        // Update every 5 seconds
        this.registerInterval(
            window.setInterval(() => {
                const count = this.updateCoordinator.getWatchStatus().size;
                statusBarItem.setText(`📝 Watching: ${count} doc(s)`);
            }, 5000)
        );
    }

    private async manualUpdateSection(editor: Editor, view: MarkdownView): Promise<void> {
        const file = view.file;
        if (!file) return;

        // Get cursor position
        const cursor = editor.getCursor();
        const line = cursor.line;

        // Find which section we're in
        const content = await this.app.vault.read(file);
        const sections = await this.sectionManager.getSections(file);

        if (sections.length === 0) {
            new Notice('No code-watch sections found in this document');
            return;
        }

        // Find the section containing the cursor
        let targetSection: string | null = null;
        for (const sectionId of sections) {
            const boundary = this.sectionManager.findSection(content, sectionId);
            if (boundary && line >= boundary.startLine && line <= boundary.endLine) {
                targetSection = sectionId;
                break;
            }
        }

        if (!targetSection) {
            // If not in a section, show menu to choose
            const menu = new Menu();
            for (const sectionId of sections) {
                menu.addItem((item) => {
                    item
                        .setTitle(`Update: ${sectionId}`)
                        .onClick(async () => {
                            await this.updateCoordinator.manualUpdate(file, sectionId);
                        });
                });
            }
            menu.showAtMouseEvent(new MouseEvent('click'));
        } else {
            // Update the section we're in
            await this.updateCoordinator.manualUpdate(file, targetSection);
        }
    }

    private insertCodeWatchTemplate(editor: Editor, file: TFile | null): void {
        let filePath: string;
        if (file) {
            filePath = file.path;
            // If the file is in the vault root, ensure it starts with ./
            if (!filePath.startsWith('./') && !filePath.startsWith('/')) {
                filePath = `./${filePath}`;
            }
        } else {
            filePath = './path/to/your/file.ts';
        }
        const template = `---
code-watch:
  - path: "${filePath}"
    section: "code-section-1"
    update-mode: "realtime"
watch-interval: 1000
auto-update: true
---

## Code Documentation

<!-- code-watch-section: code-section-1 -->

Documentation will appear here automatically when the code file changes.

<!-- /code-watch-section -->
`;

        editor.replaceRange(template, editor.getCursor());
        new Notice('Code watch template inserted');
    }

    // ... (keep existing generateDocumentation and generateDocumentationForFile methods)
    async generateDocumentation() {
        const notice = new Notice('Scanning code files...', 0);

        try {
            // Scan files
            const analyses = await this.fileScanner.scanVaultDirectory({
                excludePatterns: this.settings.excludePatterns,
                includeDotFiles: false,
            });

            notice.setMessage('Enriching with git information...');

            // Add git info if enabled
            if (this.settings.includeGitInfo && this.gitIntegration) {
                const isRepo = await this.gitIntegration.isGitRepo();

                if (isRepo) {
                    for (const analysis of analyses) {
                        const gitInfo = await this.gitIntegration.getFileInfo(analysis.filePath);
                        if (gitInfo) {
                            analysis.gitInfo = gitInfo;
                        }
                    }
                }
            }

            notice.setMessage('Generating markdown...');

            // Generate markdown
            const markdown = this.markdownGenerator.generate(analyses, {
                includeComments: this.settings.includeComments,
                includeGitInfo: this.settings.includeGitInfo,
                includeImports: this.settings.includeImports,
                groupByType: this.settings.groupByType,
                sortAlphabetically: this.settings.sortAlphabetically,
            });

            // Save to file
            const outputPath = this.settings.outputPath || 'Code Documentation.md';
            await this.app.vault.adapter.write(outputPath, markdown);

            notice.hide();
            new Notice(`Documentation generated: ${outputPath}`);

            // Open the file
            const file = this.app.vault.getAbstractFileByPath(outputPath);
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(file);
            }

        } catch (error) {
            notice.hide();
            new Notice('Error generating documentation');
            console.error(error);
        }
    }

    async generateDocumentationForFile(file: TFile) {
        try {
            const parser = this.parserRegistry.getParserForFile(file.path);

            if (!parser) {
                new Notice(`No parser available for ${file.extension} files`);
                return;
            }

            const content = await this.app.vault.read(file);
            const analysis = parser.parse(content, file.path);

            // Add git info
            if (this.settings.includeGitInfo && this.gitIntegration) {
                const gitInfo = await this.gitIntegration.getFileInfo(file.path);
                if (gitInfo) {
                    analysis.gitInfo = gitInfo;
                }
            }

            const markdown = this.markdownGenerator.generate([analysis], {
                includeComments: this.settings.includeComments,
                includeGitInfo: this.settings.includeGitInfo,
                includeImports: this.settings.includeImports,
                groupByType: this.settings.groupByType,
                sortAlphabetically: this.settings.sortAlphabetically,
            });

            // Create output filename with path in same folder as file
            const parentPath = file.parent ? file.parent.path : '';
            const outputPath = parentPath ? `${parentPath}/${file.basename} - Documentation.md` : `${file.basename} - Documentation.md`;
            await this.app.vault.create(outputPath, markdown);

            new Notice(`Documentation created: ${outputPath}`);

            const docFile = this.app.vault.getAbstractFileByPath(outputPath);
            if (docFile instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(docFile);
            }

        } catch (error) {
            new Notice('Error generating documentation for file');
            console.error(error);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}