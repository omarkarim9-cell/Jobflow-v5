
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
                  className="w-full md:w-48 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest text-center hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 transition-all"
                >
                    Apply on Source <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-indigo-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="flex justify-between items-start mb-8">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-60">AI Audio Briefing</h3>
                    <Volume2 className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-sm font-medium leading-relaxed mb-8 opacity-80 italic">
                    "Hi {userProfile.fullName.split(' ')[0]}, let me brief you on why this role is a great fit for your {userProfile.preferences.targetRoles[0] || 'background'}."
                </p>
                <button 
                    onClick={handlePlayBriefing}
                    disabled={isAudioLoading}
                    className="flex items-center gap-3 px-8 py-4 bg-white text-indigo-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl"
                >
                    {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Listen to Brief
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
