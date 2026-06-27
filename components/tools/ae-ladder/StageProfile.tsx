import React, { useEffect, useState } from 'react';
import { LockedState } from './shared/LockedState';
import {
    LadderOverviewBlock,
    StageSummaryBlock,
    StagePositionBlock,
    TrainingTeaserBlock
} from './stage/StageContentBlocks';
import { STAGE_CONTENT, BAND_CONTENT } from '@/config/ae-ladder-content';
import { StageContent, BandContent } from '@/components/tools/ae-ladder/types';

export const AEStageProfile: React.FC = () => {
    const [isLocked, setIsLocked] = useState(true);
    const [stageData, setStageData] = useState<StageContent | null>(null);
    const [bandData, setBandData] = useState<BandContent | null>(null);

    useEffect(() => {
        // V1 Logic: Check localStorage for 'ae_assessment_completed' flag
        const isCompleted = localStorage.getItem('ae_assessment_completed') === 'true';
        setIsLocked(!isCompleted);

        // In a real app, we would fetch the user's result to get their stage/band ID
        // For V1 PROTOTYPE: Hardcoding 'Striving' and 'striving_early' to match the dashboard mock
        if (isCompleted) {
            setStageData(STAGE_CONTENT['Striving']);
            setBandData(BAND_CONTENT['striving_early']);
        }
    }, [isLocked]); // Re-run if locked state changes (e.g. after completion flow) or on mount

    if (isLocked) {
        return <LockedState title="Stage Profile Locked" message="Complete the assessment to unlock your detailed stage profile and growth roadmap." />;
    }

    if (!stageData || !bandData) return <div>Loading...</div>;

    return (
        <div className="space-y-12 pb-12 animate-in fade-in duration-700 w-full">
            {/* 1. Universal Context */}
            <LadderOverviewBlock />

            {/* 2. Stage Specific Deep Dive */}
            <StageSummaryBlock stage={stageData} />

            {/* 3. Band/Position Nuance */}
            <StagePositionBlock band={bandData} />

            {/* 4. Training CTA */}
            <TrainingTeaserBlock />
        </div>
    );
};
