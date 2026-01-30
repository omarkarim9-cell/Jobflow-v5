// components/JobDetail.tsx
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

import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { Document as DocxDocument, Packer, Paragraph, TextRun } from 'docx';

import { fetchAudioBriefing, fetchInterviewQuestions } from '../services/geminiService';

interface JobDetailProps {
  job: Job;
  userProfile: UserProfile;
  onUpdateJob: (job: Job) => Promise<void> | void;
  onClose?: () => void;
  showNotification?: (msg: string, type: 'success' | 'error') => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, userProfile, onUpdateJob, showNotification }) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [isInterviewLoading, setIsInterviewLoading] = useState<boolean>(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
  const [showDownloadMenuBottom, setShowDownloadMenuBottom] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (showNotification) showNotification(msg, type);
    else console[type === 'error' ? 'error' : 'log'](msg);
  };

  // -----------------------------
  // AUDIO HELPERS
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
    // Interpret as 16-bit PCM
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

  const handlePlayBriefing = async () => {
    if (isAudioLoading) return;
    setIsAudioLoading(true);

    try {
      const base64 = await fetchAudioBriefing(job, userProfile);
      if (!base64) {
        notify('No audio returned from service.', 'error');
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const rawData = decodeBase64(base64);
      const audioBuffer = await decodeAudioData(rawData, audioContextRef.current, 24000, 1);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();

      notify('Briefing is playing...', 'success');
    } catch (e) {
      console.error(e);
      notify('Audio playback failed.', 'error');
    } finally {
      setIsAudioLoading(false);
    }
  };

  // -----------------------------
  // INTERVIEW QUESTIONS
  // -----------------------------
  const handleGenerateQuestions = async () => {
    if (isInterviewLoading) return;
    setIsInterviewLoading(true);
    try {
      const qs = await fetchInterviewQuestions(job, userProfile);
      if (qs && Array.isArray(qs)) {
        setQuestions(qs);
        const updatedJob: Job = {
          ...job,
          interviewQuestions: qs
        };
        await onUpdateJob(updatedJob);
        notify('Practice questions generated!', 'success');
      } else {
        notify('No questions returned.', 'error');
      }
    } catch (e) {
      console.error(e);
      notify('Failed to generate questions.', 'error');
    } finally {
      setIsInterviewLoading(false);
    }
  };

  // -----------------------------
  // GENERATE ALL ASSETS
  // -----------------------------
  const handleGenerateDocuments = async () => {
    if (!userProfile.resumeContent || userProfile.resumeContent.length < 50) {
      notify('Please upload your resume in Settings first.', 'error');
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
          email: (userProfile as any).email
        })
      });

      if (!response.ok) throw new Error('Generation failed');

      const { resume, letter } = await response.json();

      const qs = await fetchInterviewQuestions(job, userProfile);

      const updatedJob: Job = {
        ...job,
        customizedResume: resume,
        coverLetter: letter,
        interviewQuestions: qs
      };

      await onUpdateJob(updatedJob);
      setQuestions(qs || []);
      notify('All AI assets are ready!', 'success');
    } catch (e) {
      console.error('Generation failed:', e);
      notify('Generation failed. Check API key.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // -----------------------------
  // DOWNLOAD HELPERS
  // -----------------------------
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadText = (content?: string | null, filename?: string) => {
    if (!content) {
      notify('No content to download.', 'error');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, filename ?? 'document.txt');
    notify(`Downloaded ${filename ?? 'document.txt'}`, 'success');
  };

  const handleDownload = (content?: string | null, filename?: string) => {
    // Backwards-compatible alias used in original file
    handleDownloadText(content, filename);
  };

  // PDF creation (returns blob)
  const createPdfBlob = async (text?: string | null): Promise<Blob | null> => {
    if (!text) return null;
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 40;
      const maxLineWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const lineHeight = 14;
      const lines = doc.splitTextToSize(text, maxLineWidth);

      let cursorY = margin;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);

      lines.forEach((line: string) => {
        if (cursorY + lineHeight > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          cursorY = margin;
        }
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      });

      return doc.output('blob');
    } catch (err) {
      console.error('createPdfBlob error', err);
      return null;
    }
  };

  // DOCX creation (returns blob)
  const createDocxBlob = async (text?: string | null): Promise<Blob | null> => {
    if (!text) return null;
    try {
      const paragraphs = text.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun({ text: line })] }));
      const doc = new DocxDocument({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      return blob;
    } catch (err) {
      console.error('createDocxBlob error', err);
      return null;
    }
  };

  // Single-file PDF download
  const handleDownloadPdf = async (content?: string | null, filename?: string) => {
    if (!content) {
      notify('No content to export as PDF.', 'error');
      return;
    }
    try {
      const blob = await createPdfBlob(content);
      if (blob) {
        downloadBlob(blob, filename ?? 'document.pdf');
        notify(`Downloaded ${filename ?? 'document.pdf'}`, 'success');
      } else {
        notify('PDF creation failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('PDF export failed.', 'error');
    }
  };

  // Single-file DOCX download
  const handleDownloadDocx = async (content?: string | null, filename?: string) => {
    if (!content) {
      notify('No content to export as DOCX.', 'error');
      return;
    }
    try {
      const blob = await createDocxBlob(content);
      if (blob) {
        downloadBlob(blob, filename ?? 'document.docx');
        notify(`Downloaded ${filename ?? 'document.docx'}`, 'success');
      } else {
        notify('DOCX creation failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('DOCX export failed.', 'error');
    }
  };

  // ZIP creation bundling resume/cover letter in multiple formats
  const handleDownloadZip = async (jobToZip?: Job, filename?: string) => {
    try {
      const zip = new JSZip();

      if (jobToZip?.customizedResume) {
        zip.file(`${jobToZip.company}_Resume.txt`, jobToZip.customizedResume);
        const pdfBlob = await createPdfBlob(jobToZip.customizedResume);
        if (pdfBlob) zip.file(`${jobToZip.company}_Resume.pdf`, pdfBlob);
        const docxBlob = await createDocxBlob(jobToZip.customizedResume);
        if (docxBlob) zip.file(`${jobToZip.company}_Resume.docx`, docxBlob);
      }

      if (jobToZip?.coverLetter) {
        zip.file(`${jobToZip.company}_CoverLetter.txt`, jobToZip.coverLetter);
        const pdfBlob = await createPdfBlob(jobToZip.coverLetter);
        if (pdfBlob) zip.file(`${jobToZip.company}_CoverLetter.pdf`, pdfBlob);
        const docxBlob = await createDocxBlob(jobToZip.coverLetter);
        if (docxBlob) zip.file(`${jobToZip.company}_CoverLetter.docx`, docxBlob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, filename ?? `${jobToZip?.company ?? 'assets'}_assets.zip`);
      notify(`Downloaded ${filename ?? `${jobToZip?.company ?? 'assets'}_assets.zip`}`, 'success');
    } catch (err) {
      console.error('ZIP creation failed', err);
      notify('ZIP creation failed.', 'error');
    }
  };

  // Bulk helpers used by bottom menu
  const handleDownloadAllPdf = async () => {
    try {
      const zip = new JSZip();
      if (job.customizedResume) {
        const b = await createPdfBlob(job.customizedResume);
        if (b) zip.file(`${job.company}_Resume.pdf`, b);
      }
      if (job.coverLetter) {
        const b = await createPdfBlob(job.coverLetter);
        if (b) zip.file(`${job.company}_CoverLetter.pdf`, b);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${job.company}_PDFs.zip`);
      notify('Downloaded PDFs ZIP', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to download PDFs ZIP', 'error');
    }
  };

  const handleDownloadAllDoc = async () => {
    try {
      const zip = new JSZip();
      if (job.customizedResume) {
        const b = await createDocxBlob(job.customizedResume);
        if (b) zip.file(`${job.company}_Resume.docx`, b);
      }
      if (job.coverLetter) {
        const b = await createDocxBlob(job.coverLetter);
        if (b) zip.file(`${job.company}_CoverLetter.docx`, b);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${job.company}_DOCX.zip`);
      notify('Downloaded DOCX ZIP', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to download DOCX ZIP', 'error');
    }
  };

  const handleDownloadAllTxt = async () => {
    try {
      const zip = new JSZip();
      if (job.customizedResume) zip.file(`${job.company}_Resume.txt`, job.customizedResume);
      if (job.coverLetter) zip.file(`${job.company}_CoverLetter.txt`, job.coverLetter ?? '');
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${job.company}_TXT.zip`);
      notify('Downloaded TXT ZIP', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to download TXT ZIP', 'error');
    }
  };

  const handleDownloadZipPdf = async () => {
    await handleDownloadAllPdf();
  };
  const handleDownloadZipDoc = async () => {
    await handleDownloadAllDoc();
  };
  const handleDownloadZipTxt = async () => {
    await handleDownloadAllTxt();
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        {/* Header */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6 flex-col md:flex-row text-center md:text-left">
            <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl">
              {job.company?.charAt(0) ?? '?'}
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
              {job.customizedResume ? 'Regenerate All' : 'Write Tailored Resume & Letter'}
            </button>
          </div>
        </div>

        {/* Intelligence Briefing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* AUDIO BRIEFING */}
          <div className="bg-indigo-900 text-white p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />

            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Audio Briefing</h3>
              <Volume2 className="w-5 h-5 opacity-50" />
            </div>

            <p className="text-sm font-medium leading-relaxed mb-6 opacity-90 italic pe-8">
              "Hi {userProfile.fullName}, I've analyzed this role. Let’s walk through the key points you should know..."
            </p>

            <button
              onClick={handlePlayBriefing}
              disabled={isAudioLoading}
              className="flex items-center gap-3 px-6 py-3 bg-white text-indigo-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg"
            >
              {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              Listen to Summary
            </button>
          </div>

          {/* INTERVIEW PREP */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Interview Prep</h3>
              <BrainCircuit className="w-5 h-5 text-indigo-500" />
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-2">
              {questions.length > 0 ? (
                questions.map((q: string, i: number) => (
                  <div
                    key={i}
                    className="flex gap-3 items-start animate-in slide-in-from-left duration-300"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs font-medium text-slate-700 leading-tight">{q}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">Generate tailored interview questions for this role.</p>
              )}
            </div>

            <button
              onClick={handleGenerateQuestions}
              disabled={isInterviewLoading}
              className="mt-6 flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
            >
              {isInterviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
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
                job.requirements!.map((req: string, i: number) => (
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
                  <button onClick={() => handleDownload(job.customizedResume!, `${job.company}_Resume.txt`)} className="p-2 text-slate-400 hover:text-indigo-600">
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

                  <div className="flex items-center gap-3">
                    <button onClick={() => handleDownload(job.coverLetter!, `${job.company}_Letter.txt`)} className="p-2 text-slate-400 hover:text-purple-600">
                      <Download className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button onClick={() => setShowDownloadMenu((prev: boolean) => !prev)} className="px-3 py-2 bg-slate-100 rounded-md text-xs">
                        Options
                      </button>

                      {showDownloadMenu && (
                        <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20">
                          <button
                            onClick={() => {
                              setShowDownloadMenu(false);
                              handleDownloadPdf(job.customizedResume, `${job.company}_Resume.pdf`);
                            }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50"
                          >
                            Download PDF
                          </button>

                          <button
                            onClick={() => {
                              setShowDownloadMenu(false);
                              handleDownloadDocx(job.customizedResume, `${job.company}_Resume.docx`);
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
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-96 overflow-y-auto font-mono text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {job.coverLetter}
                </div>

                <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm mt-6">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-600" /> Job Description
                  </h3>
                  <div className="text-slate-600 text-base leading-loose whitespace-pre-wrap font-medium">
                    {job.description || 'No description available.'}
                  </div>
                </div>

                {/* Bottom Download Menu (single instance) */}
                <div className="flex justify-center mt-12 relative">
                  <button
                    onClick={() => setShowDownloadMenuBottom((prev: boolean) => !prev)}
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

                      <div className="border-t border-slate-200 my-1" />

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
            {job.description || 'No description available.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
