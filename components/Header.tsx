import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, User, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { betaAccess, betaWeek, featureGatesBypassed, setSidebarOpen, isSidebarOpen } = useApp();
  const { signOut } = useAuth();
  const displayName = [betaAccess?.first_name, betaAccess?.last_name].filter(Boolean).join(' ') || 'Founder';

  return (
    <header
      className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--aos-mist)] px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-soft-1)' }}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="focus:outline-none lg:hidden transition-colors text-[var(--aos-steel-blue)] hover:text-[var(--fg-1)]"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-full border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--fg-2)]">
          {featureGatesBypassed ? 'Development Access' : `Beta Week ${betaWeek}`}
        </div>

        <div className="h-6 w-px mx-2 bg-[var(--aos-mist)]"></div>

        {/* User Profile */}
        <div className="relative group">
           <button className="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors bg-[var(--bg-canvas)] hover:bg-[var(--aos-parchment-deep)]">
              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-[var(--aos-slate-blue)]">
                <User className="h-4 w-4" style={{ color: 'var(--fg-on-dark)' }} />
              </div>
              <span className="hidden sm:inline-block text-sm font-medium text-[var(--fg-1)]">{displayName}</span>
           </button>
           {/* Profile Dropdown */}
           <div className="absolute right-0 top-full pt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="rounded-md border border-[var(--aos-mist)] p-1" style={{ backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-soft-2)' }}>
                <Link to="/settings" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-[var(--fg-1)] hover:bg-[var(--bg-canvas)]">
                  <SettingsIcon className="h-4 w-4" /> Settings
                </Link>
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-[var(--aos-risk)] hover:bg-[var(--aos-risk-tint)]">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
           </div>
        </div>
      </div>
    </header>
  );
};
