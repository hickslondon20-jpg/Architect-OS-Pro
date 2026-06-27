import React, { useState, useEffect } from 'react';
import { Button } from '../../ui';
import { History, Target, Sprout, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabaseClient';

import { Capability, Dimension, BucketType, Selection, ReferenceContext } from './types';
import { ReferenceStrip } from './ReferenceStrip';
import { CapabilityGridCard } from './CapabilityGridCard';
import { CapabilityExpandedView } from './CapabilityExpandedView';
import { ThreePColumn } from './ThreePColumn';
import { ParkingLotColumn } from './ParkingLotColumn';
import { SelectionCounterBar } from './SelectionCounterBar';

interface ThreePExerciseProps {
  headingLabel?: string;
  /** Called when user clicks "Continue" after locking (Sprint Planning context only) */
  onPostLock?: () => void;
}

const DIMENSIONS: Dimension[] = ['Financial Health', 'Client Portfolio', 'Operations', 'Team Structure', 'Strategic Stewardship'];

const FALLBACK_CAPABILITIES: Capability[] = [
  { id: 'fallback-workflow-efficiency', name: 'Workflow Efficiency', description: 'Improve repeated delivery and operating work.', dimension: 'Operations', maturity: 42, rank: 1, stageFit: 'At Stage' },
  { id: 'fallback-role-clarity', name: 'Role Clarity & Ownership Design', description: 'Clarify ownership for decisions, delivery, and accountability.', dimension: 'Operations', maturity: 38, rank: 2, stageFit: 'At Stage' },
  { id: 'fallback-forecasting', name: 'Forecasting & Visibility', description: 'Strengthen visibility into cash, capacity, and demand.', dimension: 'Financial Health', maturity: 31, rank: 3, stageFit: 'At Stage' },
  { id: 'fallback-sops', name: 'SOPs & Knowledge Transfer', description: 'Document repeatable knowledge so delivery does not depend on memory.', dimension: 'Operations', maturity: 35, rank: 4, stageFit: 'At Stage' },
  { id: 'fallback-reinvestment', name: 'Reinvestment & Growth Readiness', description: 'Create room to reinvest in the systems growth requires.', dimension: 'Financial Health', maturity: 44, rank: 5, stageFit: 'At Stage' },
  { id: 'fallback-performance', name: 'Performance Mgmt & Accountability Systems', description: 'Make performance expectations visible and easy to manage.', dimension: 'Team Structure', maturity: 48, rank: 6, stageFit: 'At Stage' },
  { id: 'fallback-culture', name: 'Culture, Communication & Team Rhythm', description: 'Improve the cadence and clarity of team communication.', dimension: 'Team Structure', maturity: 46, rank: 7, stageFit: 'At Stage' },
  { id: 'fallback-decision-governance', name: 'Strategic Planning & Decision Governance', description: 'Create a stronger rhythm for strategic decisions and tradeoffs.', dimension: 'Strategic Stewardship', maturity: 41, rank: 8, stageFit: 'At Stage' },
  { id: 'fallback-talent', name: 'Talent Development', description: 'Build capability inside the team instead of relying on founder effort.', dimension: 'Team Structure', maturity: 40, rank: 9, stageFit: 'At Stage' },
  { id: 'fallback-margin', name: 'Margin Discipline', description: 'Protect profitability as operational complexity grows.', dimension: 'Financial Health', maturity: 36, rank: 10, stageFit: 'At Stage' },
  { id: 'fallback-cash-flow', name: 'Cash Flow Mgmt.', description: 'Stabilize the cash rhythm needed to execute with confidence.', dimension: 'Financial Health', maturity: 37, rank: 11, stageFit: 'At Stage' },
  { id: 'fallback-transferability', name: 'Transferability & Continuity Design', description: 'Reduce single-point dependency across operations and delivery.', dimension: 'Strategic Stewardship', maturity: 34, rank: 12, stageFit: 'At Stage' },
  { id: 'fallback-pipeline', name: 'Pipeline Health', description: 'Improve reliability and quality of future opportunity flow.', dimension: 'Client Portfolio', maturity: 43, rank: 13, stageFit: 'At Stage' },
  { id: 'fallback-portfolio', name: 'Portfolio Optimization', description: 'Shape the client mix toward better-fit, more profitable work.', dimension: 'Client Portfolio', maturity: 39, rank: 14, stageFit: 'At Stage' },
  { id: 'fallback-retention', name: 'Retention & Relationship Maturity', description: 'Deepen client relationships and reduce avoidable churn.', dimension: 'Client Portfolio', maturity: 45, rank: 15, stageFit: 'At Stage' },
  { id: 'fallback-resilience', name: 'Financial Resilience', description: 'Strengthen the agency against volatility and surprise costs.', dimension: 'Financial Health', maturity: 33, rank: 16, stageFit: 'At Stage' },
];

export const ThreePExercise: React.FC<ThreePExerciseProps> = ({
  headingLabel = 'Current Quarter Focus',
  onPostLock,
}) => {
  const { user } = useAuth();

  const [quarter, setQuarter] = useState('Q1 2026');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [referenceContext, setReferenceContext] = useState<ReferenceContext | undefined>();
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        if (!user) {
          setCapabilities(FALLBACK_CAPABILITIES);
          setReferenceContext({
            twelveMonthTheme: 'Transition from Founder-Led Sales to System-Led Acquisition',
            focusAreas: [
              'Productize core service offering',
              'Implement predictable outbound engine',
              'Standardize pricing and scoping',
            ],
            aeStage: 'Striving',
          });
          return;
        }

        const { data: assessmentData } = await supabase
          .from('gm_assessments')
          .select('assessment_id, calibration_stage_id')
          .eq('respondent_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let fetchedCaps: Capability[] = [];

        if (assessmentData) {
          const assessmentId = assessmentData.assessment_id;

          const { data: capData } = await supabase
            .from('gm_assessment_capability_scores')
            .select(`
capability_id,
    maturity_pct,
    gm_capabilities: capability_id(
        capability_name,
        capability_summary,
        gm_dimensions(dimension_name)
    )
            `)
            .eq('assessment_id', assessmentId);

          const { data: rankData } = await supabase
            .from('gm_capability_rankings')
            .select('capability_id, priority_rank, stage_fit_variance_flag')
            .eq('assessment_id', assessmentId);

          const rankMap = new Map(rankData?.map((r: any) => [r.capability_id, r]) || []);

          if (capData) {
            fetchedCaps = capData.map((cap: any, index: number) => {
              const capMeta = Array.isArray(cap.gm_capabilities) ? cap.gm_capabilities[0] : cap.gm_capabilities;
              const dimMeta = capMeta?.gm_dimensions;
              const dimName = Array.isArray(dimMeta) ? dimMeta[0]?.dimension_name : dimMeta?.dimension_name;
              const rankingInfo = rankMap.get(cap.capability_id) as any;

              return {
                id: cap.capability_id,
                name: capMeta?.capability_name || cap.capability_id,
                description: capMeta?.capability_summary || '',
                dimension: (dimName || 'Operations') as Dimension,
                maturity: cap.maturity_pct !== null ? cap.maturity_pct * 100 : 0,
                rank: rankingInfo?.priority_rank || index + 1,
                stageFit: rankingInfo?.stage_fit_variance_flag || 'At Stage',
              };
            });
            fetchedCaps.sort((a, b) => a.rank - b.rank);
          }
        }

        setCapabilities(fetchedCaps.length > 0 ? fetchedCaps : FALLBACK_CAPABILITIES);

        setReferenceContext({
          twelveMonthTheme: 'Transition from Founder-Led Sales to System-Led Acquisition',
          focusAreas: [
            'Productize core service offering',
            'Implement predictable outbound engine',
            'Standardize pricing and scoping',
          ],
          aeStage: 'Striving',
        });

        const { data: selectionData } = await supabase
          .from('quarter_map_selections')
          .select('selections, status, synthesis_output')
          .eq('user_id', user.id)
          .eq('quarter_name', 'Q1 2026')
          .maybeSingle();

        if (selectionData) {
          setSelections(selectionData.selections || []);
        }
      } catch (err) {
        console.error('Error loading 3P data:', err);
        setCapabilities(FALLBACK_CAPABILITIES);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadInitialData();
  }, [user, quarter]);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeDimension, setActiveDimension] = useState<string | 'All'>('All');
  const [sortBy, setSortBy] = useState<'rank' | 'maturity_asc' | 'maturity_desc'>('rank');
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);

  const selectedCap = selectedCapabilityId ? capabilities.find(c => c.id === selectedCapabilityId) : null;
  const selectedCapBucket = selections.find(s => s.capabilityId === selectedCapabilityId)?.bucket;

  const prioritizeItems = selections.filter(s => s.bucket === 'PRIORITIZE').map(s => capabilities.find(c => c.id === s.capabilityId)!).filter(Boolean);
  const plantItems = selections.filter(s => s.bucket === 'PLANT').map(s => capabilities.find(c => c.id === s.capabilityId)!).filter(Boolean);
  const iterateItems = selections.filter(s => s.bucket === 'ITERATE').map(s => capabilities.find(c => c.id === s.capabilityId)!).filter(Boolean);
  const parkingLotItems = selections.filter(s => s.bucket === 'PARKING_LOT').map(s => capabilities.find(c => c.id === s.capabilityId)!).filter(Boolean);

  const getCollapsedDimension = (dim: string) => {
    const mapping: Record<string, string> = {
      'Financial & Business Health': 'Financial',
      'Financial Health': 'Financial',
      'Client Base & Market Positioning': 'Positioning',
      'Client Portfolio': 'Positioning',
      'Operational Efficiency & Scalability': 'Ops',
      'Operations': 'Ops',
      'Team Structure & Leadership': 'Team',
      'Team Structure': 'Team',
      'Vision & Strategic Stewardship': 'Stewardship',
      'Strategic Stewardship': 'Stewardship',
    };
    return mapping[dim] || dim;
  };

  const filteredCapabilities = capabilities
    .filter(cap => {
      const matchesSearch = cap.name.toLowerCase().includes(searchTerm.toLowerCase());
      const capFilterDim = getCollapsedDimension(cap.dimension);
      const matchesDim = activeDimension === 'All' || capFilterDim === activeDimension;
      const isSelected = selections.some(s => s.capabilityId === cap.id);
      return matchesSearch && matchesDim && !isSelected;
    })
    .sort((a, b) => {
      if (sortBy === 'maturity_asc') return a.maturity - b.maturity;
      if (sortBy === 'maturity_desc') return b.maturity - a.maturity;
      return a.rank - b.rank;
    });

  const handleAdd = (capId: string, bucket: BucketType) => {
    const bucketCount = selections.filter(s => s.bucket === bucket).length;
    if (bucket !== 'PARKING_LOT' && bucketCount >= 3) {
      alert(`The ${bucket} bucket is full (max 3). Remove an item first.`);
      return;
    }
    const updated = selections.filter(s => s.capabilityId !== capId);
    setSelections([...updated, { capabilityId: capId, bucket }]);
  };

  const handleRemove = (capId: string) => {
    setSelections(selections.filter(s => s.capabilityId !== capId));
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, capId: string) => {
    e.dataTransfer.setData('capabilityId', capId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(capId);
  };
  const handleDragEnd = () => setDraggingId(null);

  const handleDropOnBucket = (capId: string, targetBucket: BucketType) => {
    setDraggingId(null);
    const current = selections.find(s => s.capabilityId === capId);
    if (!current || current.bucket === targetBucket) return;
    if (targetBucket !== 'PARKING_LOT') {
      const count = selections.filter(s => s.bucket === targetBucket).length;
      if (count >= 3) { alert(`The ${targetBucket} bucket is full (max 3). Remove an item first.`); return; }
    }
    setSelections(prev => prev.map(s => s.capabilityId === capId ? { ...s, bucket: targetBucket } : s));
  };

  const handleLock = async () => {
    if (!user) {
      onPostLock?.();
      return;
    }

    try {
      await supabase
        .from('quarter_map_selections')
        .upsert(
          { user_id: user.id, quarter_name: quarter, selections, status: 'locked' },
          { onConflict: 'user_id, quarter_name' }
        );
    } catch (error) {
      console.error('Lock error:', error);
    }

    setTimeout(async () => {
      const mockGen =
        'Your Q1 focus centers on building the financial and operational infrastructure that your 12-month trajectory depends on. By Prioritizing Cash Flow Forecasting, Role Clarity, and Delivery Process, you\'re addressing the foundational visibility gaps that, if left unresolved, compound in complexity as the agency scales. The capabilities you\'ve chosen to Plant signal forward thinking on positioning — work that won\'t pay off this quarter but that you\'re beginning to seed. The Iterate selections show a mature recognition of what\'s already working and simply needs to be maintained. This is a disciplined, sequenced quarter.';
      await supabase
        .from('quarter_map_selections')
        .update({ synthesis_output: mockGen })
        .eq('user_id', user.id)
        .eq('quarter_name', quarter);
      onPostLock?.();
    }, 2000);
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    try {
      await supabase
        .from('quarter_map_selections')
        .upsert(
          { user_id: user.id, quarter_name: quarter, selections, status: 'draft' },
          { onConflict: 'user_id, quarter_name' }
        );
    } catch (error) {
      console.error('Draft save error:', error);
    }
  };

  const scrollToGrid = () => {
    document.getElementById('capability-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] pb-32">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: var(--aos-mist); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: var(--aos-cool-gray); }
      `}</style>

      {/* Sticky Header */}
      <div
        className="sticky top-[60px] z-30 flex items-center justify-between border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 md:px-8"
        style={{ boxShadow: 'var(--shadow-soft-1)' }}
      >
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--fg-1)] hidden md:block">{headingLabel}</h1>
            <span className="text-xs text-[var(--fg-3)] font-medium md:hidden">3P Framework</span>
          </div>
          <div className="h-8 w-px bg-[var(--aos-mist)] hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--fg-3)]">Planning for:</span>
            <select
              value={quarter}
              onChange={e => setQuarter(e.target.value)}
              className="text-sm font-bold text-[var(--fg-1)] bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option>Q1 2026</option>
              <option>Q2 2026</option>
              <option>Q3 2026</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="hidden md:flex">
            <History className="w-4 h-4 mr-2" /> History
          </Button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-8 sm:px-5 lg:px-10 space-y-8">
        {referenceContext && <ReferenceStrip context={referenceContext} />}

        {isLoadingData ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-[var(--aos-brass-tint)] border-t-[var(--aos-brass)] rounded-full animate-spin mx-auto" />
            <p className="text-lg font-medium text-[var(--fg-1)]">Loading Capabilities...</p>
          </div>
        ) : (
          <>
            <div id="capability-grid" className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--fg-1)]">Capability Selection</h2>
                      <p className="text-sm text-[var(--fg-3)]">Choose 9 capabilities to focus on this quarter.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className="text-sm border-[var(--aos-mist)] rounded-md shadow-sm focus:border-[var(--aos-brass)] focus:ring-[var(--aos-brass)]"
                      >
                        <option value="rank">Sort by Rank</option>
                        <option value="maturity_asc">Maturity (Low to High)</option>
                        <option value="maturity_desc">Maturity (High to Low)</option>
                      </select>
                    </div>
                  </div>

                  <div
                    className="flex flex-col items-start justify-between gap-4 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-center"
                    style={{ boxShadow: 'var(--shadow-soft-1)' }}
                  >
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setActiveDimension('All')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeDimension === 'All' ? 'bg-[var(--aos-brass)] text-[var(--aos-cloud)]' : 'bg-[var(--bg-sunken)] text-[var(--fg-2)] hover:bg-[var(--aos-brass-tint)]'}`}
                      >
                        All
                      </button>
                      {['Financial', 'Positioning', 'Ops', 'Team', 'Stewardship'].map(d => (
                        <button
                          key={d}
                          onClick={() => setActiveDimension(d)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeDimension === d ? 'bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] border border-[var(--aos-brass)]' : 'bg-[var(--bg-surface)] text-[var(--fg-2)] border border-[var(--aos-mist)] hover:bg-[var(--bg-sunken)]'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <div className="w-full sm:max-w-xs">
                      <input
                        type="text"
                        placeholder="Search capabilities..."
                        className="w-full px-4 py-1.5 border border-[var(--aos-mist)] rounded-md text-sm focus:ring-2 focus:ring-[var(--aos-brass)] outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredCapabilities.map(cap => (
                      <div key={cap.id} className="h-[120px]">
                        <CapabilityGridCard capability={cap} onAdd={handleAdd} onClick={setSelectedCapabilityId} />
                      </div>
                    ))}
                  </div>
                  {filteredCapabilities.length === 0 && (
                    <div className="rounded-[var(--radius-xs)] border border-dashed border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-12 text-center">
                      <p className="text-[var(--fg-3)] font-medium">No capabilities remaining in this view.</p>
                    </div>
                  )}
            </div>

            <div className="space-y-4 border-t border-[var(--aos-mist)] pt-8">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--fg-1)]">Organize Your Focus</h2>
                    <p className="text-sm text-[var(--fg-3)]">Allocate 3 capabilities into each tactical bucket.</p>
                  </div>
                  <div className="flex flex-col lg:flex-row gap-4">
                    <ThreePColumn
                      title="Prioritize"
                      subtitle="Core focus this quarter. Building right now."
                      icon={<Target className="w-5 h-5 text-[var(--aos-insight)]" />}
                      colorClass="bg-[var(--aos-insight-tint)]"
                      bucket="PRIORITIZE"
                      items={prioritizeItems}
                      onRemove={handleRemove}
                      onItemClick={setSelectedCapabilityId}
                      onAddClick={scrollToGrid}
                      draggingId={draggingId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDropOnBucket}
                    />
                    <ThreePColumn
                      title="Plant"
                      subtitle="Groundwork for the next horizon. Seed level work."
                      icon={<Sprout className="w-5 h-5 text-[var(--aos-brass)]" />}
                      colorClass="bg-[var(--aos-brass-tint)]"
                      bucket="PLANT"
                      items={plantItems}
                      onRemove={handleRemove}
                      onItemClick={setSelectedCapabilityId}
                      onAddClick={scrollToGrid}
                      draggingId={draggingId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDropOnBucket}
                    />
                    <ThreePColumn
                      title="Iterate"
                      subtitle="Maintain, refine, and optimize."
                      icon={<RefreshCw className="w-5 h-5 text-[var(--aos-success)]" />}
                      colorClass="bg-[var(--aos-success-tint)]"
                      bucket="ITERATE"
                      items={iterateItems}
                      onRemove={handleRemove}
                      onItemClick={setSelectedCapabilityId}
                      onAddClick={scrollToGrid}
                      draggingId={draggingId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDropOnBucket}
                    />
                    <ParkingLotColumn
                      items={parkingLotItems}
                      onRemove={handleRemove}
                      onItemClick={setSelectedCapabilityId}
                      draggingId={draggingId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDropOnBucket}
                    />
                  </div>
            </div>
          </>
        )}
      </div>

      {!isLoadingData && (
        <SelectionCounterBar
          prioritizeCount={prioritizeItems.length}
          plantCount={plantItems.length}
          iterateCount={iterateItems.length}
          onSaveDraft={handleSaveDraft}
          onLock={handleLock}
        />
      )}

      {selectedCap && (
        <CapabilityExpandedView
          capability={selectedCap}
          onClose={() => setSelectedCapabilityId(null)}
          onAdd={handleAdd}
          currentBucket={selectedCapBucket}
          onRemove={selectedCapBucket ? handleRemove : undefined}
        />
      )}
    </div>
  );
};
