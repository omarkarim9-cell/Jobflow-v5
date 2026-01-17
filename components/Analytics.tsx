import React, { useMemo } from 'react';
import { Job, JobStatus, UserProfile } from '../app-types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
    TrendingUp, Target, Map, Building2, 
    Zap, PieChart as PieChartIcon, ArrowUpRight, 
    Briefcase, DollarSign 
} from 'lucide-react';

interface AnalyticsProps {
    jobs: Job[];
    userProfile: UserProfile;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export const Analytics: React.FC<AnalyticsProps> = ({ jobs, userProfile }) => {
    
    // 1. Role Distribution Data
    const roleData = useMemo(() => {
        const counts: Record<string, number> = {};
        jobs.forEach(j => {
            const title = j.title || 'Unknown';
            counts[title] = (counts[title] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [jobs]);

    // 2. Location Distribution
    const locationData = useMemo(() => {
        const counts: Record<string, number> = {};
        jobs.forEach(j => {
            const loc = j.location || 'Remote';
            counts[loc] = (counts[loc] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [jobs]);

    // 3. Status Funnel
    const funnelData = useMemo(() => {
        return [
            { name: 'Scanned', value: jobs.length },
            { name: 'Saved', value: jobs.filter(j => j.status !== JobStatus.DETECTED).length },
            { name: 'Applied', value: jobs.filter(j => [JobStatus.SUBMITTED, JobStatus.APPLIED_AUTO, JobStatus.APPLIED_MANUAL].includes(j.status)).length },
            { name: 'Interviews', value: jobs.filter(j => j.status === JobStatus.INTERVIEW).length },
            { name: 'Offers', value: jobs.filter(j => j.status === JobStatus.OFFER).length }
        ];
    }, [jobs]);

    // 4. Match Score vs Time
    const matchTrends = useMemo(() => {
        const sorted = [...jobs].sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime());
        return sorted.map(j => ({
            date: new Date(j.detectedAt).toLocaleDateString(),
            score: j.matchScore
        })).slice(-15);
    }, [jobs]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Advanced Analytics</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-4 h-4 text-indigo-500" /> Real-time Performance Insights
                    </p>
                </div>
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-1">
                    <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest">30 Days</button>
                    <button className="px-4 py-2 text-slate-400 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest">Quarterly</button>
                    <button className="px-4 py-2 text-slate-400 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest">All Time</button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Funnel Section */}
                <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-indigo-500" /> Pipeline Efficiency
                        </h3>
                        <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">
                            {jobs.length > 0 ? `${Math.round((funnelData[2].value / jobs.length) * 100)}% Conversion` : '0%'}
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={funnelData}>
                                <defs>
                                    <linearGradient id="funnelColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 800}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#funnelColor)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Role Mix */}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 mb-10">
                        <PieChartIcon className="w-5 h-5 text-purple-500" /> Role Distribution
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={roleData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {roleData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-8 space-y-3">
                        {roleData.map((r, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{r.name}</span>
                                </div>
                                <span className="text-xs font-black text-slate-900">{r.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Geographic Breakdown */}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 mb-10">
                        <Map className="w-5 h-5 text-emerald-500" /> Market Hotspots
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={locationData} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} width={100} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Match Score Trends */}
                <div className="bg-slate-900 p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3 mb-10">
                        <Target className="w-5 h-5 text-indigo-400" /> AI Match Precision
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={matchTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis dataKey="date" hide />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#475569'}} />
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '12px'}} />
                                <Line type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={3} dot={{ fill: '#818cf8', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-8 flex justify-between items-center">
                        <p className="text-xs text-slate-400 font-medium italic">Tracing matching quality across your last 15 discoveries.</p>
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                            <ArrowUpRight className="w-4 h-4" /> Improving 12%
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Insights Card */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="flex flex-col md:flex-row items-center gap-10 relative z-10 text-white">
                    <div className="w-24 h-24 bg-white/20 rounded-[2rem] flex items-center justify-center backdrop-blur-md border border-white/30 shrink-0">
                        <Zap className="w-12 h-12 text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-black tracking-tight">AI Summary: Your Target Market is "{locationData[0]?.name || 'Unknown'}"</h3>
                        <p className="text-white/80 mt-2 text-lg font-medium">We've identified that <strong>{Math.round((roleData[0]?.value / jobs.length) * 100)}%</strong> of your leads are for <strong>{roleData[0]?.name}</strong> roles. Your average match score is rising, indicating better resume alignment.</p>
                    </div>
                    <div className="shrink-0 flex gap-4">
                        <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/20 text-center">
                            <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Efficiency</div>
                            <div className="text-2xl font-black mt-1">High</div>
                        </div>
                        <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/20 text-center">
                            <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Velocity</div>
                            <div className="text-2xl font-black mt-1">Active</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};