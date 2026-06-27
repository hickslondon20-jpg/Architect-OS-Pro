import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeftRight, Compass, Camera, TrendingUp, User } from 'lucide-react';

interface ToolCardProps {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  icon: React.ElementType;
  note?: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ eyebrow, title, description, ctaLabel, href, icon: Icon, note }) => (
  <Link to={href} className="group flex flex-col rounded-[var(--radius-xs)] p-6 h-full transition-shadow hover:shadow-[var(--shadow-soft-2)]"
    style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
        style={{ background: 'var(--bg-sunken)' }}>
        <Icon className="w-5 h-5" style={{ color: 'var(--aos-brass)' }} />
      </div>
      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: 'var(--aos-brass)' }} />
    </div>
    <div className="aos-eyebrow mb-1">{eyebrow}</div>
    <h3 className="aos-h3 mb-2">{title}</h3>
    <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--fg-2)' }}>{description}</p>
    {note && (
      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--aos-brass)' }}>
        <ArrowLeftRight className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{note}</span>
      </div>
    )}
    <div className="mt-4 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--aos-brass)' }}>
      {ctaLabel}
      <ArrowRight className="w-4 h-4" />
    </div>
  </Link>
);

export const FoundationsLanding: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Navy hero banner */}
      <div
        className="rounded-[var(--radius-xs)] p-8 md:p-10 relative overflow-hidden"
        style={{ background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)', boxShadow: 'var(--shadow-soft-2)' }}
      >
        <div className="relative z-10">
          <div className="aos-eyebrow mb-3" style={{ color: 'var(--aos-brass-soft)' }}>FOUNDATIONS</div>
          <h1 className="aos-h1 mb-3" style={{ color: 'var(--fg-on-dark)' }}>
            Know yourself. Know your business. Know where you're going.
          </h1>
          <p className="max-w-2xl" style={{ color: 'var(--aos-steel-blue)', fontSize: 'var(--t-body-size)', lineHeight: 'var(--t-body-lh)' }}>
            Foundations establishes the strategic context that powers every other tool in ArchitectOS.
            Start here to build the interpretive layer your diagnostics, planning, and AI synthesis rely on.
          </p>
        </div>
      </div>

      {/* Flow framing callout */}
      <div
        className="rounded-[var(--radius-xs)] px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{ background: 'var(--bg-surface)', borderLeft: '4px solid var(--aos-brass)', boxShadow: 'var(--shadow-soft-1)' }}
      >
        <div className="flex-1">
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--fg-1)' }}>How to work through Foundations</div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>
            Begin with <strong style={{ color: 'var(--fg-1)' }}>Architect Evolution</strong> to establish how you show up as a leader,
            then capture your agency's current state in the <strong style={{ color: 'var(--fg-1)' }}>Agency Snapshot</strong>.
            Move into <strong style={{ color: 'var(--fg-1)' }}>Clarity Compass</strong> to define what you're optimizing for across 12, 24, and 36 months.
            Use the <strong style={{ color: 'var(--fg-1)' }}>Growth Velocity Simulator</strong> to pressure-test those horizons against real growth scenarios —
            then return to the Compass to refine. <span style={{ color: 'var(--aos-brass)' }}>Clarity Compass ⇄ GV Simulator is an iterative loop, not a one-way sequence.</span>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium shrink-0 px-3 py-2 rounded"
          style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}>
          <span>AE</span>
          <ArrowRight className="w-3 h-3" />
          <span>Snapshot</span>
          <ArrowRight className="w-3 h-3" />
          <span>Clarity</span>
          <ArrowLeftRight className="w-3 h-3" style={{ color: 'var(--aos-brass)' }} />
          <span>GV Sim</span>
        </div>
      </div>

      {/* Tool cards — 2×2 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ToolCard
          eyebrow="Tool 1 · Entry Point"
          title="Architect Evolution"
          description="Reveals how you currently show up and lead as an architect of your business. This is the interpretive lens for everything downstream — your role, your orientation, and the operating style you're building from."
          ctaLabel="Begin Assessment"
          href="/foundations/architect-evolution"
          icon={User}
        />

        <ToolCard
          eyebrow="Tool 2 · Business Context"
          title="Agency Snapshot"
          description="The running essence of your agency — markets served, client mix, service model, current revenue, and delivery capacity. Self-reported now, AI-enriched over time. Grounds every diagnostic and planning tool in real business reality."
          ctaLabel="View Snapshot"
          href="/foundations/snapshot"
          icon={Camera}
        />

        <ToolCard
          eyebrow="Tool 3 · Strategic Direction"
          title="Clarity Compass"
          description="Where the transformation begins. Define what you're optimizing for — your 12, 24, and 36-month strategic horizons and the ultimate vision you're building toward. The Compass gives your growth scenarios a destination to test against."
          ctaLabel="Open Compass"
          href="/foundations/clarity-compass"
          icon={Compass}
          note="Iterates with the GV Simulator — revisit as scenarios evolve"
        />

        <ToolCard
          eyebrow="Tool 4 · Scenario Modeling"
          title="Growth Velocity Simulator"
          description="Model the growth paths available to your agency, the pressure each scenario creates, and how different approaches compare across revenue, margin, and capacity. Retag scenarios to your Clarity Compass horizons to keep strategy and modeling aligned."
          ctaLabel="Run Simulation"
          href="/foundations/gv-simulator"
          icon={TrendingUp}
          note="Feeds back into Clarity Compass — not a linear endpoint"
        />
      </div>
    </div>
  );
};
