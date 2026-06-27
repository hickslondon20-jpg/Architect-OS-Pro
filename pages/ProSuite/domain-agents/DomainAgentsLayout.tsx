import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Bot, Boxes, FileText, Settings } from 'lucide-react';

const tabs = [
  { label: 'Agents', href: '/pro/intelligence/domain-agents', icon: Bot },
  { label: 'Tasks', href: '/pro/intelligence/domain-agents/tasks', icon: Boxes },
  { label: 'Artifacts', href: '/pro/intelligence/domain-agents/artifacts', icon: FileText },
];

export const DomainAgentsLayout: React.FC = () => (
  <div className="space-y-6">
    <div
      className="rounded-[var(--radius-xs)] px-5 py-4"
      style={{
        background: 'var(--bg-surface)',
        border: 'var(--border-hairline)',
        boxShadow: 'var(--shadow-soft-1)',
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="aos-eyebrow mb-1" style={{ color: 'var(--aos-brass)' }}>
            Intelligence Hub
          </div>
          <div className="flex items-center gap-2">
            <h1 className="aos-h3">Domain Agents</h1>
            <span className="aos-chip aos-chip--brass">
              <span className="aos-chip__dot" />
              Wireframe
            </span>
          </div>
          <p className="aos-small mt-2 max-w-3xl">
            Specialist strategic operators for task-bound production: choose an agent, launch a workflow,
            review the artifact, and deliberately promote the output back into OS Engine when it earns a place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NavLink
            to="/settings/ai-usage"
            className="aos-btn aos-btn--outline aos-btn--sm"
            title="AI usage reporting lives in Settings, not inside Domain Agents."
          >
            <BarChart3 className="h-4 w-4" />
            AI Usage
          </NavLink>
          <NavLink to="/settings/ai-usage" className="rounded-md p-2 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]" title="Settings">
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
      </div>

      <nav className="mt-4 flex gap-3 overflow-x-auto" aria-label="Domain Agents navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.href}
              to={tab.href}
              end={tab.href.endsWith('domain-agents')}
              className="flex min-w-fit items-center gap-2 rounded-[var(--radius-xs)] px-4 py-2.5 text-sm font-medium transition-colors"
              style={({ isActive }) => ({
                background: isActive ? 'var(--aos-brass-tint)' : 'var(--bg-surface)',
                border: isActive ? 'var(--border-accent)' : 'var(--border-hairline)',
                color: isActive ? 'var(--aos-brass)' : 'var(--fg-3)',
              })}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </div>

    <Outlet />
  </div>
);
