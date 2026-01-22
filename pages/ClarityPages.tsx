import React, { useState } from 'react';
import { 
  Card, 
  PlaceholderContent, 
  Button, 
  Select, 
  Label, 
  Accordion, 
  SegmentedControl,
  Badge
} from '../components/ui';
import { Camera, MapPin, Zap, AlertTriangle, ArrowRight, BarChart3, Check, GripVertical } from 'lucide-react';

// --- Shared Components for Clarity Section ---

const SidebarCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
    <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">{title}</h3>
    {children}
  </div>
);

// --- Tab 1: Strategic Synthesis ---

export const StrategicSynthesis: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Strategic Synthesis</h2>
        <p className="text-lg text-slate-600 mt-2">Understanding the complete picture</p>
        <p className="text-base text-slate-500 mt-4 max-w-3xl">
          This synthesis weaves together everything you've shared about where you are, where you're headed, 
          and what you're optimizing for. It surfaces natural tensions and structural pressures—not as 
          problems to fix, but as design constraints to understand before you plan.
        </p>
      </div>

      {/* A. Current Operating Picture */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Camera className="h-5 w-5 text-slate-600" />
          <h3 className="text-xl font-semibold text-slate-900">Your Current Operating Picture</h3>
        </div>
        <Card className="p-8">
           <PlaceholderContent text="Complete your Agency Snapshot to see your current-state summary here." />
        </Card>
      </section>

      {/* B. Declared Direction */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-slate-600" />
          <h3 className="text-xl font-semibold text-slate-900">Declared Direction</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 h-48 flex flex-col items-center justify-center text-center">
              <h4 className="font-semibold text-slate-900 mb-2">12-Month Reality</h4>
              <p className="text-sm text-slate-500">Complete your 12-month vision to see near-term direction here.</p>
           </Card>
           <Card className="p-6 h-48 flex flex-col items-center justify-center text-center">
              <h4 className="font-semibold text-slate-900 mb-2">18-36 Month Reality</h4>
              <p className="text-sm text-slate-500">Complete your mid-term vision to see transitional state here.</p>
           </Card>
           <Card className="p-6 h-48 flex flex-col items-center justify-center text-center">
              <h4 className="font-semibold text-slate-900 mb-2">3-5 Year Reality</h4>
              <p className="text-sm text-slate-500">Complete your long-term vision to see destination state here.</p>
           </Card>
        </div>
      </section>

      {/* C. Emergent Tension */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-slate-600" />
          <h3 className="text-xl font-semibold text-slate-900">Emergent Tension</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6 max-w-3xl">
          When current reality and future direction are viewed together, certain points of tension naturally emerge. 
          These aren't signals of misalignment—they're signs of transition.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 min-h-[160px]">
              <h4 className="font-medium text-slate-900 mb-2">Role Transition</h4>
              <PlaceholderContent text="Analysis Pending" />
           </Card>
           <Card className="p-6 min-h-[160px]">
              <h4 className="font-medium text-slate-900 mb-2">Structural Evolution</h4>
              <PlaceholderContent text="Analysis Pending" />
           </Card>
           <Card className="p-6 min-h-[160px]">
              <h4 className="font-medium text-slate-900 mb-2">Pace & Capacity</h4>
              <PlaceholderContent text="Analysis Pending" />
           </Card>
        </div>
      </section>

      {/* D. Structural Pressure */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-slate-600" />
          <h3 className="text-xl font-semibold text-slate-900">Structural Pressure</h3>
        </div>
        <Card className="p-8">
           <PlaceholderContent text="Attach growth scenarios to your vision horizons to see structural pressure analysis." />
        </Card>
      </section>

      {/* E. Why This Matters */}
      <div className="bg-slate-900 rounded-lg p-8 text-slate-300">
         <h3 className="text-lg font-bold text-white mb-4">Why This Matters</h3>
         <p className="mb-4">
           Nothing you're seeing here is a warning. It's a description of what growth asks for when it's taken seriously.
           Growth always creates constraints. Pressure isn't a sign of being unready—it's a sign of ambition meeting reality.
         </p>
         <p>
           The difference between frustration and progress often comes down to seeing these tensions clearly before you try to act on them.
           Clarity doesn't force a decision. It simply gives you more control over the ones you'll eventually make.
         </p>
      </div>

      {/* G. Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 border-t border-slate-200">
         <Button variant="outline">Export Synthesis PDF</Button>
         <Button variant="secondary">Proceed to Action Items <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );
};

// --- Tab 2: Vision State ---

interface VisionSectionProps {
  id: string;
  title: string;
  subtitle: string;
  status: 'not-started' | 'in-progress' | 'complete';
  isUltimate?: boolean;
}

const VisionForm: React.FC<{ isUltimate?: boolean; mode?: 'simplified' | 'advanced' }> = ({ isUltimate, mode }) => {
  const [selectedScenario, setSelectedScenario] = useState<string>("");

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {mode === 'advanced' && !isUltimate && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
           <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900">Attach Growth Scenario (Optional)</h3>
           </div>
           <p className="text-sm text-slate-500 mb-4">Ground your vision in real targets by linking a saved growth scenario.</p>
           
           <div className="max-w-md">
             <Label>Select Scenario</Label>
             <Select value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value)}>
               <option value="" disabled>Choose a scenario...</option>
               <option value="aggressive">Aggressive Growth - 12M</option>
               <option value="steady">Steady Scale - 12M</option>
               <option value="conservative">Conservative Path - 12M</option>
             </Select>
           </div>

           {selectedScenario && (
             <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4 max-w-md">
                <div className="flex justify-between items-start mb-4">
                   <h4 className="font-semibold text-slate-900">Aggressive Growth - 12M</h4>
                   <Badge color="green">Attached</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                   <div>
                     <span className="text-slate-500 block">Revenue</span>
                     <span className="font-medium text-slate-900">$3.5M</span>
                   </div>
                   <div>
                     <span className="text-slate-500 block">Team</span>
                     <span className="font-medium text-slate-900">18 FTEs</span>
                   </div>
                   <div>
                     <span className="text-slate-500 block">MRR</span>
                     <span className="font-medium text-slate-900">$200K</span>
                   </div>
                   <div>
                     <span className="text-slate-500 block">Investment</span>
                     <span className="font-medium text-slate-900">$150K</span>
                   </div>
                </div>
                <Button variant="ghost" className="w-full text-xs">Edit Scenario in GV Calculator <ArrowRight className="h-3 w-3 ml-1" /></Button>
             </div>
           )}
        </div>
      )}

      {!isUltimate ? (
        <>
          {/* 1. Financial Reality */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">💰 Financial Reality</h3>
            <p className="text-sm text-slate-500 mb-4">How does the economic shape of the business change?</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Profit Posture</Label>
                <Select defaultValue="">
                  <option value="" disabled>Select...</option>
                  <option value="reinvest">Reinvesting aggressively for growth</option>
                  <option value="balanced">Balanced approach</option>
                  <option value="protect">Protecting profitability</option>
                  <option value="maximize">Maximizing profit margin</option>
                </Select>
              </div>
              <div>
                <Label>Cash Discipline</Label>
                <Select defaultValue="">
                  <option value="" disabled>Select...</option>
                  <option value="tight">Tight control (minimal buffer)</option>
                  <option value="comfortable">Comfortable buffer (3-6m)</option>
                  <option value="strong">Strong reserves (6-12m)</option>
                  <option value="leverage">Growth-first (leverage credit)</option>
                </Select>
              </div>
            </div>
          </div>

          {/* 2. Clients & Market Reality */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">🎯 Clients & Market Reality</h3>
            <p className="text-sm text-slate-500 mb-4">How does your client relationship and market positioning evolve?</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="md:col-span-2">
                <Label>Client Quality Bar</Label>
                <Select defaultValue="">
                  <option value="" disabled>Select...</option>
                  <option value="raising">Raising standards (more selective)</option>
                  <option value="maintaining">Maintaining current standards</option>
                  <option value="opportunistic">Opportunistic (taking what comes)</option>
                </Select>
              </div>
              <div>
                <Label>Service Focus</Label>
                <Select defaultValue="">
                  <option value="" disabled>Select...</option>
                  <option value="deepening">Deepening specialization</option>
                  <option value="maintaining">Maintaining current portfolio</option>
                  <option value="expanding">Expanding portfolio</option>
                </Select>
              </div>
              <div>
                <Label>Market Positioning</Label>
                <Select defaultValue="">
                  <option value="" disabled>Select...</option>
                  <option value="premium">Premium/high-touch</option>
                  <option value="scalable">Scalable/efficient</option>
                  <option value="hybrid">Hybrid</option>
                </Select>
              </div>
            </div>
          </div>

          {/* 3. Operations & Systems Reality */}
          <div>
             <h3 className="text-lg font-semibold text-slate-900 mb-2">⚙️ Operations & Systems Reality</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                   <Label>Delivery Consistency</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="adhoc">Ad hoc (custom every time)</option>
                     <option value="repeatable">Repeatable (documented)</option>
                     <option value="systematized">Systematized (automated)</option>
                   </Select>
                </div>
                <div>
                   <Label>Process Maturity</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="informal">Informal (in heads)</option>
                     <option value="documented">Documented (SOPs)</option>
                     <option value="integrated">Integrated systems</option>
                   </Select>
                </div>
             </div>
          </div>

           {/* 4. Team & Leadership Reality */}
           <div>
             <h3 className="text-lg font-semibold text-slate-900 mb-2">👥 Team & Leadership Reality</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                   <Label>Team Structure</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="flat">Flat/generalist</option>
                     <option value="specialized">Role-specialized</option>
                     <option value="layered">Multi-layered</option>
                   </Select>
                </div>
                <div>
                   <Label>Leadership Layer</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="founder">Founder-led</option>
                     <option value="manager">Manager layer emerging</option>
                     <option value="distributed">Distributed leadership</option>
                   </Select>
                </div>
             </div>
          </div>

          {/* 5. Founder Role */}
           <div>
             <h3 className="text-lg font-semibold text-slate-900 mb-2">🧭 Founder Role & Stewardship Reality</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                   <Label>Founder Involvement</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="executor">Hands-on executor</option>
                     <option value="coordinator">Manager/coordinator</option>
                     <option value="strategic">Strategic oversight</option>
                     <option value="board">Board-level</option>
                   </Select>
                </div>
                <div>
                   <Label>Time Allocation</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="delivery">Client delivery work</option>
                     <option value="management">Team coordination</option>
                     <option value="strategy">Strategic planning</option>
                     <option value="systems">Systems building</option>
                   </Select>
                </div>
             </div>
          </div>
        </>
      ) : (
        // Ultimate Vision Questions
        <>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🌟 Ultimate Strategic Posture</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                   <Label>Long-Term Orientation</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="indefinite">Building to operate indefinitely</option>
                     <option value="exit">Building toward eventual transition/exit</option>
                     <option value="flexible">Flexible—depends on opportunities</option>
                   </Select>
                </div>
                <div>
                   <Label>Ownership Continuity</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="retain">Retaining ownership long-term</option>
                     <option value="partial">Open to partial stake sale</option>
                     <option value="full">Planning eventual full exit</option>
                   </Select>
                </div>
                <div>
                   <Label>Longevity Posture</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="lasting">Building something lasting (10+ yrs)</option>
                     <option value="transition">Building toward transition (5-7 yrs)</option>
                     <option value="short">Short-term opportunity (2-3 yrs)</option>
                   </Select>
                </div>
                <div className="md:col-span-2">
                   <Label>Role of Business in Your Life</Label>
                   <Select defaultValue="">
                     <option value="" disabled>Select...</option>
                     <option value="primary">Primary professional identity</option>
                     <option value="portfolio">One of several ventures</option>
                     <option value="legacy">Legacy/long-term stewardship</option>
                   </Select>
                </div>
             </div>
          </div>
        </>
      )}

      <div className="pt-6 border-t border-slate-200">
         <Button variant="secondary" className="w-full sm:w-auto">Save Vision</Button>
      </div>
    </div>
  );
};

export const VisionState: React.FC = () => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>("12m");
  const [modes, setModes] = useState<Record<string, string>>({
    "12m": "simplified",
    "18m": "simplified",
    "3y": "simplified"
  });

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const setMode = (id: string, mode: string) => {
    setModes(prev => ({ ...prev, [id]: mode }));
  };

  const sections: VisionSectionProps[] = [
    { id: "12m", title: "📅 12-Month Future Reality", subtitle: "Describe what exists one year from now", status: "complete" },
    { id: "18m", title: "⏳ 18-36 Month Future Reality", subtitle: "Describe the transitional state", status: "in-progress" },
    { id: "3y", title: "🚀 3-5 Year Future Reality", subtitle: "Describe the destination state", status: "not-started" },
    { id: "ult", title: "🌟 Ultimate Vision", subtitle: "How you fundamentally relate to this agency", status: "not-started", isUltimate: true },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-4">
        {sections.map(section => (
          <Accordion
            key={section.id}
            title={section.title}
            subtitle={section.subtitle}
            status={section.status}
            isOpen={activeAccordion === section.id}
            onToggle={() => toggleAccordion(section.id)}
          >
            {!section.isUltimate && (
               <div className="mb-8 flex justify-center">
                  <SegmentedControl 
                    options={[
                      { label: "Simplified", value: "simplified" },
                      { label: "Advanced", value: "advanced" }
                    ]}
                    value={modes[section.id]}
                    onChange={(val) => setMode(section.id, val)}
                  />
               </div>
            )}
            
            <VisionForm 
               isUltimate={section.isUltimate} 
               mode={modes[section.id] as 'simplified' | 'advanced'} 
            />
          </Accordion>
        ))}
      </div>

      {/* Right Sidebar */}
      <div className="lg:w-80 flex-shrink-0">
         <div className="sticky top-24 space-y-4">
            <SidebarCard title="📋 Your Declared Direction">
               <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-100">
                     <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white">✓</div>
                        <span className="text-sm font-medium text-slate-700">12-Month</span>
                     </div>
                     <span className="text-xs text-emerald-600 font-medium">Complete</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-yellow-50 border border-yellow-100">
                     <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] text-white"></div>
                        <span className="text-sm font-medium text-slate-700">18-36 Month</span>
                     </div>
                     <span className="text-xs text-yellow-600 font-medium">In Progress</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                     <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border border-slate-300"></div>
                        <span className="text-sm font-medium text-slate-500">3-5 Year</span>
                     </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                     <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border border-slate-300"></div>
                        <span className="text-sm font-medium text-slate-500">Ultimate</span>
                     </div>
                  </div>
               </div>
            </SidebarCard>

            {/* Conditional Scenario Preview */}
            {activeAccordion === "12m" && modes["12m"] === "advanced" && (
               <SidebarCard title="📊 Attached Scenario">
                  <div className="bg-white rounded border border-slate-200 p-3 space-y-2">
                     <div className="font-medium text-slate-900 text-sm">Aggressive Growth - 12M</div>
                     <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                        <span className="text-slate-500">Revenue:</span>
                        <span className="text-right font-medium">$3.5M</span>
                        <span className="text-slate-500">Team:</span>
                        <span className="text-right font-medium">18 FTE</span>
                     </div>
                     <div className="pt-2 mt-2 border-t border-slate-100 text-center">
                        <button className="text-xs text-brand-600 font-medium hover:text-brand-700">View Details &rarr;</button>
                     </div>
                  </div>
               </SidebarCard>
            )}
         </div>
      </div>
    </div>
  );
};

