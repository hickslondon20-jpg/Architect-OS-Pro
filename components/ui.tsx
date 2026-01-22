import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'secondary' | 'danger' }> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900",
    outline: "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 focus:ring-slate-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-500",
    secondary: "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className = '', ...props }) => (
  <label className={`block text-sm font-medium text-slate-700 mb-1.5 ${className}`} {...props} />
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input className={`block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm px-3 py-2 border placeholder-slate-400 ${className}`} {...props} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => (
  <div className="relative">
    <select className={`block w-full appearance-none rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm px-3 py-2 border bg-white text-slate-900 ${className}`} {...props} />
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </div>
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'orange'; className?: string }> = ({ children, color = 'gray', className = '' }) => {
  const colors = {
    gray: 'bg-slate-100 text-slate-700',
    blue: 'bg-brand-100 text-brand-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};

export const Accordion: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  status?: 'not-started' | 'in-progress' | 'complete';
}> = ({ title, subtitle, isOpen, onToggle, children, status = 'not-started' }) => {
  return (
    <div className={`border border-slate-200 rounded-lg bg-white overflow-hidden transition-all ${isOpen ? 'ring-1 ring-slate-300 shadow-sm' : ''}`}>
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-lg font-medium text-slate-900">{title}</span>
            {isOpen && status !== 'not-started' && (
               <Badge color={status === 'complete' ? 'green' : 'yellow'}>
                 {status === 'complete' ? 'Complete' : 'In Progress'}
               </Badge>
            )}
          </div>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {!isOpen && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
               <span>Status:</span>
               <span className={`h-2.5 w-2.5 rounded-full ${
                  status === 'complete' ? 'bg-emerald-500' : 
                  status === 'in-progress' ? 'bg-yellow-500' : 'border border-slate-300'
               }`} />
               <span>
                  {status === 'complete' ? 'Complete' : status === 'in-progress' ? 'In Progress' : 'Not Started'}
               </span>
            </div>
          )}
          {isOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 p-6 bg-slate-50/30">
          {children}
        </div>
      )}
    </div>
  );
};

export const SegmentedControl: React.FC<{
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex p-1 bg-slate-100 rounded-lg">
    {options.map((option) => (
      <button
        key={option.value}
        onClick={() => onChange(option.value)}
        className={`
          flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all
          ${value === option.value 
            ? 'bg-white text-slate-900 shadow-sm' 
            : 'text-slate-500 hover:text-slate-700'}
        `}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const ProgressBar: React.FC<{ value: number; max: number; className?: string }> = ({ value, max, className = '' }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`h-2 bg-slate-100 rounded-full overflow-hidden ${className}`}>
      <div 
        className="h-full bg-slate-900 transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export const RadioGroup: React.FC<{
  name: string;
  options: { label: string; value: string }[];
  value?: string;
  onChange: (value: string) => void;
}> = ({ name, options, value, onChange }) => (
  <div className="space-y-3">
    {options.map((option) => (
      <label 
        key={option.value}
        className={`
          flex items-center p-3 border rounded-lg cursor-pointer transition-all
          ${value === option.value 
            ? 'border-brand-600 bg-brand-50' 
            : 'border-slate-200 hover:bg-slate-50'}
        `}
      >
        <div className="flex items-center h-5">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 text-brand-600 border-slate-300 focus:ring-brand-500"
          />
        </div>
        <div className="ml-3 text-sm">
          <span className={`font-medium ${value === option.value ? 'text-brand-900' : 'text-slate-900'}`}>
            {option.label}
          </span>
        </div>
      </label>
    ))}
  </div>
);

export const Switch: React.FC<{
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
}> = ({ checked, onCheckedChange, id }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    id={id}
    onClick={() => onCheckedChange(!checked)}
    className={`
      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2
      ${checked ? 'bg-slate-900' : 'bg-slate-200'}
    `}
  >
    <span
      className={`
        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
        ${checked ? 'translate-x-5' : 'translate-x-0'}
      `}
    />
  </button>
);

export const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}> = ({ value, min, max, step = 1, onChange, className = '' }) => (
  <div className={`relative flex items-center select-none touch-none ${className}`}>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
    />
  </div>
);

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
} | null>(null);

export const Tabs: React.FC<TabsProps> = ({ defaultValue, children, className = '' }) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<TabsListProps> = ({ children, className = '' }) => (
  <div className={`inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 ${className}`}>
    {children}
  </div>
);

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, className = '' }) => {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.activeTab === value;

  return (
    <button
      onClick={() => context.setActiveTab(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
        ${isActive ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-200 hover:text-slate-900'}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className = '' }) => {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${className}`}>
      {children}
    </div>
  );
};


export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div>{actions}</div>}
  </div>
);

interface TabNavProps {
  tabs: { label: string; href: string }[];
}

export const TabNav: React.FC<TabNavProps> = ({ tabs }) => {
  const location = useLocation();

  return (
    <div className="border-b border-slate-200 mb-8 overflow-x-auto">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = location.pathname.includes(tab.href);
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${isActive 
                  ? 'border-brand-600 text-brand-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export const PlaceholderContent: React.FC<{ text?: string }> = ({ text = "Content coming soon" }) => (
  <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50 p-6 text-center">
    <div className="text-slate-400 mb-2">
      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </div>
    <h3 className="text-sm font-medium text-slate-900">{text}</h3>
    <p className="mt-1 text-sm text-slate-500">This module is under construction.</p>
  </div>
);