import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Camera, 
  Compass, 
  Wrench, 
  Zap, 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  Lock,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Sidebar: React.FC = () => {
  const { tier, isSidebarOpen, setSidebarOpen } = useApp();
  const location = useLocation();
  
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    'tools': true,
  });

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Agency Snapshot', href: '/snapshot', icon: Camera },
    { label: 'Clarity Compass', href: '/clarity-compass', icon: Compass },
    { 
      label: 'Tools & Assessments', 
      href: '/tools', 
      icon: Wrench,
      id: 'tools',
      children: [
        { label: 'GV Simulator', href: '/tools/gv-simulator' },
        { label: 'AE Ladder', href: '/tools/ae-ladder' },
        { label: 'M&R Audit', href: '/tools/mr-audit' },
        { label: 'Founder Evolution', href: '/tools/founder-evolution' },
      ]
    },
    { 
      label: 'Architect OS Pro', 
      href: '/pro', 
      icon: Zap, 
      locked: tier === 'free' 
    },
    { label: 'Resources', href: '/resources', icon: BookOpen },
  ];

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
      `}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 bg-slate-950 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2">
             <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">Architect OS</span>
          </Link>
          <button 
            className="lg:hidden text-slate-400 hover:text-white" 
            onClick={() => setSidebarOpen(false)}
          >
             <X size={20} /> 
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            const isLocked = item.locked;
            
            if (item.children) {
              const isOpen = openSubmenus[item.id!];
              const isChildActive = item.children.some(child => isActive(child.href));

              return (
                <div key={item.label} className="space-y-1 mb-2">
                  <button 
                    onClick={() => toggleSubmenu(item.id!)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${isChildActive ? 'text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  
                  {isOpen && (
                    <div className="pl-10 space-y-1">
                      {item.children.map(child => (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`
                            block px-3 py-2 text-sm rounded-md transition-colors
                            ${isActive(child.href) 
                              ? 'text-white bg-blue-600' 
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                          `}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors mb-1
                  ${active 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {isLocked && <Lock size={14} className="text-slate-500" />}
              </Link>
            );
          })}
        </nav>
        
        {/* Footer / User Info could go here if not in header */}
        <div className="p-4 border-t border-slate-800">
           <div className="text-xs text-slate-500">v1.0.0 &copy; 2024</div>
        </div>
      </div>
    </>
  );
};
