
import React, { useState, useRef } from 'react';
import { Job, UserProfile } from '../app-types';
import { generateAudioBriefing, generateInterviewQuestions } from '../services/geminiService';
import { 
    FileText, 
    Loader2, 
    Sparkles, 
    ExternalLink,
    Building2,
    MapPin,
    Volume2,
    Play,
    BrainCircuit,
    ListChecks,
    StickyNote,
    Download,
    Target,
    List
} from 'lucide-react';
import { useState } from 'react';

// Add this state at the top of component
const [isGenerating, setIsGenerating] = useState(false);

// Add these imports
import { FileText, StickyNote, CheckCircle2, ChevronDown } from 'lucide-react';
const [isGenerating, setIsGenerating] = useState(false);

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
// Add this function INSIDE the JobDetail component
const handleGenerateDocuments = async () => {
    if (!userProfile.resumeContent || userProfile.resumeContent.length < 50) {
        notify("Please upload your resume in Settings first.", "error");
        return;
    }
    
    setIsGenerating(true);
    notify(`Generating application materials for ${job.company}...`, 'success');
    
    try {
        // Call v5's gemini service (you'll need to add these functions)
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
interface JobDetailProps {
  job: Job;
  userProfile: UserProfile;
  onUpdateJob: (job: Job) => void;
  onClose: () => void;
  showNotification?: (msg: string, type: 'success' | 'error') => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, userProfile, onUpdateJob, onClose, showNotification }) => {
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isInterviewLoading, setIsInterviewLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const notify = (msg: string, type: 'success' | 'error') => {
      if (showNotification) showNotification(msg, type);
  };

  const decodeAudioData = async (base64: string): Promise<AudioBuffer> => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    const ctx = audioContextRef.current;
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const handlePlayBriefing = async () => {
    if (isAudioLoading) return;
    setIsAudioLoading(true);
    try {
        const base64 = await generateAudioBriefing(job, userProfile);
        const buffer = await decodeAudioData(base64);
        
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const source = audioContextRef.current!.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current!.destination);
        source.start(0);
        notify("Briefing sequence started.", "success");
    } catch (e) {
        console.error(e);
        notify("Audio system initialization failed.", "error");
    } finally {
        setIsAudioLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setIsInterviewLoading(true);
    try {
        const qs = await generateInterviewQuestions(job, userProfile);
        setQuestions(qs);
        notify("10 behavioral questions generated!", "success");
    } catch (e) {
        notify("Intelligence link failed.", "error");
    } finally {
        setIsInterviewLoading(false);
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
      href={job.applicationUrl}
      target="_blank"
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
      Generate Assets
    </button>
</div>

            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Preparation Lab</h3>
                    <BrainCircuit className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="space-y-4 max-h-48 overflow-y-auto custom-scrollbar pr-4">
                    {questions.length > 0 ? (
                        questions.map((q, i) => (
                            <div key={i} className="flex gap-4 items-start animate-in slide-in-from-left duration-300">
                                <span className="w-6 h-6 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 border border-slate-200">{i+1}</span>
                                <p className="text-xs font-bold text-slate-700 leading-relaxed">{q}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 font-medium italic">Generate 10 tailored interview questions for this specific role.</p>
                    )}
                </div>
                <button 
                    onClick={handleGenerateQuestions}
                    disabled={isInterviewLoading}
                    className="mt-8 w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                >
                    {isInterviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                    Generate 10 Questions
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-600" /> Match Rationale
                </h3>
                <div className="flex-1 text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100 italic">
                    {job.fitReason || "Based on your technical proficiency in " + (userProfile.preferences.targetRoles[0] || "relevant tools") + ", this role at " + job.company + " provides an ideal trajectory for your career goals."}
                </div>
            </div>
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <List className="w-5 h-5 text-indigo-600" /> Core Requirements
                </h3>
                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                    {job.requirements.length > 0 ? job.requirements.map((req, i) => (
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
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-64 overflow-y-auto font-mono text-[10px] text-slate-600 leading-relaxed">
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
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-64 overflow-y-auto font-mono text-[10px] text-slate-600 leading-relaxed">
                            {job.coverLetter}
                        </div>
                    </div>
                )}
            </div>
        )}
</div>

        {/* Resume & Letter Generation Section - ADD THIS */}
        <div className="grid grid-cols-1 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" /> Application Materials
                    </h3>
                    <button 
                        onClick={handleGenerateDocuments} 
                        disabled={isGenerating} 
                        className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-xl"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 
                        {job.customizedResume ? 'Regenerate' : 'Generate Assets'}
                    </button>
                </div>

                {(job.customizedResume || job.coverLetter) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {job.customizedResume && (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Tailored Resume</h4>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-96 overflow-y-auto flex-1">
                                    <pre className="text-xs font-mono text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                                        {job.customizedResume}
                                    </pre>
                                </div>
                            </div>
                        )}
                        {job.coverLetter && (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-4">
                                    <StickyNote className="w-5 h-5 text-purple-600" />
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Cover Letter</h4>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-96 overflow-y-auto flex-1">
                                    <pre className="text-xs font-mono text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                                        {job.coverLetter}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-xs text-slate-400 font-medium">Click "Generate Assets" to create customized resume and cover letter</p>
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Role Deep Analysis
            </h3>
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Role Deep Analysis
            </h3>
            <div className="text-slate-600 text-base leading-loose whitespace-pre-wrap font-medium">
                {job.description || "Extraction in progress..."}
            </div>
        </div>
      </div>
    </div>
  );
};
