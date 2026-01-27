import React, { useState, useRef } from 'react';
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
    List,
    Volume2,
    Play,
    BrainCircuit,
    ListChecks
} from 'lucide-react';

import { fetchAudioBriefing, fetchInterviewQuestions } from '../services/geminiService';


interface JobDetailProps {
  job: Job;
  userProfile: UserProfile;
  onUpdateJob: (job: Job) => void;
  onClose: () => void;
  showNotification?: (msg: string, type: 'success' | 'error') => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, userProfile, onUpdateJob, showNotification }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isInterviewLoading, setIsInterviewLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const [showDownloadMenuBottom, setShowDownloadMenuBottom] = useState(false); // ← add this

  const notify = (msg: string, type: 'success' | 'error') => {
      if (showNotification) showNotification(msg, type);
  };

  // -----------------------------
  // AUDIO DECODING HELPERS
  // -----------------------------
  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  // -----------------------------
  // PLAY AUDIO BRIEFING (ON DEMAND)
  // -----------------------------
  const handlePlayBriefing = async () => {
    if (isAudioLoading) return;
    setIsAudioLoading(true);

    try {
      const base64 = await fetchAudioBriefing(job, userProfile);
	
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const rawData = decodeBase64(base64);
      const audioBuffer = await decodeAudioData(
        rawData,
        audioContextRef.current,
        24000,
        1
      );

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();

      notify("Briefing is playing...", "success");
    } catch (e) {
      console.error(e);
      notify("Audio playback failed.", "error");
    } finally {
      setIsAudioLoading(false);
    }
  };

  // -----------------------------
  // GENERATE INTERVIEW QUESTIONS (10 QUESTIONS)
  // -----------------------------
  const handleGenerateQuestions = async () => {
    setIsInterviewLoading(true);
    try {
      const qs = await fetchInterviewQuestions(job, userProfile);
      setQuestions(qs);

      const updatedJob: Job = {
        ...job,
        interviewQuestions: qs
      };

      await onUpdateJob(updatedJob);
      notify("Practice questions generated!", "success");
    } catch (e) {
      console.error(e);
      notify("Failed to generate questions.", "error");
    } finally {
      setIsInterviewLoading(false);
    }
  };

  // -----------------------------
  // UNIFIED "GENERATE ALL ASSETS"
  // -----------------------------
 const handleGenerateDocuments = async () => {
  if (!userProfile.resumeContent || userProfile.resumeContent.length < 50) {
    notify("Please upload your resume in Settings first.", "error");
    return;
  }

  setIsGenerating(true);
  notify(`Generating application materials for ${job.company}...`, "success");

  try {
    const response = await fetch("/api/generate-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobTitle: job.title,
        company: job.company,
        description: job.description,
        resume: userProfile.resumeContent,
        name: userProfile.fullName,
        email: userProfile.email,
      }),
    });

    if (!response.ok) throw new Error("Generation failed");

    const { resume, letter } = await response.json();
    const qs = await fetchInterviewQuestions(job, userProfile);

    const updatedJob: Job = {
      ...job,
      customizedResume: resume,
      coverLetter: letter,
      interviewQuestions: qs,
    };

    await onUpdateJob(updatedJob);
    setQuestions(qs);

    notify("All AI assets are ready!", "success");
  } catch (e) {
    console.error("Generation failed:", e);
    notify("Generation failed. Check API key.", "error");
  } finally {
    setIsGenerating(false);
  }
};
 
