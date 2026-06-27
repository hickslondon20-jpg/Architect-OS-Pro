import React from 'react';
import { PageHeader } from '../../components/ui';
import { CheckCircle2, Rocket, Share2, Edit3, RotateCw, Play } from 'lucide-react';

const SPRINT_GOAL = "We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.";

export const SprintLaunch: React.FC = () => {
    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            <PageHeader
                title="Sprint Launch"
                subtitle="Your team alignment document and executive summary."
            />

            {/* Top Section — Sprint Identity Bar */}
            <div className="bg-slate-900 rounded-xl p-8 text-white shadow-xl relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-10 -mt-20"></div>

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-white/10 text-white text-sm font-medium rounded-full border border-white/20">
                                Q1 2026
                            </span>
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-bold rounded-full border border-blue-500/30 uppercase tracking-wider">
                                Active Sprint
                            </span>
                        </div>
                        <div className="text-sm text-slate-400 font-medium">
                            <span className="flex items-center gap-2">
                                <RotateCw size={14} className="text-slate-500" />
                                Sprint locked on Jan 1, 2026 at 9:00 AM
                            </span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">Sprint Goal</p>
                            <h2 className="text-2xl md:text-3xl font-bold leading-tight max-w-4xl text-white">
                                {SPRINT_GOAL}
                            </h2>
                        </div>

                        <div className="pt-6 border-t border-white/10">
                            <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-2">Sprint Theme</p>
                            <p className="text-xl text-slate-300 font-serif italic max-w-3xl">
                                "Establishing the bedrock for scalable delivery."
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Primary Content — Executive Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column (Wider) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Native Narrative */}
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900 border-b-2 border-blue-600 pb-1">Executive Summary</h3>
                            <div className="flex gap-2">
                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit Summary">
                                    <Edit3 size={16} />
                                </button>
                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Regenerate Synthesis">
                                    <RotateCw size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="prose prose-slate max-w-none space-y-4">
                            <p className="text-slate-700 leading-relaxed font-medium">
                                We are entering this quarter fully stretched. Our current volume has exposed fractures in how we deliver, pulling founder attention daily into operational firefighting. This sprint is not about aggressive expansion; it's about stabilizing the floor we currently stand on so we can confidently step up in Q2.
                            </p>
                            <p className="text-slate-700 leading-relaxed">
                                Our plan focuses heavily on the Operations and Team Leadership arenas. By prioritizing the creation of a 'Client Onboarding Playbook' and finalizing our 'Standard Operating Procedures' library, we aim to remove the subjective guesswork from week-to-week delivery. We will also plant seeds for future capability by beginning the initial technical specs for our internal automation dashboard. We are pulling back marginally on aggressive new business positioning to ensure we can digest our recent wins.
                            </p>
                            <p className="text-slate-700 leading-relaxed">
                                Success this quarter looks boring in the best possible way. It looks like a quiet delivery floor, predictable margins, and founders who are managing the system, not the tasks within it. If we execute this plan, we will earn the right to scale again next quarter.
                            </p>
                        </div>
                    </div>

                    {/* Sprint Plan Summary List */}
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 border-b-2 border-slate-800 pb-1 inline-block">The 3P Execution Plan</h3>

                        <div className="space-y-8">
                            {/* Prioritize Map */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                                    <h4 className="font-bold text-slate-900 uppercase tracking-widest text-sm">Prioritize (Active Execution)</h4>
                                </div>
                                <div className="space-y-4 pl-5">
                                    <div className="border-l-2 border-blue-200 pl-4 py-1">
                                        <p className="font-semibold text-slate-800 text-sm mb-2">Operations: Process Standardization</p>
                                        <ul className="space-y-2">
                                            <li className="flex items-start gap-2 text-sm text-slate-600">
                                                <Play size={12} className="text-blue-400 mt-1 shrink-0" />
                                                <span>Finalize Standard Operating Procedure Matrix <span className="text-slate-400 italicml-1">— (S. Hicks)</span></span>
                                            </li>
                                            <li className="flex items-start gap-2 text-sm text-slate-600">
                                                <Play size={12} className="text-blue-400 mt-1 shrink-0" />
                                                <span>Implement Client Onboarding Playbook <span className="text-slate-400 italic ml-1">— (S. Hicks)</span></span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="border-l-2 border-blue-200 pl-4 py-1">
                                        <p className="font-semibold text-slate-800 text-sm mb-2">Team Leadership: Role Clarity</p>
                                        <ul className="space-y-2">
                                            <li className="flex items-start gap-2 text-sm text-slate-600">
                                                <Play size={12} className="text-blue-400 mt-1 shrink-0" />
                                                <span>Deploy updated accountability charts <span className="text-slate-400 italic ml-1">— (A. Founder)</span></span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Plant Map */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <h4 className="font-bold text-slate-900 uppercase tracking-widest text-sm">Plant (Building Foundation)</h4>
                                </div>
                                <div className="space-y-4 pl-5">
                                    <div className="border-l-2 border-emerald-200 pl-4 py-1">
                                        <p className="font-semibold text-slate-800 text-sm mb-2">Financial Stewardship</p>
                                        <ul className="space-y-2">
                                            <li className="flex items-start gap-2 text-sm text-slate-600">
                                                <Play size={12} className="text-emerald-400 mt-1 shrink-0" />
                                                <span>Draft specs for internal automation dashboard</span>
                                            </li>
                                            <li className="flex items-start gap-2 text-sm text-slate-600">
                                                <Play size={12} className="text-emerald-400 mt-1 shrink-0" />
                                                <span>Review Q2 tooling spend audit</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Progressively Iterate Map */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                    <h4 className="font-bold text-slate-900 uppercase tracking-widest text-sm">Progressively Iterate (Maintain)</h4>
                                </div>
                                <div className="space-y-4 pl-5">
                                    <div className="border-l-2 border-amber-200 pl-4 py-1">
                                        <p className="font-semibold text-slate-800 text-sm mb-2">Client Success</p>
                                        <ul className="space-y-2">
                                            <li className="flex items-start gap-2 text-sm text-slate-600">
                                                <Play size={12} className="text-amber-400 mt-1 shrink-0" />
                                                <span>Run bi-weekly account reviews</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="border-l-2 border-amber-200 pl-4 py-1">
                                        <p className="font-semibold text-slate-800 text-sm mb-2">Positioning & Go-To-Market</p>
                                        <ul className="space-y-2">
                                            <li className="flex items-start gap-2 text-sm text-slate-600">
                                                <Play size={12} className="text-amber-400 mt-1 shrink-0" />
                                                <span>Maintain reduced publishing schedule (1x week)</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Right Column (Narrower) */}
                <div className="space-y-6">

                    {/* Share Action Block */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Rocket size={24} />
                        </div>
                        <h3 className="font-bold text-blue-900 mb-2">Ready for launch?</h3>
                        <p className="text-sm text-blue-700 mb-6">Share this executive summary with your team to align on the quarter's execution plan.</p>
                        <button className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm">
                            <Share2 size={18} />
                            Share with Team
                        </button>
                    </div>

                    {/* Sprint Stats Block */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Sprint by the Numbers</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100 text-sm">
                                <span className="text-slate-500 font-medium">Total Initiatives</span>
                                <span className="font-bold text-slate-900">9</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100 text-sm">
                                <span className="text-slate-500 font-medium">Total Milestones</span>
                                <span className="font-bold text-slate-900">42</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100 text-sm">
                                <span className="text-slate-500 font-medium">Team Members</span>
                                <span className="font-bold text-slate-900">4</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Days in Sprint</span>
                                <span className="font-bold text-slate-900">84</span>
                            </div>
                        </div>
                    </div>

                    {/* Team Block */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Team Roster</h3>
                        <div className="space-y-4">
                            {[
                                { name: "Sarah Hicks", role: "CEO", count: 4, color: "bg-blue-100 text-blue-700" },
                                { name: "Marcus Webb", role: "Operations", count: 3, color: "bg-emerald-100 text-emerald-700" },
                                { name: "Elena Rostova", role: "Client Success", count: 1, color: "bg-amber-100 text-amber-700" },
                                { name: "David Kim", role: "Design", count: 1, color: "bg-purple-100 text-purple-700" }
                            ].map((member, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${member.color}`}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{member.name}</p>
                                            <p className="text-xs text-slate-500">{member.role}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                                        {member.count} init.
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Capability Score Block (Baseline) */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Baseline Capability Scores</h3>
                        <p className="text-xs text-slate-500 mb-4">Locked snapshot at sprint start.</p>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 font-medium">Operations</span>
                                <span className="text-sm font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">2.4</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 font-medium">Team Leadership</span>
                                <span className="text-sm font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">3.1</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 font-medium">Financial Stewardship</span>
                                <span className="text-sm font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">2.8</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 font-medium">Client Success</span>
                                <span className="text-sm font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">4.2</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 font-medium">Sls & Mktg Engine</span>
                                <span className="text-sm font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">3.7</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 font-medium">Positioning & GTM</span>
                                <span className="text-sm font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">3.9</span>
                            </div>
                            <div className="flex items-center justify-between opacity-50">
                                <span className="text-sm text-slate-700 font-medium">Systems Architecture</span>
                                <span className="text-sm font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">—</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
