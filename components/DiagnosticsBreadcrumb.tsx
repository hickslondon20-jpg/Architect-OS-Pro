import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  diagnostics: 'Diagnostics',
  'ae-ladder': 'AE Ladder',
  intro: 'Intro',
  assessment: 'Assessment',
  'results-dashboard': 'Results Dashboard',
  'stage-profile': 'Stage Profile',
  'mr-audit': 'M&R Audit',
  overview: 'Overview',
  results: 'Results',
};

interface Crumb {
  label: string;
  href: string;
  isCurrent: boolean;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const diagIndex = segments.indexOf('diagnostics');
  if (diagIndex === -1) return [];
  const diagSegments = segments.slice(diagIndex);

  const crumbs: Crumb[] = [];
  let cumulativePath = '';

  diagSegments.forEach((seg, i) => {
    cumulativePath += `/${seg}`;
    const isCurrent = i === diagSegments.length - 1;

    if (seg === 'diagnostics') {
      crumbs.push({ label: 'Diagnostics', href: '/diagnostics', isCurrent });
      return;
    }

    const label =
      SEGMENT_LABELS[seg] ??
      seg
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    crumbs.push({ label, href: cumulativePath, isCurrent });
  });

  return crumbs;
}

export const DiagnosticsBreadcrumb: React.FC = () => {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 mb-4"
      style={{ fontSize: '0.8125rem', lineHeight: '1.25rem' }}
    >
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.href + i}>
          {crumb.isCurrent ? (
            <span
              className="font-medium"
              style={{ color: 'var(--fg-2)' }}
              aria-current="page"
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.href}
              className="transition-colors hover:underline"
              style={{ color: 'var(--fg-3)' }}
            >
              {crumb.label}
            </Link>
          )}
          {!crumb.isCurrent && (
            <ChevronRight
              size={13}
              style={{ color: 'var(--fg-4)', flexShrink: 0 }}
            />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