const handleDownloadAllTxt = () => {
  try {
    // Resume
    if (job.customizedResume) {
      const blob = new Blob([job.customizedResume], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company}_Resume.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Cover Letter
    if (job.coverLetter) {
      const blob = new Blob([job.coverLetter], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company}_CoverLetter.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Interview Questions
    if (job.interviewQuestions?.length) {
      const text = job.interviewQuestions.join("\n\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company}_InterviewQuestions.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }

    showNotification("TXT files downloaded successfully!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Failed to download TXT files.", "error");
  }
};
const handleDownloadAllPdf = () => {
  try {
    // Resume
    if (job.customizedResume) {
      const doc = new jsPDF();
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(12);
      doc.text(job.customizedResume, 10, 10);
      doc.save(`${job.company}_Resume.pdf`);
    }

    // Cover Letter
    if (job.coverLetter) {
      const doc = new jsPDF();
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(12);
      doc.text(job.coverLetter, 10, 10);
      doc.save(`${job.company}_CoverLetter.pdf`);
    }

    // Interview Questions
    if (job.interviewQuestions?.length) {
      const doc = new jsPDF();
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(12);
      const text = job.interviewQuestions.join("\n\n");
      doc.text(text, 10, 10);
      doc.save(`${job.company}_InterviewQuestions.pdf`);
    }

    showNotification("PDF files downloaded successfully!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Failed to download PDF files.", "error");
  }
};
const handleDownloadAllDoc = () => {
  try {
    // Resume
    if (job.customizedResume) {
      const blob = new Blob([job.customizedResume], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company}_Resume.doc`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Cover Letter
    if (job.coverLetter) {
      const blob = new Blob([job.coverLetter], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company}_CoverLetter.doc`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Interview Questions
    if (job.interviewQuestions?.length) {
      const text = job.interviewQuestions.join("\n\n");
      const blob = new Blob([text], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company}_InterviewQuestions.doc`;
      a.click();
      URL.revokeObjectURL(url);
    }

    showNotification("DOC files downloaded successfully!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Failed to download DOC files.", "error");
  }
};
const handleDownloadZipTxt = async () => {
  try {
    const zip = new JSZip();

    // Resume
    if (job.customizedResume) {
      zip.file(`${job.company}_Resume.txt`, job.customizedResume);
    }

    // Cover Letter
    if (job.coverLetter) {
      zip.file(`${job.company}_CoverLetter.txt`, job.coverLetter);
    }

    // Interview Questions
    if (job.interviewQuestions?.length) {
      const text = job.interviewQuestions.join("\n\n");
      zip.file(`${job.company}_InterviewQuestions.txt`, text);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.company}_TXT_Files.zip`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("TXT ZIP downloaded successfully!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Failed to download TXT ZIP.", "error");
  }
};
const handleDownloadZipDoc = async () => {
  try {
    const zip = new JSZip();

    // Resume
    if (job.customizedResume) {
      zip.file(`${job.company}_Resume.doc`, job.customizedResume);
    }

    // Cover Letter
    if (job.coverLetter) {
      zip.file(`${job.company}_CoverLetter.doc`, job.coverLetter);
    }

    // Interview Questions
    if (job.interviewQuestions?.length) {
      const text = job.interviewQuestions.join("\n\n");
      zip.file(`${job.company}_InterviewQuestions.doc`, text);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.company}_DOC_Files.zip`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("DOC ZIP downloaded successfully!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Failed to download DOC ZIP.", "error");
  }
};
const handleDownloadZipPdf = async () => {
  try {
    const zip = new JSZip();

    // Resume PDF
    if (job.customizedResume) {
      const doc = new jsPDF();
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(12);
      doc.text(job.customizedResume, 10, 10);
      const pdfBlob = doc.output("blob");
      zip.file(`${job.company}_Resume.pdf`, pdfBlob);
    }

    // Cover Letter PDF
    if (job.coverLetter) {
      const doc = new jsPDF();
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(12);
      doc.text(job.coverLetter, 10, 10);
      const pdfBlob = doc.output("blob");
      zip.file(`${job.company}_CoverLetter.pdf`, pdfBlob);
    }

    // Interview Questions PDF
    if (job.interviewQuestions?.length) {
      const doc = new jsPDF();
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(12);
      const text = job.interviewQuestions.join("\n\n");
      doc.text(text, 10, 10);
      const pdfBlob = doc.output("blob");
      zip.file(`${job.company}_InterviewQuestions.pdf`, pdfBlob);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.company}_PDF_Files.zip`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("PDF ZIP downloaded successfully!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Failed to download PDF ZIP.", "error");
  }
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

              {/* Unified Generate All Assets Button */}
              <button 
                onClick={handleGenerateDocuments} 
                disabled={isGenerating} 
                className="w-full md:w-48 bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 
                {job.customizedResume ? 'Regenerate All' : 'Generate All Assets'}
              </button>
            </div>
        </div>
        {/* Intelligence Briefing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* AUDIO BRIEFING */}
          <div className="bg-indigo-900 text-white p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>

            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-70">
                Audio Briefing
              </h3>
              <Volume2 className="w-5 h-5 opacity-50" />
            </div>

            <p className="text-sm font-medium leading-relaxed mb-6 opacity-90 italic pe-8">
              "Hi {userProfile.fullName}, I've analyzed this role.  
              Let’s walk through the key points you should know..."
            </p>

            <button
              onClick={handlePlayBriefing}
              disabled={isAudioLoading}
              className="flex items-center gap-3 px-6 py-3 bg-white text-indigo-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg"
            >
              {isAudioLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              Listen to Summary
            </button>
          </div>

          {/* INTERVIEW PREP */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Interview Prep
              </h3>
              <BrainCircuit className="w-5 h-5 text-indigo-500" />
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-2">
              {questions.length > 0 ? (
                questions.map((q, i) => (
                  <div
                    key={i}
                    className="flex gap-3 items-start animate-in slide-in-from-left duration-300"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs font-medium text-slate-700 leading-tight">
                      {q}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Generate tailored interview questions for this role.
                </p>
              )}
            </div>

            <button
              onClick={handleGenerateQuestions}
              disabled={isInterviewLoading}
              className="mt-6 flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
            >
              {isInterviewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ListChecks className="w-4 h-4" />
              )}
              Generate Questions
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
                    {job.requirements && job.requirements.length > 0 ? (
                        job.requirements.map((req, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                {req}
                            </div>
                        ))
                    ) : (
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
                           <div className="relative">
						  <button
							onClick={() => setShowDownloadMenu(prev => !prev)}
							className="p-2 text-slate-400 hover:text-indigo-600"
						  >
							<Download className="w-4 h-4" />
						  </button>

						  {showDownloadMenu && (
  <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20">
    <button
      onClick={() => {
        setShowDownloadMenu(false);
        handleDownloadPdf(job.customizedResume!, `${job.company}_Resume.pdf`);
      }}
      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50"
    >
      Download PDF
    </button>

    <button
      onClick={() => {
        setShowDownloadMenu(false);
        handleDownloadDocx(job.customizedResume!, `${job.company}_Resume.docx`);
      }}
      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50"
    >
      Download DOCX
    </button>

    <button
      onClick={() => {
        setShowDownloadMenu(false);
        handleDownloadZip(job, `${job.company}_Assets.zip`);
      }}
      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50"
    >
      Download ZIP
    </button>
  </div>
)}  {/* ← closed showDownloadMenu block */}

</div> {/* ← closes the container that wraps the above section */}

<div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-96 overflow-y-auto font-mono text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
  {job.coverLetter}
</div>
</div>
)}  {/* ← closes the conditional that started earlier (keep as-is if it matches your opening) */}
</div>

{/* Description */}
<div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm">
  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
    <Sparkles className="w-5 h-5 text-indigo-600" /> Job Description
  </h3>
  <div className="text-slate-600 text-base leading-loose whitespace-pre-wrap font-medium">
    {job.description || "No description available."}
  </div>
</div>

</div>   {/* ← closes inner content container */}

{/* Bottom Download Menu */}
<div className="flex justify-center mt-12 relative">
  <button
    onClick={() => setShowDownloadMenuBottom(prev => !prev)}
    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-md"
  >
    Download Options
  </button>

  {showDownloadMenuBottom && (
    <div className="absolute bottom-[-180px] bg-white border border-slate-200 rounded-xl shadow-xl w-56 z-30">
      <button
        onClick={() => {
          setShowDownloadMenuBottom(false);
          handleDownloadAllPdf();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
      >
        Download (PDF)
      </button>

      <button
        onClick={() => {
          setShowDownloadMenuBottom(false);
          handleDownloadAllDoc();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
      >
        Download (DOC)
      </button>

      <button
        onClick={() => {
          setShowDownloadMenuBottom(false);
          handleDownloadAllTxt();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
      >
        Download (TXT)
      </button>

      <div className="border-t border-slate-200 my-1"></div>

      <button
        onClick={() => {
          setShowDownloadMenuBottom(false);
          handleDownloadZipPdf();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
      >
        Download ZIP (PDF)
      </button>

      <button
        onClick={() => {
          setShowDownloadMenuBottom(false);
          handleDownloadZipDoc();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
      >
        Download ZIP (DOC)
      </button>

      <button
        onClick={() => {
          setShowDownloadMenuBottom(false);
          handleDownloadZipTxt();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
      >
        Download ZIP (TXT)
      </button>
    </div>
  )}
</div>   {/* ← closes outer page wrapper */}

);
};

