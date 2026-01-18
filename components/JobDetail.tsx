import React, { useState } from 'react';
import { Job, UserProfile } from '../app-types';
import { 
    FileText, 
    Loader2, 
    Sparkles, 
    ExternalLink,
    Building2,
    MapPin,
    StickyNote,
    Download,
    Target,
    List
} from 'lucide-react';

interface JobDetailProps {
  job: Job;
  userProfile: UserProfile;
  onUpdateJob: (job: Job) => void;
  onClose: () => void;
  showNotification?: (msg: string, type: 'success' | 'error') => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, userProfile, onUpdateJob, showNotification }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const notify = (msg: string, type: 'success' | 'error') => {
      if (showNotification) showNotification(msg, type);
  };

  const handleGenerateDocuments = async () => {
    if (!userProfile.resumeContent || userProfile.resumeContent.length < 50) {
      notify("Please upload your resume in Settings first.", "error");
      return;
    }
    
    setIsGenerating(true);
    notify(`Generating application materials for ${job.company}...`, 'success');
    
    try {
      const response = await fetch('/api/generate-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          description: job.description,
          resume: userProfile.resumeContent,
          name: userProfile.fullName,
          email: userProfile.email
        })
      });
      
      if (!response.ok) throw new Error('Generation failed');
      
      const { resume, letter } = await response.json();
      
      const updatedJob: Job = { 
        ...job, 
        customizedResume: resume, 
        coverLetter: letter
      };
      
      await onUpdateJob(updatedJob);
      notify("Documents ready!", "success");
    } catch (e) {
      console.error("Generation failed:", e);
      notify("Generation failed. Check API key.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        
        {/* Header */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6 flex-col md:flex-row text-center md:text-left">
                <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl">
                    {job.company.charAt(0)}
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 leading-tight mb-2 tracking-tight">{job.title}</h1>
                    <div className="flex items-center gap-4 text-slate-500 justify-center md:justify-start">
                        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600 uppercase tracking-widest">
                            <Building2 className="w-4 h-4" /> {job.company}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                            <MapPin className="w-4 h-4" /> {job.location}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <a 
                href={job.applicationUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-48 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase text-center hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                  Visit Job Page <ExternalLink className="w-4 h-4" />
              </a>
              <button 
                onClick={handleGenerateDocuments} 
                disabled={isGenerating} 
                className="w-full md:w-48 bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 
                {job.customizedResume ? 'Regenerate' : 'Generate Assets'}
              </button>
            </div>
        </div>

        {/* Match Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-600" /> Match Rationale
                </h3>
                <div className="flex-1 text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100 italic">
                    {job.fitReason || `Based on your profile, this ${job.title} role at ${job.company} aligns with your career goals.`}
                </div>
            </div>
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <List className="w-5 h-5 text-indigo-600" /> Core Requirements
                </h3>
                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                    {job.requirements && job.requirements.length > 0 ? job.requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            {req}
                        </div>
                    )) : (
                        <p className="text-xs text-slate-400 italic">No specific requirements extracted.</p>
                    )}
                </div>
            </div>
        </div>

        {/* Generated Documents */}
        {(job.customizedResume || job.coverLetter) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {job.customizedResume && (
                    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600" /> Tailored Resume
                            </h3>
                            <button 
                                onClick={() => handleDownload(job.customizedResume!, `${job.company}_Resume.txt`)}
                                className="p-2 text-slate-400 hover:text-indigo-600"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-96 overflow-y-auto font-mono text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {job.customizedResume}
                        </div>
                    </div>
                )}
                {job.coverLetter && (
                    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <StickyNote className="w-5 h-5 text-purple-600" /> Cover Letter
                            </h3>
                            <button 
                                onClick={() => handleDownload(job.coverLetter!, `${job.company}_Letter.txt`)}
                                className="p-2 text-slate-400 hover:text-purple-600"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-96 overflow-y-auto font-mono text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {job.coverLetter}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Description */}
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Job Description
            </h3>
            <div className="text-slate-600 text-base leading-loose whitespace-pre-wrap font-medium">
                {job.description || "No description available."}
            </div>
        </div>
      </div>
    </div>
  );
};