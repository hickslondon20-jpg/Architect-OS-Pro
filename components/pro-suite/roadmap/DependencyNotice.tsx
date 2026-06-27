import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export interface MissingDependency {
    id: string;
    label: string;
    path: string;
}

interface DependencyNoticeProps {
    missingDependencies: MissingDependency[];
}

export const DependencyNotice: React.FC<DependencyNoticeProps> = ({ missingDependencies }) => {
    if (!missingDependencies || missingDependencies.length === 0) return null;

    return (
        <div
            className="mb-6 rounded-[var(--radius-xs)] p-5"
            style={{
                background: 'var(--aos-warning-tint)',
                border: '1px solid var(--aos-warning)',
                color: 'var(--fg-1)',
            }}
        >
            <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" style={{ color: 'var(--aos-warning)' }} />
                <h4 className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>Complete the following to unlock your synthesis</h4>
            </div>
            <ul className="space-y-2">
                {missingDependencies.map((dep) => (
                    <li key={dep.id}>
                        <Link
                            to={dep.path}
                            className="inline-flex items-center text-sm font-medium underline underline-offset-2"
                            style={{ color: 'var(--aos-warning)' }}
                        >
                            Complete your {dep.label} <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
};