// --- Tab 3: Trade-offs ---

export const TradeOffs: React.FC = () => {
  const [ranks, setRanks] = useState({
    time: "1",
    money: "2",
    freedom: "3",
    optionality: "4"
  });

  const handleChange = (key: string, value: string) => {
    setRanks(prev => ({ ...prev, [key]: value }));
  };

  const variables = [
    { key: "time", label: "Time", desc: "Optimizing for pace, speed to outcome, and near-term progress" },
    { key: "money", label: "Money", desc: "Optimizing for financial return, revenue scale, and economic upside" },
    { key: "freedom", label: "Freedom", desc: "Optimizing for reduced personal involvement and flexibility" },
    { key: "optionality", label: "Optionality", desc: "Optimizing for future choices and strategic flexibility" },
  ];

  // Simple validation check (visual only for now)
  const values = Object.values(ranks);
  const duplicates = values.filter((item, index) => values.indexOf(item) !== index);
  const hasError = duplicates.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
         <h2 className="text-2xl font-bold text-slate-900">Optimization Orientation</h2>
         <p className="text-slate-600 mt-2">Declare what matters most when tradeoffs arise.</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex gap-3">
         <div className="text-blue-600 flex-shrink-0 mt-0.5"><Zap className="h-5 w-5" /></div>
         <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">When growth creates tension, not everything can be maximized at once.</p>
            <p>Rank these outcomes in the order you want the business to protect them right now.</p>
            <div className="mt-2 flex gap-4 font-medium text-xs uppercase tracking-wide opacity-80">
               <span>1st = Most Protected</span>
               <span>4th = Most Willing to Trade Off</span>
            </div>
         </div>
      </div>

      <Card className="p-8 mb-8">
         <div className="space-y-6">
            {variables.map((v) => (
               <div key={v.key} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex-grow">
                     <h3 className="font-semibold text-slate-900">{v.label}</h3>
                     <p className="text-sm text-slate-500">{v.desc}</p>
                  </div>
                  <div className="flex-shrink-0 w-32">
                     <Select 
                        value={ranks[v.key as keyof typeof ranks]} 
                        onChange={(e) => handleChange(v.key, e.target.value)}
                        className={hasError ? "border-red-300 focus:border-red-500 focus:ring-red-200" : ""}
                     >
                        <option value="1">1st Priority</option>
                        <option value="2">2nd Priority</option>
                        <option value="3">3rd Priority</option>
                        <option value="4">4th Priority</option>
                     </Select>
                  </div>
               </div>
            ))}
         </div>

         {hasError && (
            <div className="mt-6 flex items-center justify-center text-red-600 text-sm font-medium gap-2">
               <AlertTriangle className="h-4 w-4" />
               Please ensure each priority rank (1st-4th) is used exactly once.
            </div>
         )}

         <div className="mt-8 flex justify-end">
            <Button disabled={hasError} variant="secondary">Save Ranking</Button>
         </div>
      </Card>

      {!hasError && (
         <div className="bg-slate-900 rounded-lg p-6 text-slate-300">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
               <Check className="h-5 w-5 text-emerald-400" />
               Your Tradeoff Posture
            </h3>
            <p className="text-sm mb-4">Your optimization orientation shapes your strategic direction within ArchitectOS.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
               {variables
                  .sort((a, b) => parseInt(ranks[a.key as keyof typeof ranks]) - parseInt(ranks[b.key as keyof typeof ranks]))
                  .map((v, idx) => (
                  <div key={v.key} className="bg-slate-800 rounded p-3 border border-slate-700">
                     <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                        {idx === 0 ? "Most Protected" : idx === 3 ? "Trade-off" : `${idx + 1} Priority`}
                     </div>
                     <div className="font-bold text-white">{v.label}</div>
                  </div>
               ))}
            </div>
         </div>
      )}
    </div>
  );
};

// Keep previous exports for compatibility if needed, but they are replaced by above
export const FounderEvolution: React.FC = () => <PlaceholderContent text="Moved to separate module" />;
export const StrategicGaps: React.FC = () => <PlaceholderContent text="Merged into Synthesis" />;
