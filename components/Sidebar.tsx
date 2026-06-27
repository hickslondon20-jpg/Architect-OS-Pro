import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Compass,
  LayoutDashboard,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  User as UserIcon,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { FeatureKey, getFeatureGate, getFeatureLockMessage } from '../lib/featureGates';

interface NavChild {
  label: string;
  href: string;
  featureKey: FeatureKey;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  featureKey: FeatureKey;
  id?: string;
  children?: NavChild[];
}

const scrollbarStyles = `
  .sidebar-scroll::-webkit-scrollbar { width: 6px; }
  .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
  .sidebar-scroll::-webkit-scrollbar-thumb { background-color: var(--aos-slate-blue); border-radius: 3px; }
  .sidebar-scroll::-webkit-scrollbar-thumb:hover { background-color: var(--aos-obsidian-hover); }
`;

export const Sidebar: React.FC = () => {
  const {
    betaWeek,
    featureGatesBypassed,
    isFeatureUnlocked,
    isSidebarOpen,
    setSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    setSidebarCollapsed,
  } = useApp();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    foundations: true,
    diagnostics: true,
    'pro-suite': true,
  });

  const toggleSubmenu = (key: string) => {
    if (isSidebarCollapsed) {
      setSidebarCollapsed(false);
      setOpenSubmenus((prev) => ({ ...prev, [key]: true }));
      return;
    }

    setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, featureKey: 'dashboard' },
    {
      label: 'Foundations',
      href: '/foundations',
      icon: Compass,
      featureKey: 'foundations',
      id: 'foundations',
      children: [
        { label: 'Overview', href: '/foundations', featureKey: 'foundations' },
        { label: 'Architect Evolution', href: '/foundations/architect-evolution', featureKey: 'architect_evolution' },
        { label: 'Agency Snapshot', href: '/foundations/snapshot', featureKey: 'agency_snapshot' },
        { label: 'Clarity Compass', href: '/foundations/clarity-compass', featureKey: 'clarity_compass' },
        { label: 'GV Simulator', href: '/foundations/gv-simulator', featureKey: 'gv_simulator' },
      ],
    },
    {
      label: 'Diagnostics',
      href: '/diagnostics',
      icon: Wrench,
      featureKey: 'ae_ladder',
      id: 'diagnostics',
      children: [
        { label: 'Overview', href: '/diagnostics', featureKey: 'ae_ladder' },
        { label: 'AE Ladder', href: '/diagnostics/ae-ladder', featureKey: 'ae_ladder' },
        { label: 'M&R Audit', href: '/diagnostics/mr-audit', featureKey: 'mr_audit' },
      ],
    },
    {
      label: 'ArchitectOS Pro Suite',
      href: '/pro',
      icon: Zap,
      featureKey: 'pro_suite',
      id: 'pro-suite',
      children: [
        { label: 'Overview', href: '/pro', featureKey: 'pro_suite' },
        { label: 'Planning', href: '/pro/planning', featureKey: 'quarter_map' },
        { label: 'Execution', href: '/pro/execution', featureKey: 'sprint_launch' },
        { label: 'Intelligence', href: '/pro/intelligence', featureKey: 'pro_suite' },
      ],
    },
    { label: 'Resources', href: '/resources', icon: BookOpen, featureKey: 'resources' },
  ];

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  const renderLockedBadge = (featureKey: FeatureKey) => {
    const gate = getFeatureGate(featureKey);
    return (
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--fg-3)]">
        <Lock size={12} />
        {gate?.postBeta ? 'Post-beta' : `W${gate?.unlockWeek}`}
      </span>
    );
  };

  return (
    <>
      <style>{scrollbarStyles}</style>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: 'rgba(25, 48, 82, 0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
          ${isSidebarCollapsed ? 'w-20' : 'w-64'}
        `}
        style={{ backgroundColor: 'var(--bg-inverse)', color: 'var(--aos-steel-blue)' }}
      >
        <div className="flex h-16 items-center justify-between px-4 flex-shrink-0" style={{ backgroundColor: 'var(--aos-obsidian-deep)' }}>
          <Link to="/dashboard" className={`flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--aos-brass)' }}>
              <span className="text-white font-bold text-lg">A</span>
            </div>
            {!isSidebarCollapsed && (
              <span className="text-lg font-bold tracking-tight whitespace-nowrap" style={{ color: 'var(--fg-on-dark)' }}>ArchitectOS</span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            {!isSidebarCollapsed && (
              <button
                onClick={toggleSidebarCollapse}
                className="hidden lg:flex p-1 rounded-md transition-colors text-[var(--aos-steel-blue)] hover:text-[var(--fg-on-dark)] hover:bg-[var(--aos-slate-blue)]"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={18} />
              </button>
            )}
            <button
              className="lg:hidden transition-colors text-[var(--aos-steel-blue)] hover:text-[var(--fg-on-dark)]"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {isSidebarCollapsed && (
          <div className="hidden lg:flex justify-center py-2 border-b border-[var(--aos-slate-blue)]">
            <button
              onClick={toggleSidebarCollapse}
              className="p-1 rounded-md transition-colors text-[var(--aos-steel-blue)] hover:text-[var(--fg-on-dark)] hover:bg-[var(--aos-slate-blue)]"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={20} />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4 sidebar-scroll">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const itemLocked = !isFeatureUnlocked(item.featureKey);

              if (item.children) {
                const isOpen = openSubmenus[item.id!];
                const isChildActive = item.children.some((child) => isActive(child.href));

                return (
                  <div key={item.label} className={`space-y-1 ${isSidebarCollapsed ? '' : 'mb-2'}`}>
                    <button
                      onClick={() => toggleSubmenu(item.id!)}
                      className={`
                        flex items-center transition-colors
                        ${isSidebarCollapsed
                          ? 'justify-center w-10 h-10 rounded-lg mx-auto'
                          : 'w-full justify-between px-3 py-2 text-sm font-medium rounded-md'}
                        ${isChildActive
                          ? (isSidebarCollapsed
                              ? 'bg-[var(--aos-obsidian-hover)] text-[var(--fg-on-dark)]'
                              : 'text-[var(--fg-on-dark)]')
                          : 'text-[var(--aos-steel-blue)] hover:bg-[var(--aos-slate-blue)] hover:text-[var(--fg-on-dark)]'}
                      `}
                      title={isSidebarCollapsed ? item.label : undefined}
                    >
                      <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <Icon size={isSidebarCollapsed ? 24 : 18} />
                        {!isSidebarCollapsed && <span>{item.label}</span>}
                        {itemLocked && !isSidebarCollapsed && <Lock size={13} className="text-[var(--fg-3)]" />}
                      </div>
                      {!isSidebarCollapsed && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                    </button>

                    {isOpen && !isSidebarCollapsed && (
                      <div className="pl-10 space-y-1 mt-1">
                        {item.children.map((child) => {
                          const childLocked = !isFeatureUnlocked(child.featureKey);

                          if (childLocked) {
                            return (
                              <div
                                key={child.href}
                                title={getFeatureLockMessage(child.featureKey)}
                                className="flex cursor-not-allowed items-center justify-between gap-2 px-3 py-2 text-sm rounded-md text-[var(--fg-3)]"
                              >
                                <span className="truncate">{child.label}</span>
                                {renderLockedBadge(child.featureKey)}
                              </div>
                            );
                          }

                          return (
                            <Link
                              key={child.href}
                              to={child.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`
                                block py-2 text-sm rounded-md transition-colors
                                ${isActive(child.href)
                                  ? 'pl-[11px] border-l-[2px] border-[var(--aos-brass)] text-[var(--fg-on-dark)] bg-[var(--aos-obsidian-hover)]'
                                  : 'px-3 text-[var(--aos-steel-blue)] hover:text-[var(--fg-on-dark)] hover:bg-[var(--aos-slate-blue)]'}
                              `}
                            >
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const active = isActive(item.href);

              if (itemLocked) {
                return (
                  <div
                    key={item.href}
                    title={getFeatureLockMessage(item.featureKey)}
                    className={`
                      flex cursor-not-allowed items-center transition-colors text-[var(--fg-3)]
                      ${isSidebarCollapsed
                        ? 'justify-center w-10 h-10 rounded-lg mx-auto'
                        : 'justify-between px-3 py-2 text-sm font-medium rounded-md mb-1'}
                    `}
                  >
                    <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                      <Icon size={isSidebarCollapsed ? 20 : 18} />
                      {!isSidebarCollapsed && <span>{item.label}</span>}
                    </div>
                    {!isSidebarCollapsed && renderLockedBadge(item.featureKey)}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center transition-colors
                    ${isSidebarCollapsed
                      ? 'justify-center w-10 h-10 rounded-lg mx-auto'
                      : 'justify-between py-2 text-sm font-medium rounded-md mb-1'}
                    ${active
                      ? (isSidebarCollapsed
                          ? 'bg-[var(--aos-obsidian-hover)] text-[var(--fg-on-dark)]'
                          : 'pl-[9px] pr-3 border-l-[3px] border-[var(--aos-brass)] text-[var(--fg-on-dark)] bg-[var(--aos-obsidian-hover)]')
                      : (isSidebarCollapsed
                          ? 'text-[var(--aos-steel-blue)] hover:bg-[var(--aos-slate-blue)] hover:text-[var(--fg-on-dark)]'
                          : 'px-3 text-[var(--aos-steel-blue)] hover:bg-[var(--aos-slate-blue)] hover:text-[var(--fg-on-dark)]')}
                  `}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                    <Icon size={isSidebarCollapsed ? 20 : 18} />
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </div>

        </nav>

        <div className="p-4 border-t border-[var(--aos-slate-blue)]">
          {!isSidebarCollapsed ? (
            <div className="space-y-4">
              {user && (
                <div className="flex items-center gap-3 px-2">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center bg-[var(--aos-slate-blue)]">
                    <UserIcon size={16} style={{ color: 'var(--fg-on-dark)' }} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--fg-on-dark)' }}>{user.email}</div>
                    <div className="text-xs text-[var(--fg-3)]">
                      {featureGatesBypassed ? 'Development Access' : `Beta Week ${betaWeek}`}
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={signOut}
                className="flex items-center gap-3 w-full px-2 py-2 text-sm font-medium rounded-md transition-colors text-[var(--aos-steel-blue)] hover:text-[var(--fg-on-dark)] hover:bg-[var(--aos-slate-blue)]"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={signOut}
                className="p-2 rounded-md transition-colors text-[var(--aos-steel-blue)] hover:text-[var(--fg-on-dark)] hover:bg-[var(--aos-slate-blue)]"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
