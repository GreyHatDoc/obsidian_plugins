
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitFileInfo } from '../parsers/codeParser';

const execAsync = promisify(exec);

export class GitIntegration {
    constructor(private repoPath: string) { }

    async getFileInfo(filePath: string): Promise<GitFileInfo | null> {
        try {
            // Get last commit info
            const { stdout: logOutput } = await execAsync(
                `git log -1 --format="%H|%s|%ci|%an" -- "${filePath}"`,
                { cwd: this.repoPath }
            );

            if (!logOutput.trim()) return null;

            const [hash, message, date, author] = logOutput.trim().split('|');

            // Get total commits
            const { stdout: countOutput } = await execAsync(
                `git rev-list --count HEAD -- "${filePath}"`,
                { cwd: this.repoPath }
            );

            const totalCommits = parseInt(countOutput.trim(), 10);

            // Get all contributors
            const { stdout: contributorsOutput } = await execAsync(
                `git log --format="%an" -- "${filePath}" | sort -u`,
                { cwd: this.repoPath }
            );

            const contributors = contributorsOutput
                .trim()
                .split('\n')
                .filter(name => name.length > 0);

            return {
                lastCommit: hash,
                lastCommitMessage: message,
                lastCommitDate: new Date(date),
                totalCommits,
                contributors,
            };
        } catch (error) {
            console.error(`Error getting git info for ${filePath}:`, error);
            return null;
        }
    }

    async isGitRepo(): Promise<boolean> {
        try {
            await execAsync('git rev-parse --git-dir', { cwd: this.repoPath });
            return true;
        } catch {
            return false;
        }
    }

    async getRecentChanges(filePath: string, limit: number = 10): Promise<CommitInfo[]> {
        try {
            const { stdout } = await execAsync(
                `git log -${limit} --format="%H|%s|%ci|%an" -- "${filePath}"`,
                { cwd: this.repoPath }
            );

            return stdout
                .trim()
                .split('\n')
                .filter(line => line.length > 0)
                .map(line => {
                    const [hash, message, date, author] = line.split('|');
                    return {
                        hash,
                        message,
                        date: new Date(date),
                        author,
                    };
                });
        } catch (error) {
            console.error(`Error getting recent changes for ${filePath}:`, error);
            return [];
        }
    }
}

export interface CommitInfo {
    hash: string;
    message: string;
    date: Date;
    author: string;
}