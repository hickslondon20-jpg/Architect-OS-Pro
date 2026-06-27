import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  onClick?: () => void;
}

export const Breadcrumb: React.FC<{ crumbs: Crumb[] }> = ({ crumbs }) => (
  <nav className="flex items-center gap-1.5 text-sm mb-5" aria-label="Breadcrumb">
    {crumbs.map((crumb, i) => {
      const isLast = i === crumbs.length - 1;
      return (
        <React.Fragment key={`${crumb.label}-${i}`}>
          {crumb.onClick && !isLast ? (
            <button
              onClick={crumb.onClick}
              className="text-[var(--fg-3)] hover:text-[var(--aos-brass)] transition-colors"
            >
              {crumb.label}
            </button>
          ) : (
            <span className={isLast ? 'font-medium text-[var(--fg-1)]' : 'text-[var(--fg-3)]'}>
              {crumb.label}
            </span>
          )}
          {!isLast && <ChevronRight size={14} className="text-[var(--fg-4)]" />}
        </React.Fragment>
      );
    })}
  </nav>
);
