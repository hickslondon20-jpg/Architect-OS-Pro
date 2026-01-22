import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, User, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const { tier, setTier, setSidebarOpen, isSidebarOpen } = useApp();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="text-slate-500 hover:text-slate-700 focus:outline-none lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* Dev Mode Toggle */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
           <span className="hidden sm:inline px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Dev Mode</span>
           <div className="flex bg-white rounded shadow-sm">
              <button 
                onClick={() => setTier('free')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${tier === 'free' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Free
              </button>
              <button 
                onClick={() => setTier('pro')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${tier === 'pro' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Pro
              </button>
           </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* User Profile */}
        <div className="relative group">
           <button className="flex items-center gap-2 rounded-full bg-slate-100 p-1 pr-3 hover:bg-slate-200 transition-colors">
              <div className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center">
                <User className="h-4 w-4 text-slate-600" />
              </div>
              <span className="hidden sm:inline-block text-sm font-medium text-slate-700">Founder</span>
           </button>
           {/* Profile Dropdown */}
           <div className="absolute right-0 top-full pt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="rounded-md border border-slate-100 bg-white p-1 shadow-lg">
                <Link to="/settings" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <SettingsIcon className="h-4 w-4" /> Settings
                </Link>
                <Link to="/sign-in" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Sign Out
                </Link>
              </div>
           </div>
        </div>
      </div>
    </header>
  );
};
