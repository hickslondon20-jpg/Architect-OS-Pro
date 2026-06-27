import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, ShieldCheck, ArrowDown } from 'lucide-react';

export const DiagnosticsLanding: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Navy hero banner */}
      <div
        className="rounded-[var(--radius-xs)] p-8 md:p-10 relative overflow-hidden"
        style={{ background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)', boxShadow: 'var(--shadow-soft-2)' }}
      >
        <div className="relative z-10">
          <div className="aos-eyebrow mb-3" style={{ color: 'var(--aos-brass-soft)' }}>DIAGNOSTICS</div>
          <h1 className="aos-h1 mb-3" style={{ color: 'var(--fg-on-dark)' }}>
            Know your stage. Diagnose what's holding you back.
          </h1>
          <p className="max-w-2xl" style={{ color: 'var(--aos-steel-blue)', fontSize: 'var(--t-body-size)', lineHeight: 'var(--t-body-lh)' }}>
            Diagnostics establishes your agency's growth stage and surfaces the operational constraints that stand between you and the next level. Run the AE Ladder first — it anchors everything that follows.
          </p>
        </div>
      </div>

      {/* Sequential operating path framing */}
      <div
        className="rounded-[var(--radius-xs)] px-6 py-5"
        style={{ background: 'var(--bg-surface)', borderLeft: '4px solid var(--aos-brass)', boxShadow: 'var(--shadow-soft-1)' }}
      >
        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--fg-1)' }}>The operating path — run in order</div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>
          Complete the <strong style={{ color: 'var(--fg-1)' }}>AE Ladder</strong> first. Your stage assignment isn't just a result — it's the anchor that makes the{' '}
          <strong style={{ color: 'var(--fg-1)' }}>M&R Audit</strong> stage-calibrated. Running the Audit before knowing your stage produces generic output.{' '}
          <span style={{ color: 'var(--aos-brass)' }}>AE Ladder → M&R Audit is a deliberate sequence, not a menu.</span>
        </p>
      </div>

      {/* Two-step sequential tool cards */}
      <div className="flex flex-col gap-4">
        {/* Step 1 — AE Ladder */}
        <Link
          to="/diagnostics/ae-ladder"
          className="group flex flex-col sm:flex-row gap-5 rounded-[var(--radius-xs)] p-6 transition-shadow hover:shadow-[var(--shadow-soft-2)]"
          style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}
        >
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg"
            style={{ background: 'var(--bg-sunken)' }}>
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--aos-brass)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="aos-eyebrow mb-1">Step 1 · Foundation Diagnostic</div>
            <h3 className="aos-h3 mb-2">AE Ladder — Agency Evolution Ladder</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>
              The Agency Evolution Ladder maps your agency's growth-stage progression across five stages: <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>Surviving → Rising → Driving → Thriving → Compounding</span>. Your stage assignment anchors the stage-aware recommendations, the right M&R Audit calibration, and all downstream platform insights. Run this first.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--aos-brass)' }}>
              Start Assessment <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        {/* Visual step connector */}
        <div className="flex items-center gap-3 px-6">
          <div className="flex flex-col items-center gap-1" style={{ color: 'var(--fg-4)' }}>
            <ArrowDown className="w-4 h-4" />
          </div>
          <span className="text-xs" style={{ color: 'var(--fg-4)' }}>Your AE stage calibrates the M&R Audit</span>
        </div>

        {/* Step 2 — M&R Audit */}
        <Link
          to="/diagnostics/mr-audit"
          className="group flex flex-col sm:flex-row gap-5 rounded-[var(--radius-xs)] p-6 transition-shadow hover:shadow-[var(--shadow-soft-2)]"
          style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}
        >
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg"
            style={{ background: 'var(--bg-sunken)' }}>
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--aos-brass)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="aos-eyebrow mb-1">Step 2 · Stage-Calibrated Audit</div>
            <h3 className="aos-h3 mb-2">M&R Audit — Maturity & Readiness</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>
              A 125-point diagnostic calibrated to your AE Ladder stage, evaluating operational maturity across five dimensions. Surfaces the constraints holding your agency at its current stage and identifies readiness for the next level of growth. Stage-aware results mean the right questions for where you actually are.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--aos-brass)' }}>
              Conduct Audit <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};
