import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  // Hub level
  planning: 'Planning',
  execution: 'Execution',
  intelligence: 'Intelligence',
  // Planning sub-pages
  roadmap: 'Strategic Roadmap',
  'quarter-map': 'Quarter Map',
  'sprint-planning': 'Sprint Planning',
  // Planning sub-tabs
  orientation: 'Orientation',
  horizons: 'Horizons',
  '12-month-plan': '12-Month Plan',
  sequence: 'Sequence',
  'current-quarter': 'Current Quarter',
  'sprint-goal': 'Sprint Goal',
  prioritization: 'Prioritization',
  board: 'Board',
  review: 'Review',
  synthesis: 'Synthesis',
  'initiative-library': 'Initiative Library',
  'milestone-builder': 'Milestone Builder',
  // Execution sub-pages
  orient: 'Orient',
  operate: 'Operate',
  reflect: 'Reflect',
  // Execution sub-tabs
  overview: 'Overview',
  alignment: 'Alignment',
  timeline: 'Timeline',
  'status-tracker': 'Status Tracker',
  'wind-down': 'Wind Down',
  retrospective: 'Retrospective',
  'reflection-review': 'Reflection Review',
  // Intelligence tools
  'virtual-cso': 'Virtual CSO',
  'os-engine': 'OS Engine',
};

interface Crumb {
  label: string;
  href: string;
  isCurrent: boolean;
}

function buildCrumbs(pathname: string): Crumb[] {
  // Strip trailing slash, split, filter empty
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  // Must start with 'pro'
  const proIndex = segments.indexOf('pro');
  if (proIndex === -1) return [];
  const proSegments = segments.slice(proIndex);

  const crumbs: Crumb[] = [];
  let cumulativePath = '';

  proSegments.forEach((seg, i) => {
    cumulativePath += `/${seg}`;
    const isCurrent = i === proSegments.length - 1;

    // First segment is always 'pro' → label = 'Overview'
    if (seg === 'pro') {
      crumbs.push({ label: 'Overview', href: '/pro', isCurrent });
      return;
    }

    const label = SEGMENT_LABELS[seg] ?? seg
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    crumbs.push({ label, href: cumulativePath, isCurrent });
  });

  return crumbs;
}

export const ProBreadcrumb: React.FC = () => {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  // Don't render if we're at /pro (just "Overview" with no trail)
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
