import { App, PluginSettingTab, Setting } from 'obsidian';
import CodeDocumentationPlugin from './main';

export interface CodeDocSettings {
    outputPath: string;
    includeComments: boolean;
    includeGitInfo: boolean;
    includeImports: boolean;
    groupByType: boolean;
    sortAlphabetically: boolean;
    excludePatterns: string[];

    // Real-time watching settings
    enableRealTimeWatch: boolean;
    defaultWatchInterval: number;
    showUpdateNotifications: boolean;
    autoInitializeWatches: boolean;
}

export const DEFAULT_SETTINGS: CodeDocSettings = {
    outputPath: 'Code Documentation.md',
    includeComments: true,
    includeGitInfo: true,
    includeImports: true,
    groupByType: true,
    sortAlphabetically: true,
    excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],

    // Real-time defaults
    enableRealTimeWatch: true,
    defaultWatchInterval: 1000,
    showUpdateNotifications: true,
    autoInitializeWatches: true,
};


export class CodeDocSettingTab extends PluginSettingTab {
    plugin: CodeDocumentationPlugin;

    constructor(app: App, plugin: CodeDocumentationPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Code Documentation Settings' });

        new Setting(containerEl)
            .setName('Output file path')
            .setDesc('Where to save the generated documentation')
            .addText(text => text
                .setPlaceholder('Code Documentation.md')
                .setValue(this.plugin.settings.outputPath)
                .onChange(async (value) => {
                    this.plugin.settings.outputPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include comments')
            .setDesc('Include code comments in the documentation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeComments)
                .onChange(async (value) => {
                    this.plugin.settings.includeComments = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include git information')
            .setDesc('Include commit history and contributors')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeGitInfo)
                .onChange(async (value) => {
                    this.plugin.settings.includeGitInfo = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include imports')
            .setDesc('List all import statements')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeImports)
                .onChange(async (value) => {
                    this.plugin.settings.includeImports = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Group by type')
            .setDesc('Group symbols by type (classes, functions, etc.)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.groupByType)
                .onChange(async (value) => {
                    this.plugin.settings.groupByType = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sort alphabetically')
            .setDesc('Sort symbols alphabetically within groups')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.sortAlphabetically)
                .onChange(async (value) => {
                    this.plugin.settings.sortAlphabetically = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Exclude patterns')
            .setDesc('Glob patterns to exclude (one per line)')
            .addTextArea(text => text
                .setPlaceholder('node_modules/**\n.git/**')
                .setValue(this.plugin.settings.excludePatterns.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludePatterns = value.split('\n').filter(p => p.trim());
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Enable real-time watching')
            .setDesc('Automatically watch code files and update documentation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableRealTimeWatch)
                .onChange(async (value) => {
                    this.plugin.settings.enableRealTimeWatch = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Watch interval (ms)')
            .setDesc('Debounce interval for file change detection')
            .addText(text => text
                .setPlaceholder('1000')
                .setValue(String(this.plugin.settings.defaultWatchInterval))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.defaultWatchInterval = num;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}