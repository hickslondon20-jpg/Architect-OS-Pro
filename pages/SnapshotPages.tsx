import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Input, 
  Select, 
  Label, 
  PlaceholderContent 
} from '../components/ui';
import { 
  Info, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Building2, 
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';

// --- Shared Components ---

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; description?: string }> = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100">
    <div className="p-2 bg-slate-100 rounded-lg">
      <Icon className="h-6 w-6 text-slate-600" />
    </div>
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
    </div>
  </div>
);

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-sm font-medium text-slate-900 uppercase tracking-wider mb-4">{title}</h3>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const AdvancedSection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50/50 mb-8 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span>Enhanced Metrics (Optional)</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-slate-200 bg-white space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; subtext?: string; trend?: string }> = ({ label, value, subtext, trend }) => (
  <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
    <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
    <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
    {(subtext || trend) && (
      <div className="flex items-center justify-between text-xs">
        {subtext && <span className="text-slate-400">{subtext}</span>}
        {trend && <span className="text-emerald-600 font-medium">{trend}</span>}
      </div>
    )}
  </div>
);

const SnapshotLayout: React.FC<{ children: React.ReactNode; sidebarMetrics: React.ReactNode }> = ({ children, sidebarMetrics }) => (
  <div className="flex flex-col lg:flex-row gap-8">
    <div className="flex-1 min-w-0">
      <Card className="p-6 sm:p-8">
        {children}
      </Card>
    </div>
    <div className="lg:w-80 flex-shrink-0">
      <div className="sticky top-24 space-y-4">
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-4">
             <BarChart3 className="h-4 w-4 text-slate-500" />
             <h3 className="text-sm font-semibold text-slate-900">Calculated Metrics</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">These metrics will auto-populate once you save your data.</p>
          <div className="space-y-3">
             {sidebarMetrics}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- Tab 1: Dashboard ---

export const SnapshotDashboard: React.FC = () => {
  return (
    <div>
      {/* Hero */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Agency Snapshot Dashboard</h2>
        <p className="text-lg text-slate-600 mt-2">Your current-state baseline — no judgment, just clarity.</p>
        <p className="text-sm text-slate-400 mt-1">Complete the snapshot tabs to generate your org health overview.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
         {[1, 2, 3, 4].map((i) => (
           <Card key={i} className="p-6 flex flex-col items-center justify-center min-h-[140px]">
              <div className="text-sm text-slate-500 font-medium mb-2">Key Metric Placeholder</div>
              <div className="text-3xl font-bold text-slate-200">---</div>
           </Card>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Card className="lg:col-span-2 p-8 min-h-[300px]">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Strategic Context Summary</h3>
            <PlaceholderContent text="AI-generated narrative synthesis will appear here" />
         </Card>
         <Card className="p-8 min-h-[300px]">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Constraint Profile</h3>
            <PlaceholderContent text="Visual indicators of growth limiters" />
         </Card>
      </div>
    </div>
  );
};

// --- Tab 2: Financial Snapshot ---

export const FinancialSnapshot: React.FC = () => {
  return (
    <SnapshotLayout
      sidebarMetrics={
        <>
          <MetricCard label="AGI %" value="---%" subtext="Target: > 65%" />
          <MetricCard label="Operating Profit" value="$---" subtext="Target: 25%+" />
          <MetricCard label="Rev per FTE" value="$---" />
          <MetricCard label="Payroll Efficiency" value="---%" subtext="Payroll / AGI" />
        </>
      }
    >
      <SectionHeader 
        icon={DollarSign} 
        title="Financial Snapshot" 
        description="All fields are optional. The more data you provide, the more insights we can generate." 
      />
      
      <FormSection title="Core Financial Metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
              <Label>Monthly Revenue</Label>
              <Input type="number" placeholder="$0.00" />
              <p className="text-xs text-slate-500 mt-1">Approximate monthly revenue (all sources)</p>
           </div>
           <div>
              <Label>Monthly AGI (Agency Gross Income)</Label>
              <Input type="number" placeholder="$0.00" />
              <p className="text-xs text-slate-500 mt-1">Revenue minus pass-through costs</p>
           </div>
           <div>
              <Label>Monthly Payroll (Unburdened)</Label>
              <Input type="number" placeholder="$0.00" />
              <p className="text-xs text-slate-500 mt-1">Total salaries/wages before taxes/benefits</p>
           </div>
           <div>
              <Label>Annual Revenue (Run Rate)</Label>
              <Input type="number" placeholder="$0.00" />
              <p className="text-xs text-slate-500 mt-1">Estimated annual revenue based on current trajectory</p>
           </div>
           <div>
              <Label>Typical Profit Margin</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select margin range...</option>
                 <option value="<10">&lt; 10%</option>
                 <option value="10-20">10-20%</option>
                 <option value="20-30">20-30%</option>
                 <option value="30-40">30-40%</option>
                 <option value=">40">&gt; 40%</option>
              </Select>
           </div>
           <div>
              <Label>Financial Health Status</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select status...</option>
                 <option value="cash-strapped">Cash-strapped</option>
                 <option value="stable">Stable</option>
                 <option value="comfortable">Comfortable</option>
                 <option value="strong">Strong cash reserves</option>
              </Select>
           </div>
        </div>
      </FormSection>

      <AdvancedSection>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <Label>Pass-Through Costs</Label>
               <Input type="number" placeholder="$0.00" />
            </div>
            <div>
               <Label>Monthly SG&A/Overhead</Label>
               <Input type="number" placeholder="$0.00" />
            </div>
            <div>
               <Label>Owner Compensation</Label>
               <Input type="number" placeholder="$0.00" />
            </div>
            <div>
               <Label>Target Annual Revenue</Label>
               <Input type="number" placeholder="$0.00" />
            </div>
         </div>
      </AdvancedSection>

      <div className="pt-4 border-t border-slate-100">
        <Button className="w-full sm:w-auto" variant="secondary">Save Financial Data</Button>
      </div>
    </SnapshotLayout>
  );
};

// --- Tab 3: Growth & Pipeline ---

export const GrowthPipeline: React.FC = () => {
  return (
    <SnapshotLayout
      sidebarMetrics={
        <>
          <MetricCard label="Net MRR Change" value="$---" />
          <MetricCard label="Churn Rate" value="---%" subtext="Target: < 5%" />
          <MetricCard label="Client Retention" value="---%" />
          <MetricCard label="Win Rate" value="---%" />
        </>
      }
    >
      <SectionHeader 
        icon={TrendingUp} 
        title="Growth & Pipeline" 
        description="Understanding your revenue engine and client dynamics." 
      />

      <FormSection title="Core Growth Metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
              <Label>Current MRR</Label>
              <Input type="number" placeholder="$0.00" />
              <p className="text-xs text-slate-500 mt-1">Total recurring revenue from active retainers</p>
           </div>
           <div className="grid grid-cols-2 gap-2">
              <div>
                 <Label>% Recurring</Label>
                 <Input type="number" placeholder="70" />
              </div>
              <div>
                 <Label>% Project</Label>
                 <Input type="number" placeholder="30" />
              </div>
           </div>
           <div>
              <Label>New Clients (This Month)</Label>
              <Input type="number" placeholder="0" />
           </div>
           <div>
              <Label>Clients Lost (This Month)</Label>
              <Input type="number" placeholder="0" />
           </div>
           <div>
              <Label>Active Client Count</Label>
              <Input type="number" placeholder="0" />
           </div>
           <div>
              <Label>Average Client Tenure</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select tenure...</option>
                 <option value="<3">&lt; 3 months</option>
                 <option value="3-6">3-6 months</option>
                 <option value="6-12">6-12 months</option>
                 <option value="12-24">12-24 months</option>
                 <option value=">24">&gt; 24 months</option>
              </Select>
           </div>
           <div className="md:col-span-2">
              <Label>Primary Attraction Method</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select primary channel...</option>
                 <option value="inbound">Inbound (Content/SEO)</option>
                 <option value="referral">Referrals</option>
                 <option value="outbound">Outbound (Cold Outreach)</option>
                 <option value="partnerships">Partnerships</option>
                 <option value="paid">Paid Ads</option>
                 <option value="events">Events/Speaking</option>
              </Select>
           </div>
        </div>
      </FormSection>

      <AdvancedSection>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <Label>Average Deal Size</Label>
               <Input type="number" placeholder="$0.00" />
            </div>
            <div>
               <Label>Sales Cycle Length</Label>
               <Select defaultValue="">
                 <option value="" disabled>Select cycle length...</option>
                 <option value="<1">&lt; 1 month</option>
                 <option value="1-3">1-3 months</option>
                 <option value="3-6">3-6 months</option>
                 <option value=">6">&gt; 6 months</option>
              </Select>
            </div>
            <div>
               <Label>Current Pipeline Value</Label>
               <Input type="number" placeholder="$0.00" />
            </div>
         </div>
      </AdvancedSection>

      <div className="pt-4 border-t border-slate-100">
        <Button className="w-full sm:w-auto" variant="secondary">Save Growth Data</Button>
      </div>
    </SnapshotLayout>
  );
};

// --- Tab 4: Team & Capacity ---

export const TeamCapacity: React.FC = () => {
  return (
    <SnapshotLayout
      sidebarMetrics={
        <>
          <MetricCard label="AGI per FTE" value="$---" subtext="Target: $15k-25k" />
          <MetricCard label="Billable Ratio" value="---:1" subtext="Billable vs Non" />
          <MetricCard label="Rev per Employee" value="$---" />
          <MetricCard label="Utilization" value="---%" />
        </>
      }
    >
      <SectionHeader 
        icon={Users} 
        title="Team & Capacity" 
        description="Headcount, structure, and delivery capabilities." 
      />

      <FormSection title="Core Team Metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
              <Label>Total Team Size (FTE)</Label>
              <Input type="number" placeholder="0" />
              <p className="text-xs text-slate-500 mt-1">Full-time equivalent employee count</p>
           </div>
           <div>
              <Label>Delivery Model</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select model...</option>
                 <option value="remote">Fully Remote</option>
                 <option value="hybrid">Hybrid</option>
                 <option value="office">In-Office</option>
                 <option value="client">Client-Site</option>
              </Select>
           </div>
           <div>
              <Label>Billable Staff Count</Label>
              <Input type="number" placeholder="0" />
              <p className="text-xs text-slate-500 mt-1">Client-facing / revenue generating</p>
           </div>
           <div>
              <Label>Non-Billable Staff Count</Label>
              <Input type="number" placeholder="0" />
              <p className="text-xs text-slate-500 mt-1">Admin, ops, leadership</p>
           </div>
           <div>
              <Label>Active Contractors</Label>
              <Input type="number" placeholder="0" />
           </div>
           <div>
              <Label>Role Categories (Select multiple)</Label>
              <Select multiple className="h-24">
                 <option value="strat">Strategists</option>
                 <option value="pm">Account/Project Managers</option>
                 <option value="creative">Creative/Design</option>
                 <option value="dev">Technical/Dev</option>
                 <option value="media">Media Buyers</option>
                 <option value="ops">Leadership/Ops</option>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
           </div>
        </div>
      </FormSection>

      <AdvancedSection>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <Label>Billable Hours Available</Label>
               <Input type="number" placeholder="0" />
            </div>
            <div>
               <Label>Hours Billed (Last Month)</Label>
               <Input type="number" placeholder="0" />
            </div>
            <div>
               <Label>Target Hourly Rate</Label>
               <Input type="number" placeholder="$0.00" />
            </div>
         </div>
      </AdvancedSection>

      <div className="pt-4 border-t border-slate-100">
        <Button className="w-full sm:w-auto" variant="secondary">Save Team Data</Button>
      </div>
    </SnapshotLayout>
  );
};

// --- Tab 5: Business Identity ---

export const BusinessIdentity: React.FC = () => {
  return (
    <SnapshotLayout
      sidebarMetrics={
        <>
          <MetricCard label="Positioning" value="---" subtext="Strength Score" />
          <MetricCard label="Complexity" value="---" subtext="Delivery Score" />
        </>
      }
    >
      <SectionHeader 
        icon={Building2} 
        title="Business Identity & Context" 
        description="Who you are, who you serve, and how you work." 
      />

      <FormSection title="Business Identity & Positioning">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="md:col-span-2">
              <Label>Agency Name</Label>
              <Input type="text" placeholder="Agency Name" />
           </div>
           <div>
              <Label>Website</Label>
              <Input type="text" placeholder="https://..." />
           </div>
           <div>
              <Label>Primary Industry Focus</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select industry...</option>
                 <option value="saas">B2B SaaS</option>
                 <option value="ecom">E-commerce</option>
                 <option value="health">Healthcare</option>
                 <option value="finance">Finance</option>
                 <option value="pro">Professional Services</option>
                 <option value="other">Other</option>
              </Select>
           </div>
           <div>
              <Label>Primary ICP</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select client type...</option>
                 <option value="startup">Startups (Pre-Seed - Series A)</option>
                 <option value="growth">Growth-Stage (Series B+)</option>
                 <option value="smb">SMBs</option>
                 <option value="mid">Mid-Market</option>
                 <option value="enterprise">Enterprise</option>
              </Select>
           </div>
           <div>
              <Label>Primary Service Category</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select primary service...</option>
                 <option value="media">Paid Media</option>
                 <option value="seo">SEO/Content</option>
                 <option value="social">Social Media</option>
                 <option value="creative">Brand/Creative</option>
                 <option value="dev">Web/Dev</option>
                 <option value="growth">Full-Service Growth</option>
                 <option value="consulting">Strategy/Consulting</option>
              </Select>
           </div>
           <div>
              <Label>Engagement Structure</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select structure...</option>
                 <option value="advisory">Strategic Advisory</option>
                 <option value="execution">Hands-On Execution</option>
                 <option value="hybrid">Hybrid (Strat + Exec)</option>
                 <option value="whitelabel">White-Label</option>
              </Select>
           </div>
           <div>
              <Label>Primary Delivery Model</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select model...</option>
                 <option value="retainer">Retainer-Based</option>
                 <option value="project">Project-Based</option>
                 <option value="hybrid">Hybrid</option>
                 <option value="performance">Performance-Based</option>
              </Select>
           </div>
        </div>
      </FormSection>
      
      <div className="my-8 border-t border-slate-100"></div>

      <div className="mb-6 flex items-start gap-4">
          <div className="p-2 bg-slate-100 rounded-lg">
             <Activity className="h-5 w-5 text-slate-600" />
          </div>
          <div>
             <h3 className="text-sm font-medium text-slate-900 uppercase tracking-wider">Operating Context</h3>
             <p className="text-sm text-slate-500 mt-1">How you work and what shapes your decisions.</p>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
           <div>
              <Label>Team Location Model</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select location model...</option>
                 <option value="remote">Fully Remote</option>
                 <option value="hybrid">Hybrid</option>
                 <option value="office">In-Office</option>
                 <option value="distributed">Distributed Globally</option>
              </Select>
           </div>
           <div>
              <Label>Delivery Complexity</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select complexity...</option>
                 <option value="simple">Simple (1-2 disciplines)</option>
                 <option value="moderate">Moderate (3-4 disciplines)</option>
                 <option value="complex">Complex (5+ disciplines)</option>
              </Select>
           </div>
           <div>
              <Label>Tooling Maturity</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select maturity...</option>
                 <option value="basic">Basic/Minimal</option>
                 <option value="standard">Standard Industry Tools</option>
                 <option value="advanced">Advanced/Sophisticated</option>
                 <option value="custom">Custom-Built Systems</option>
              </Select>
           </div>
           <div>
              <Label>Primary PM System</Label>
              <Select defaultValue="">
                 <option value="" disabled>Select system...</option>
                 <option value="asana">Asana</option>
                 <option value="clickup">ClickUp</option>
                 <option value="monday">Monday</option>
                 <option value="notion">Notion</option>
                 <option value="other">Custom/Other</option>
                 <option value="none">None/Informal</option>
              </Select>
           </div>
      </div>

      <AdvancedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <Label>Geographic Market</Label>
                <Select defaultValue="">
                   <option value="local">Local/Regional</option>
                   <option value="national">National</option>
                   <option value="intl">International</option>
                </Select>
             </div>
             <div>
                <Label>Secondary Industries (Hold Ctrl/Cmd)</Label>
                <Select multiple className="h-24">
                   <option value="saas">B2B SaaS</option>
                   <option value="ecom">E-commerce</option>
                   <option value="health">Healthcare</option>
                   <option value="finance">Finance</option>
                   <option value="other">Other</option>
                </Select>
             </div>
          </div>
      </AdvancedSection>

      <div className="pt-4 border-t border-slate-100">
        <Button className="w-full sm:w-auto" variant="secondary">Save Identity & Context</Button>
      </div>
    </SnapshotLayout>
  );
};
