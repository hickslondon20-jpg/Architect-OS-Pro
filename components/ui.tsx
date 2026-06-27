import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getFeatureGate, getFeatureKeyForPath, getFeatureLockMessage } from '../lib/featureGates';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }> = ({ children, className = '', ...props }) => (
  <div className={`bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }> = ({ children, className = '', ...props }) => (
  <div className={`flex-1 ${className}`} {...props}>
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
    primary: "bg-[var(--aos-brass)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-brass-soft)] focus:ring-[var(--aos-brass)]",
    outline: "border border-[var(--aos-mist)] bg-transparent text-[var(--fg-2)] hover:bg-[var(--bg-canvas)] focus:ring-[var(--aos-steel-blue)]",
    ghost: "bg-transparent text-[var(--fg-2)] hover:bg-[var(--bg-canvas)] focus:ring-[var(--aos-steel-blue)]",
    secondary: "bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-slate-blue)] focus:ring-[var(--aos-slate-blue)]",
    danger: "bg-[var(--aos-risk)] text-[var(--fg-on-dark)] hover:opacity-90 focus:ring-[var(--aos-risk)]",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className = '', ...props }) => (
  <label className={`block text-sm font-medium text-[var(--fg-2)] mb-1.5 ${className}`} {...props} />
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input className={`block w-full rounded-md border-[var(--aos-mist)] shadow-sm focus:border-[var(--aos-steel-blue)] focus:ring-[var(--aos-steel-blue)] sm:text-sm px-3 py-2 border placeholder-[var(--fg-3)] ${className}`} {...props} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => (
  <div className="relative">
    <select className={`block w-full appearance-none rounded-md border-[var(--aos-mist)] shadow-sm focus:border-[var(--aos-steel-blue)] focus:ring-[var(--aos-steel-blue)] sm:text-sm px-3 py-2 border bg-[var(--bg-surface)] text-[var(--fg-1)] ${className}`} {...props} />
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--fg-3)]">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </div>
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'orange'; className?: string }> = ({ children, color = 'gray', className = '' }) => {
  const colors = {
    gray: 'bg-[var(--bg-canvas)] text-[var(--fg-2)]',
    blue: 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)]',
    green: 'bg-[var(--aos-success-tint)] text-[var(--aos-success)]',
    red: 'bg-[var(--aos-risk-tint)] text-[var(--aos-risk)]',
    yellow: 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)]',
    orange: 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)]',
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
  className?: string;
}> = ({ title, subtitle, isOpen, onToggle, children, status = 'not-started', className = '' }) => {
  return (
    <div className={`border border-[var(--aos-mist)] rounded-lg bg-[var(--bg-surface)] overflow-hidden transition-all ${isOpen ? 'ring-1 ring-[var(--aos-mist)] shadow-sm' : ''} ${className}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-canvas)] transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="text-lg font-medium text-[var(--fg-1)]">{title}</div>
            {isOpen && status !== 'not-started' && (
              <Badge color={status === 'complete' ? 'green' : 'yellow'}>
                {status === 'complete' ? 'Complete' : 'In Progress'}
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-sm text-[var(--fg-3)] mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {!isOpen && (
            <div className="flex items-center gap-2 text-xs text-[var(--fg-3)]">
              <span>Status:</span>
              <span className={`h-2.5 w-2.5 rounded-full ${status === 'complete' ? 'bg-[var(--aos-success)]' :
                status === 'in-progress' ? 'bg-[var(--aos-warning)]' : 'border border-[var(--aos-mist)]'
                }`} />
              <span>
                {status === 'complete' ? 'Complete' : status === 'in-progress' ? 'In Progress' : 'Not Started'}
              </span>
            </div>
          )}
          {isOpen ? <ChevronUp className="h-5 w-5 text-[var(--fg-3)]" /> : <ChevronDown className="h-5 w-5 text-[var(--fg-3)]" />}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-[var(--aos-mist)] p-6 bg-[var(--bg-canvas)]">
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
  <div className="flex p-1 bg-[var(--bg-canvas)] rounded-lg">
    {options.map((option) => (
      <button
        key={option.value}
        onClick={() => onChange(option.value)}
        className={`
          flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all
          ${value === option.value
            ? 'bg-[var(--bg-surface)] text-[var(--fg-1)] shadow-sm'
            : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'}
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
    <div className={`h-2 bg-[var(--bg-canvas)] rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-[var(--aos-brass)] transition-all duration-300 ease-out"
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
            ? 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)]'
            : 'border-[var(--aos-mist)] hover:bg-[var(--bg-canvas)]'}
        `}
      >
        <div className="flex items-center h-5">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 text-[var(--aos-brass)] border-[var(--aos-mist)] focus:ring-[var(--aos-brass)]"
          />
        </div>
        <div className="ml-3 text-sm">
          <span className={`font-medium ${value === option.value ? 'text-[var(--fg-1)]' : 'text-[var(--fg-1)]'}`}>
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
      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--aos-brass)] focus:ring-offset-2
      ${checked ? 'bg-[var(--aos-brass)]' : 'bg-[var(--aos-mist)]'}
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
      className="w-full h-2 bg-[var(--aos-mist)] rounded-lg appearance-none cursor-pointer accent-[var(--aos-brass)] focus:outline-none focus:ring-2 focus:ring-[var(--aos-brass)] focus:ring-offset-2"
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
  <div className={`inline-flex h-10 items-center justify-center rounded-lg bg-[var(--bg-canvas)] p-1 text-[var(--fg-3)] ${className}`}>
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
        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aos-brass)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
        ${isActive ? 'bg-[var(--bg-surface)] text-[var(--fg-1)] shadow-sm' : 'hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]'}
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
    <div className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aos-brass)] focus-visible:ring-offset-2 ${className}`}>
      {children}
    </div>
  );
};


