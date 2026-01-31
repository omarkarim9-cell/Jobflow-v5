import React, { useState, useEffect, useRef } from 'react';
import {
  Job,
  JobStatus,
  EmailAccount,
  UserPreferences,
  UserProfile,
  isSubscriptionValid,
} from '../types';
import {
  Mail,
  Search,
  X,
  Loader2,
  RefreshCw,
  Calendar,
  AlertCircle,
  Settings,
  Link,
} from 'lucide-react';
import { extractJobsFromEmailHtml } from '../services/geminiService';
import { listMessages, getMessageBody, decodeEmailBody } from '../services/gmailService';
import { NotificationType } from './NotificationToast';
import { EmailConnectModal } from './EmailConnectModal';

// Helper to safely encode Unicode strings to Base64
const safeBase64 = (str: string) => {
  try {
    return btoa(str);
  } catch {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  }
};

interface InboxScannerProps {
  onImport: (jobs: Job[]) => void;
  showNotification: (msg: string, type: NotificationType) => void;
  userPreferences?: UserPreferences;
  onOpenSettings?: () => void;
  sessionAccount: EmailAccount | null;
  onConnectSession?: (account: EmailAccount) => void;
  onDisconnectSession?: () => void;
}

export const InboxScanner: React.FC<InboxScannerProps> = ({
  onImport,
  showNotification,
  userPreferences,
  onOpenSettings,
  sessionAccount,
  onConnectSession = () => {},
  onDisconnectSession = () => {},
}) => {
  const [emails, setEmails] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [progress, setProgress] = useState('');
  const [dateRange, setDateRange] = useState('3'); // default 3 days

  const isMounted = useRef(true);

  // Check valid subscription from local storage
  const isPro = () => {
    try {
      const userStr = localStorage.getItem('jobflow_user');
      if (!userStr) return false;
      const user = JSON.parse(userStr) as UserProfile;
      return isSubscriptionValid(user);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Auto-scan when date range changes - only if already connected and not busy
  useEffect(() => {
    if (
      sessionAccount &&
      sessionAccount.accessToken &&
      !isScanning &&
      !isBatchProcessing &&
      emails.length > 0
    ) {
      handleScanRealInbox();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const calculateMatch = (job: Partial<Job>): { score: number; isMatch: boolean } => {
    if (!userPreferences) return { score: 100, isMatch: true };

    const { targetRoles, targetLocations, remoteOnly } = userPreferences;
    const title = (job.title || '').toLowerCase();
    const location = (job.location || '').toLowerCase();

    let roleMatch = targetRoles.length === 0;
    let locMatch = targetLocations.length === 0;
    let score = 0;

    // Roles
    if (targetRoles.length > 0) {
      roleMatch = targetRoles.some((r) => {
        const escaped = r.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|[\\s\\W])${escaped}(?:$|[\\s\\W])`, 'i');
        return regex.test(title);
      });
      if (roleMatch) score += 50;
    } else {
      score += 50;
    }

    // Locations
    if (targetLocations.length > 0) {
      locMatch = targetLocations.some((l) => location.includes(l.toLowerCase()));
      if (locMatch) score += 50;
    } else {
      score += 50;
    }

    // Remote
    if (remoteOnly) {
      if (location.includes('remote') || title.includes('remote')) {
        score += 10;
      } else {
        locMatch = false;
      }
    }

    return { score, isMatch: roleMatch && locMatch };
  };

  const handleScanRealInbox = async () => {
    // Pro gating
    if (!isPro() && parseInt(dateRange) > 3) {
      alert(
        'Pro Plan Required: Scanning more than 3 days of emails requires a Pro subscription.'
      );
      setDateRange('3');
      return;
    }

    setTokenExpired(false);

    if (!sessionAccount || !sessionAccount.accessToken) {
      setTokenExpired(true);
      setIsConnectModalOpen(true);
      return;
    }

    if (isMounted.current) {
      showNotification(`Scanning ${sessionAccount.emailAddress}...`, 'success');
    }

    setEmails([]);
    setIsScanning(true);

    try {
      if (sessionAccount.provider === 'Gmail') {
        // Real Gmail API
        const query = `subject:(job OR jobs OR vacancy OR career OR hiring OR opportunity) newer_than:${dateRange}d`;
       const messages = await listMessages(sessionAccount.accessToken, 50, query);

		if (isMounted.current) {
		  // Ensure messages is an array
		  const messagesArray = Array.isArray(messages) ? messages : [];
		  
		  const realEmails = messagesArray.map((msg: any) => ({
            id: msg.id,
            from: 'Gmail API',
            subject: `Email ID: ${msg.id}`,
            date: 'Recent',
            read: false,
            bodySnippet: 'Ready to analyze',
            isRealGmail: true,
            accessToken: sessionAccount.accessToken,
          }));

          setEmails(realEmails);

          if (realEmails.length === 0) {
            showNotification(
              `No job emails found in the last ${dateRange} days.`,
              'error'
            );
          } else {
            await handleBatchAnalyze(realEmails);
          }
        }
      } else {
        // Non-Gmail providers: placeholder path (you can later plug IMAP here)
        showNotification(
          `${sessionAccount.provider} scanning is connected. Using generic flow.`,
          'success'
        );

        const mockEmails = [
          {
            id: 'mock-1',
            from: sessionAccount.provider,
            subject: 'Job Digest',
            date: 'Today',
            read: false,
            bodySnippet: 'Ready to analyze',
            isRealGmail: false,
            accessToken: sessionAccount.accessToken,
          },
        ];

        if (isMounted.current) {
          setEmails(mockEmails);
          await handleBatchAnalyze(mockEmails);
        }
      }
    } catch (e: any) {
      if (isMounted.current) {
        if (e?.message === 'TOKEN_EXPIRED') {
          setTokenExpired(true);
          showNotification('Session Token Expired. Please reconnect.', 'error');
        } else {
          console.error('Scan Error:', e);
          showNotification(
            `Connection Error: ${e?.message || 'Failed to fetch'}`,
            'error'
          );
        }
      }
    } finally {
      if (isMounted.current) setIsScanning(false);
    }
  };

  const handleBatchAnalyze = async (emailList = emails) => {
    if (emailList.length === 0) return;

    setIsBatchProcessing(true);

    const uniqueJobsMap = new Map<string, Partial<Job>>();
    const batchSize = 5;
    let processedCount = 0;

    try {
      for (let i = 0; i < emailList.length; i += batchSize) {
        if (!isMounted.current) return;

        const chunk = emailList.slice(i, i + batchSize);

        await Promise.all(
          chunk.map(async (email) => {
            if (!email.accessToken) return;

            try {
              const bodyData = await getMessageBody(email.accessToken, email.id);
              const htmlContent = decodeEmailBody(bodyData);

              // Use Gemini-based extraction (Option B)
              const extracted = await extractJobsFromEmailHtml(
                htmlContent,
                userPreferences?.targetRoles || []
              );

              extracted.forEach((job: any) => {
                const { score } = calculateMatch(job);

                const stableId = job.applicationUrl
                  ? safeBase64(job.applicationUrl)
                  : `job-${Date.now()}-${Math.random()}`;

                if (!uniqueJobsMap.has(stableId)) {
                  uniqueJobsMap.set(stableId, {
                    ...job,
                    id: stableId,
                    source: email.isRealGmail ? 'Gmail' : email.from,
                    matchScore: score,
                  });
                }
              });
            } catch (e: any) {
              if (e?.message === 'TOKEN_EXPIRED') {
                setTokenExpired(true);
              }
              console.error(`Error processing email ${email.id}`, e);
            }
          })
        );

        processedCount += chunk.length;
        if (isMounted.current) {
          setProgress(
            `Analyzing ${Math.min(processedCount, emailList.length)} / ${
              emailList.length
            } emails...`
          );
        }

        await new Promise((r) => setTimeout(r, 100));
      }

      if (!isMounted.current) return;

      const allJobs = Array.from(uniqueJobsMap.values()).sort(
        (a, b) => (b.matchScore || 0) - (a.matchScore || 0)
      );

      if (allJobs.length === 0) {
        showNotification('No matching jobs found in emails.', 'error');
      } else {
        const newJobs: Job[] = allJobs.map((job, index) => ({
          id: job.id || `imported-${Date.now()}-${index}`,
          title: job.title || 'Unknown Role',
          company: job.company || 'Unknown Company',
          location: job.location || 'Remote',
          salaryRange: job.salaryRange,
          description: job.description || '',
          source: (job.source as any) || 'Email',
          detectedAt: new Date().toISOString(),
          status: JobStatus.DETECTED,
          matchScore: job.matchScore || 50,
          requirements: job.requirements || [],
          applicationUrl: job.applicationUrl,
        }));

        onImport(newJobs);
      }
    } catch (e: any) {
      if (isMounted.current) {
        console.error('Batch processing error:', e);
        showNotification('Batch processing interrupted.', 'error');
      }
    } finally {
      if (isMounted.current) {
        setIsBatchProcessing(false);
        setProgress('');
      }
    }
  };

  const handleConnectSession = (account: EmailAccount) => {
    onConnectSession(account);
    setTokenExpired(false);
    showNotification(`Session started for ${account.emailAddress}`, 'success');
  };

  const handleDisconnectSession = () => {
    onDisconnectSession();
    setEmails([]);
    showNotification('Session disconnected. No data saved.', 'success');
  };

  return (
    <div className="flex h-full bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Left Panel */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50">
        {/* Session Account Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <h3 className="font-semibold text-slate-700 flex items-center mb-3">
            <Mail className="w-4 h-4 mr-2" /> Inbox Connection
          </h3>

          {!sessionAccount ? (
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="w-full flex items-center justify-center bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Link className="w-4 h-4 mr-2" /> Connect Email (Session)
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-green-800 uppercase mb-1">
                    Active Session
                  </p>
                  <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
                    {sessionAccount.emailAddress}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Token: ...{sessionAccount.accessToken?.slice(-4)}
                  </p>
                </div>
                <button
                  onClick={handleDisconnectSession}
                  className="text-slate-400 hover:text-red-500 p-1"
                  title="Disconnect Session"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-2 italic text-center">
            Tokens are stored in memory and cleared on refresh.
          </p>
        </div>

        {sessionAccount && (
          <div className="p-4 space-y-3 border-b border-slate-200">
            <div className="flex items-center space-x-2 mb-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-700 cursor-pointer"
                >
                  <option value="3">Last 3 Days</option>
                  <option value="7">Last 7 Days (Pro)</option>
                  <option value="14">Last 14 Days (Pro)</option>
                  <option value="30">Last 30 Days (Pro)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleScanRealInbox}
              disabled={isScanning || isBatchProcessing}
              className="w-full bg-white border border-indigo-200 text-indigo-700 rounded-lg p-3 flex items-center justify-center text-sm font-medium hover:bg-indigo-50 shadow-sm disabled:opacity-50"
            >
              {isScanning ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {isScanning ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>
        )}

        {tokenExpired && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-700 text-xs flex flex-col items-center text-center">
            <span className="flex items-center font-bold mb-1">
              <AlertCircle className="w-3 h-3 mr-1" /> Token Expired
            </span>
            <span className="mb-2">The session token is no longer valid.</span>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="bg-red-100 border border-red-200 px-3 py-1 rounded flex items-center hover:bg-red-200"
            >
              <Settings className="w-3 h-3 mr-1" /> Reconnect
            </button>
          </div>
        )}

        {isBatchProcessing && (
          <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
            <div className="flex justify-between text-xs text-indigo-700 font-medium mb-1">
              <span>Batch Progress</span>
              <span>{progress}</span>
            </div>
            <div className="h-1.5 bg-indigo-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 animate-pulse w-full" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          {emails.length > 0 ? (
            <div className="divide-y divide-slate-100">
              <div className="p-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide px-4">
                Scan Results
              </div>
              {emails.map((email) => (
                <div
                  key={email.id}
                  className="p-3 hover:bg-white transition-colors group px-4"
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">
                      {email.from}
                    </span>
                    <span className="text-[10px] text-slate-400">{email.date}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate group-hover:text-slate-800 transition-colors">
                    {email.subject}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-full">
              <Mail className="w-8 h-8 mb-2 opacity-20" />
              {!sessionAccount
                ? 'Connect your email to start scanning.'
                : 'Ready to scan. Click "Scan Now".'}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col bg-slate-50/50">
        <div className="flex flex-col h-full animate-in fade-in">
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            {isBatchProcessing ? (
              <Loader2 className="w-16 h-16 mb-4 text-indigo-600 animate-spin" />
            ) : (
              <Search className="w-16 h-16 mb-4 opacity-20" />
            )}
            <h3 className="text-lg font-medium text-slate-500 mb-2">
              {isBatchProcessing ? 'Analyzing content...' : 'Inbox Scanner'}
            </h3>
            <p className="text-sm opacity-60 max-w-xs text-center">
              {isBatchProcessing
                ? 'Extracting jobs from your emails...'
                : sessionAccount
                ? 'Scanner is connected and ready. Jobs found will be auto-imported to your list.'
                : 'Connect a session to scan for jobs.'}
            </p>
          </div>
        </div>
      </div>

      <EmailConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={(acc) => {
          handleConnectSession(acc);
          setIsConnectModalOpen(false);
        }}
      />
    </div>
  );
};
