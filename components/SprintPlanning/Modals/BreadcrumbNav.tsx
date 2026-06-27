import React from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';

export interface BreadcrumbNode {
    id: string;
    label: string;
    level: 'tier' | 'capability' | 'initiative' | 'milestone';
}

interface BreadcrumbNavProps {
    nodes?: BreadcrumbNode[];
    onNodeClick?: (node: BreadcrumbNode) => void;
    onBackClick?: () => void;
}

// Hardcoded for Pass 1 - Step 2 testing
const MOCK_NODES: BreadcrumbNode[] = [
    { id: 'tier-1', label: 'Prioritize', level: 'tier' },
    { id: 'cap-1', label: 'Cash Flow Forecasting', level: 'capability' },
    { id: 'init-1', label: 'Build Financial Dashboard', level: 'initiative' }
];

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
    nodes = MOCK_NODES,
    onNodeClick,
    onBackClick
}) => {

    const handleNodeClick = (node: BreadcrumbNode) => {
        console.log(`Breadcrumb node clicked: ${node.label} (${node.level})`);
        if (onNodeClick) onNodeClick(node);
    };

    const handleBackClick = () => {
        console.log('Breadcrumb back arrow clicked');
        if (onBackClick) onBackClick();
    };

    return (
        <div className="flex items-center text-sm font-medium">
            <button
                onClick={handleBackClick}
                className="mr-3 flex-shrink-0 rounded p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
                aria-label="Go back"
            >
                <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center flex-wrap gap-1">
                {nodes.map((node, index) => {
                    const isLast = index === nodes.length - 1;

                    // Truncate non-last nodes to 25 chars max
                    let displayLabel = node.label;
                    if (!isLast && displayLabel.length > 25) {
                        displayLabel = displayLabel.substring(0, 25) + '...';
                    }

                    return (
                        <React.Fragment key={node.id}>
                            <button
                                onClick={() => handleNodeClick(node)}
                                className={`px-2 py-1 rounded transition-colors ${isLast
                                    ? 'cursor-default font-semibold text-[var(--fg-1)]'
                                    : 'cursor-pointer text-[var(--fg-3)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]'
                                    }`}
                                disabled={isLast} // Prevent clicking the active leaf node if desired 
                                title={node.label} // Full name on hover
                            >
                                {displayLabel}
                            </button>

                            {!isLast && (
                                <ChevronRight className="mx-0.5 h-4 w-4 flex-shrink-0 text-[var(--fg-4)]" />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};
