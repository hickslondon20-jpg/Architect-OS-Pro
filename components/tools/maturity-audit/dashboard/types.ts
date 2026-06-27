export interface MRAuditResults {
    // Week 3: Maturity ("Current State")
    maturityScore: number; // 0-100%
    maturityLabel: string; // e.g. "Striving - Early"

    // Week 4: Readiness ("Future Potential")
    readinessScore: number; // 0-100%
    readinessLabel: string; // "Scale-Ready" | "Misalignment" etc.

    // Week 5: Direction
    focusPriorities: string[];
}

export interface DimensionScore {
    id: string;
    name: string;
    score: number; // 0-5 or 0-100 depending on final impl
    label: string;
    color: 'emerald' | 'blue' | 'amber' | 'orange' | 'red' | 'gray';
}
