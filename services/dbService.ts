//dbservice.ts
import { Job, UserProfile, UserPreferences } from '../app-types';
const API_BASE = '/api';
const LOCAL_PROFILE_KEY = 'jobflow_profile_cache';
const LOCAL_JOBS_KEY = 'jobflow_jobs_cache';
const normalizePreferences = (prefs: any): UserPreferences => {
    if (!prefs) return { targetRoles: [], targetLocations: [], minSalary: '', remoteOnly: false, language: 'en' };
    return {
        targetRoles: Array.isArray(prefs.targetRoles) ? prefs.targetRoles : [],
        targetLocations: Array.isArray(prefs.targetLocations) ? prefs.targetLocations : [],
        minSalary: prefs.minSalary || '',
        remoteOnly: !!(prefs.remoteOnly || false),
        language: prefs.language || 'en'
    };
};

const normalizeProfile = (data: any): UserProfile | null => {
    if (!data) return null;
    return {
        id: data.id,
        fullName: data.fullName || '',
        email: data.email || '',
        phone: data.phone || '',
        resumeContent: data.resumeContent || '',
        resumeFileName: data.resumeFileName || '',
        preferences: normalizePreferences(data.preferences),
        onboardedAt: data.onboardedAt || new Date().toISOString(),
        connectedAccounts: data.connectedAccounts || [],
        plan: data.plan || 'free',
        subscriptionExpiry: data.subscriptionExpiry
    };
};

export const saveUserProfile = async (profile: UserProfile, clerkToken: string) => {
    const sanitized = JSON.parse(JSON.stringify(profile));
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(sanitized));

    try {
        const response = await fetch(`${API_BASE}/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clerkToken}`
            },
            body: JSON.stringify(sanitized)
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (response.status === 409 || response.status === 200) {
                return profile;
            }
            throw new Error(errData.error || 'Cloud sync failed');
        }
        
        const data = await response.json();
        const normalized = normalizeProfile(data);
        if (normalized) localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(normalized));
        return normalized || profile;
    } catch (err) {
        console.warn("[dbService] Cloud Save ignored:", err);
        return profile;
    }
};
export const getUserProfile = async (clerkToken: string): Promise<UserProfile | null> => {
    try {
        console.log("[v0] getUserProfile called");
        const response = await fetch(`${API_BASE}/profile`, {
            headers: { 'Authorization': `Bearer ${clerkToken}` }
        });
        
        console.log("[v0] API response status:", response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log("[v0] Raw API response:", data);
            console.log("[v0] resume_content from API:", data.resumeContent);
            console.log("[v0] full_name from API:", data.fullName);
            
            const profile = normalizeProfile(data);
            console.log("[v0] Normalized profile:", profile);
            
            if (profile) localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
            return profile;
        } else {
            console.log("[v0] API returned non-ok status");
            return null;
        }
    } catch (e) {
        console.log("[v0] getUserProfile error:", e);
        const cached = localStorage.getItem(LOCAL_PROFILE_KEY);
        return cached ? JSON.parse(cached) : null;
    }
};
export const fetchJobsFromDb = async (clerkToken: string): Promise<Job[]> => {
    try {
        const response = await fetch(`${API_BASE}/jobs`, {  // Changed this line
            headers: { 'Authorization': `Bearer ${clerkToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            const jobs = data.jobs || [];
            localStorage.setItem(LOCAL_JOBS_KEY, JSON.stringify(jobs));
            return jobs;
        }
        return [];
    } catch (e) {
        const cached = localStorage.getItem(LOCAL_JOBS_KEY);
        return cached ? JSON.parse(cached) : [];
    }
};

export const saveJobToDb = async (job: Job, clerkToken: string) => {
    try {
        const sanitized = JSON.parse(JSON.stringify(job));
        await fetch(`${API_BASE}/jobs`, {  // Changed this line
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clerkToken}`
            },
            body: JSON.stringify(sanitized)
        });
    } catch (e) {
        console.warn("[dbService] Job save deferred.");
    }
};

export const deleteJobFromDb = async (jobId: string, clerkToken: string) => {
    try {
        await fetch(`${API_BASE}/jobs?id=${jobId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${clerkToken}` }
        });
    } catch (e) {}
};

export const isProductionMode = () => true;
