import React from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useApp } from '../context/AppContext';
import { getFeatureGate, getFeatureKeyForPath, getFeatureLockMessage } from '../lib/featureGates';

export const DashboardLayout: React.FC = () => {
  const isAuthenticated = true;

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <Sidebar />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <Header />
        <main className="w-full flex-grow p-6" style={{ backgroundColor: 'var(--bg-canvas)' }}>
          <div className="max-w-[1440px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

interface SectionLayoutTab {
  label: string;
  href: string;
  isLocked?: boolean;
}

interface SectionLayoutProps {
  title: string;
  eyebrow?: string;
  tabs?: SectionLayoutTab[];
}

export const SectionLayout: React.FC<SectionLayoutProps> = ({ title, eyebrow, tabs }) => {
  const { featureGatesBypassed, isFeatureUnlocked } = useApp();

  return (
    <div>
      {/* Pro Suite-style header card: eyebrow + title + pill tab nav */}
      <div
        className="rounded-[var(--radius-xs)] mb-6 px-5 py-4"
        style={{
          background: 'var(--bg-surface)',
          border: 'var(--border-hairline)',
          boxShadow: 'var(--shadow-soft-1)',
        }}
      >
        {eyebrow && (
          <div className="aos-eyebrow mb-1" style={{ color: 'var(--aos-brass)' }}>
            {eyebrow}
          </div>
        )}
        <span className="aos-h3">{title}</span>

        {tabs && (
          <nav className="mt-4 flex gap-3 overflow-x-auto" aria-label={`${title} navigation`}>
            {tabs.map((tab) => {
              const featureKey = getFeatureKeyForPath(tab.href);
              const isWeeklyLocked = !isFeatureUnlocked(featureKey);
              const gate = getFeatureGate(featureKey);

              if (!featureGatesBypassed && (tab.isLocked || isWeeklyLocked)) {
                return (
                  <div
                    key={tab.href}
                    className="flex min-w-fit items-center gap-2 rounded-[var(--radius-xs)] px-4 py-2.5 text-sm font-medium cursor-not-allowed"
                    style={{
                      background: 'var(--bg-sunken)',
                      border: 'var(--border-hairline)',
                      color: 'var(--fg-4)',
                    }}
                    title={isWeeklyLocked ? getFeatureLockMessage(featureKey) : 'This tab is currently locked.'}
                  >
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    {tab.label}
                    {isWeeklyLocked && (
                      <span className="text-[10px] uppercase tracking-wider">
                        {gate?.postBeta ? 'Post-beta' : `W${gate?.unlockWeek}`}
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={tab.href}
                  to={tab.href}
                  className="flex min-w-fit items-center rounded-[var(--radius-xs)] px-4 py-2.5 text-sm font-medium transition-colors"
                  style={({ isActive }) => ({
                    background: isActive ? 'var(--aos-brass-tint)' : 'var(--bg-surface)',
                    border: isActive ? 'var(--border-accent)' : 'var(--border-hairline)',
                    color: isActive ? 'var(--aos-brass)' : 'var(--fg-3)',
                  })}
                >
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>

      <Outlet />
    </div>
  );
};
