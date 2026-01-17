import React, { useState, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Job, JobStatus, UserProfile } from '../app-types';
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
    X
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
        
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current!.destination);
        source.start();
        notify("Briefing is playing...", "success");
    } catch (e) {
        notify("Audio briefing failed to load.", "error");
    } finally {
        setIsAudioLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setIsInterviewLoading(true);
    try {
        const qs = await generateInterviewQuestions(job, userProfile);
        setQuestions(qs);
        notify("Interview prep questions generated!", "success");
    } catch (e) {
        notify("Failed to generate questions.", "error");
    } finally {
        setIsInterviewLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-10 flex justify-between items-center">
         <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <X className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-slate-400">/ {job.company}</span>
         </div>
      </div>

      <div className="p-8 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6 flex-col md:flex-row">
                <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg">
                    {job.company.charAt(0)}
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 leading-tight mb-2">{job.title}</h1>
                    <div className="flex items-center gap-4 text-slate-500">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase">
                            <Building2 className="w-4 h-4" /> {job.company}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium">
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
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-60">AI Intelligence</h3>
                    <Volume2 className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-sm font-medium leading-relaxed mb-6 opacity-80 italic">
                    "Hi ${userProfile.fullName.split(' ')[0]}, I've analyzed this role. It matches your background perfectly. Let's listen to the brief."
                </p>
                <button 
                    onClick={handlePlayBriefing}
                    disabled={isAudioLoading}
                    className="flex items-center gap-3 px-6 py-3 bg-white text-indigo-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg"
                >
                    {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Play Audio Brief
                </button>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Mock Interview</h3>
                    <BrainCircuit className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="space-y-4">
                    {questions.length > 0 ? (
                        questions.map((q, i) => (
                            <div key={i} className="flex gap-3 items-start animate-in slide-in-from-left duration-300">
                                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">{i+1}</span>
                                <p className="text-xs font-medium text-slate-600 leading-tight">{q}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 italic">Generate practice questions tailored to this role and your background.</p>
                    )}
                </div>
                <button 
                    onClick={handleGenerateQuestions}
                    disabled={isInterviewLoading}
                    className="mt-6 flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                    {isInterviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                    Analyze Prep
                </button>
            </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8">Role Insights</h3>
            <div className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap font-medium">
                {job.description || "Extracting detailed role requirements..."}
            </div>
        </div>
      </div>
    </div>
  );
};