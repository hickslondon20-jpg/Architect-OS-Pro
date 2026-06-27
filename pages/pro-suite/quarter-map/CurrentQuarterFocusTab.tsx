import React, { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '../../../components/ui';
import { QuarterPostureBlock } from '../../../components/pro-suite/quarter-map/QuarterPostureBlock';
import { ReferenceStrip } from '../../../components/pro-suite/quarter-map/ReferenceStrip';
import { ReferenceContext } from '../../../components/pro-suite/quarter-map/types';

const quarterCopy: Record<string, string> = {
  'Q1 2026': 'Your current quarter is the first practical translation of the 12-month trajectory. The longer horizon has already defined where the agency is moving; this quarter narrows that direction into the immediate operating posture required now. The work ahead is to stabilize the foundations implied by the 36-, 24-, and 12-month view, confirm the first-quarter emphasis, and carry that context into Sprint Planning so the next sprint begins from the same strategic readback.',
  'Q2 2026': 'This quarter represents the second movement in the 12-month sequence. The first quarter establishes the baseline; Q2 should convert that early structure into a stronger operating rhythm. The purpose of this checkpoint is to keep the sprint plan connected to the longer 36-, 24-, and 12-month horizon path before the next planning decisions are made.',
  'Q3 2026': 'This quarter sits at the midpoint-to-acceleration layer of the annual plan. By this stage, the quarter sequence should show which operating patterns are becoming reliable and where the next sprint needs to preserve momentum. Use this readback to keep the immediate plan anchored to the broader horizon commitments.',
  'Q4 2026': 'This quarter closes the annual sequence and prepares the agency for the next horizon cycle. The current-quarter posture should clarify what must be finished, reinforced, or carried forward so the 12-month trajectory resolves into a stronger starting point for the next planning arc.',
};

const referenceContext: ReferenceContext = {
  twelveMonthTheme: 'Establish the operating foundation required for the 12-month trajectory while keeping the next sprint connected to the larger 36- and 24-month vision.',
  focusAreas: [
    'Translate the long-range vision into the immediate quarter sequence.',
    'Confirm what the current quarter needs to make true before Sprint Planning begins.',
    'Carry the quarter readback into the sprint goal and board-building workflow.',
  ],
  aeStage: 'Current Quarter',
};

export const CurrentQuarterFocusTab: React.FC = () => {
  const [quarter, setQuarter] = useState('Q1 2026');

  const synthesisText = useMemo(() => quarterCopy[quarter] || quarterCopy['Q1 2026'], [quarter]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div
        className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-4 md:px-8"
        style={{ boxShadow: 'var(--shadow-soft-1)' }}
      >
        <div className="flex items-center gap-4">
          <div>
            <h1 className="hidden text-xl font-bold text-[var(--fg-1)] md:block">Current Quarter Focus</h1>
            <span className="text-xs font-medium text-[var(--fg-3)] md:hidden">Current Quarter</span>
          </div>
          <div className="hidden h-8 w-px bg-[var(--aos-mist)] md:block" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--fg-3)]">Planning for:</span>
            <select
              value={quarter}
              onChange={e => setQuarter(e.target.value)}
              className="cursor-pointer border-none bg-transparent text-sm font-bold text-[var(--fg-1)] focus:ring-0"
            >
              <option>Q1 2026</option>
              <option>Q2 2026</option>
              <option>Q3 2026</option>
              <option>Q4 2026</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="hidden md:flex">
            <History className="mr-2 h-4 w-4" /> History
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-8 p-4 md:p-8">
        <ReferenceStrip context={referenceContext} />
        <QuarterPostureBlock synthesisText={synthesisText} isGenerating={false} />
      </div>
    </div>
  );
};