export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-[var(--fg-1)] tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-[var(--fg-3)]">{subtitle}</p>}
    </div>
    {actions && <div>{actions}</div>}
  </div>
);

interface TabNavProps {
  tabs: { label: string; href: string; isLocked?: boolean }[];
}

export const TabNav: React.FC<TabNavProps> = ({ tabs }) => {
  const location = useLocation();
  const { featureGatesBypassed, isFeatureUnlocked } = useApp();

  return (
    <div className="border-b border-[var(--aos-mist)] mb-8 overflow-x-auto">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = location.pathname.includes(tab.href);
          const featureKey = getFeatureKeyForPath(tab.href);
          const gate = getFeatureGate(featureKey);
          const isWeeklyLocked = !isFeatureUnlocked(featureKey);

          if (!featureGatesBypassed && (tab.isLocked || isWeeklyLocked)) {
            return (
              <div
                key={tab.href}
                className="whitespace-nowrap py-4 px-1 border-b-2 border-transparent text-[var(--fg-3)] font-medium text-sm flex items-center gap-2 cursor-not-allowed"
                title={isWeeklyLocked ? getFeatureLockMessage(featureKey) : 'This tab is currently locked.'}
              >
                <Lock className="w-4 h-4" />
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
            <Link
              key={tab.href}
              to={tab.href}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${isActive
                  ? 'border-[var(--aos-brass)] text-[var(--aos-brass)]'
                  : 'border-transparent text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:border-[var(--aos-mist)]'}
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
  <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[var(--aos-mist)] rounded-lg bg-[var(--bg-canvas)] p-6 text-center">
    <div className="text-[var(--fg-3)] mb-2">
      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </div>
    <h3 className="text-sm font-medium text-[var(--fg-1)]">{text}</h3>
    <p className="mt-1 text-sm text-[var(--fg-3)]">This module is under construction.</p>
  </div>
);

// --- Table Components ---
export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className = '', ...props }) => (
  <div className="w-full overflow-auto">
    <table className={`w-full caption-bottom text-sm ${className}`} {...props} />
  </div>
);
export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
  <thead className={`[&_tr]:border-b ${className}`} {...props} />
);
export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
);
export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className = '', ...props }) => (
  <tr className={`border-b transition-colors hover:bg-[var(--bg-canvas)] data-[state=selected]:bg-[var(--bg-canvas)] ${className}`} {...props} />
);
export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
  <th className={`h-12 px-4 text-left align-middle font-medium text-[var(--fg-3)] [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
);
export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
);

// --- Checkbox ---
export const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input type="checkbox" className={`h-4 w-4 rounded border-[var(--aos-mist)] text-[var(--aos-brass)] focus:ring-[var(--aos-brass)] ${className}`} {...props} />
);

// --- Popover Context & Components ---
interface PopoverContextType { open: boolean; setOpen: (v: boolean) => void; }
const PopoverContext = React.createContext<PopoverContextType | null>(null);

export const Popover: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">{children}</div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({ asChild, children }) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) return null;
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.setOpen(!ctx.open);
  };
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, { onClick: handleClick });
  }
  return <button onClick={handleClick}>{children}</button>;
};

export const PopoverContent: React.FC<{ children: React.ReactNode; align?: 'start' | 'center' | 'end'; className?: string }> = ({ children, align = 'center', className = '' }) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx || !ctx.open) return null;

  // Alignment styles
  let alignClass = 'left-1/2 -translate-x-1/2';
  if (align === 'start') alignClass = 'left-0';
  if (align === 'end') alignClass = 'right-0';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => ctx.setOpen(false)} />
      <div className={`absolute z-50 mt-2 rounded-md border bg-[var(--bg-surface)] shadow-md outline-none animate-in fade-in-0 zoom-in-95 ${alignClass} ${className}`}>
        {children}
      </div>
    </>
  );
};

// --- Tooltip ---
interface TooltipContextType { open: boolean; setOpen: (v: boolean) => void; }
const TooltipContext = React.createContext<TooltipContextType | null>(null);

export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

export const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

export const TooltipTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({ asChild, children }) => {
  return <>{children}</>;
};

export const TooltipContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const ctx = React.useContext(TooltipContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div className={`absolute z-50 px-3 py-1.5 text-xs font-medium text-[var(--fg-on-dark)] bg-[var(--bg-inverse)] rounded shadow-sm -top-10 left-1/2 -translate-x-1/2 animate-in fade-in-0 zoom-in-95 ${className}`}>
      {children}
      <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-[var(--bg-inverse)]" />
    </div>
  );
};

export const LoadingSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
