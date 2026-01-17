import { Job, UserProfile } from '../app-types';

export interface GitHubSyncResult {
    success: boolean;
    message: string;
}

const commitFile = async (token: string, repo: string, path: string, content: string): Promise<void> => {
    // Use TextEncoder for robust UTF-8 handling
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    let binary = "";
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(data[i]);
    }
    const encodedContent = btoa(binary);
    
    let sha: string | undefined;
    try {
        const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
        }
    } catch (e) {}

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `JobFlow AI Auto-Sync: ${new Date().toLocaleString()}`,
            content: encodedContent,
            sha: sha
        })
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to sync ${path}`);
    }
};

export const syncJobsToGithub = async (token: string, repo: string, jobs: Job[]): Promise<GitHubSyncResult> => {
    try {
        if (!token || !repo) throw new Error("GitHub credentials missing.");
        const jobsPath = 'data/jobs_backup.json';
        await commitFile(token, repo, jobsPath, JSON.stringify(jobs, null, 2));
        return { success: true, message: "Jobs backed up to GitHub." };
    } catch (e: any) {
        return { success: false, message: e.message || "GitHub Sync Failed" };
    }
};

export const verifyGithubRepo = async (token: string, repo: string): Promise<boolean> => {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        return res.ok;
    } catch (e) {
        return false;
    }
};