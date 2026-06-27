export type Dimension = 'Financial Health' | 'Client Portfolio' | 'Operations' | 'Team Structure' | 'Strategic Stewardship';
export type StageFit = 'Below Stage' | 'At Stage' | 'Ahead of Stage';
export type BucketType = 'PRIORITIZE' | 'PLANT' | 'ITERATE' | 'PARKING_LOT';

export interface Capability {
    id: string;
    name: string;
    dimension: Dimension;
    maturity: number;
    stageFit: StageFit;
    rank: number;
    description?: string; // Short description if available
}

export interface Selection {
    capabilityId: string;
    bucket: BucketType;
}

export interface ReferenceContext {
    twelveMonthTheme: string;
    focusAreas: string[];
    aeStage: string;
}
