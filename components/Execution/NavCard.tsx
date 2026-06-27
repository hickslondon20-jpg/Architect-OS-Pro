import React from 'react';
import { Card } from '../../components/ui';
import { Link } from 'react-router-dom';
import { LucideIcon, Lock } from 'lucide-react';

export type NavCardState = 'active' | 'muted' | 'action-needed' | 'warning';

export interface NavCardProps {
    title: string;
    description: string;
    icon: LucideIcon;
    href: string;
    statusLine?: string;
    state?: NavCardState;
    badgeText?: string;
}

export const NavCard: React.FC<NavCardProps> = ({
    title,
    description,
    icon: Icon,
    href,
    statusLine,
    state = 'active',
    badgeText
}) => {
    const isMuted = state === 'muted';
    const isWarning = state === 'warning';

    // Base colors
    let iconBgColor = 'bg-blue-100';
    let iconColor = 'text-blue-600';
    let statusTextColor = 'text-slate-500';

    if (isWarning) {
        iconBgColor = 'bg-amber-100';
        iconColor = 'text-amber-600';
        statusTextColor = 'text-amber-600';
    } else if (isMuted) {
        iconBgColor = 'bg-slate-100';
        iconColor = 'text-slate-400';
        statusTextColor = 'text-slate-400';
    } else if (state === 'action-needed') {
        iconBgColor = 'bg-indigo-100';
        iconColor = 'text-indigo-600';
    }

    const cardContent = (
        <Card className={`h-full p-6 transition-all border-slate-200 ${isMuted ? 'opacity-70 bg-slate-50 border-slate-100' : 'hover:shadow-md hover:border-slate-300 bg-white'
            }`}>
            <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${iconBgColor} ${!isMuted && 'group-hover:scale-110 transition-transform'}`}>
                        <Icon size={24} className={iconColor} />
                    </div>

                    {/* Top Right Slot: Lock or Badge */}
                    {isMuted && <Lock size={16} className="text-slate-300" />}
                    {!isMuted && badgeText && (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-md">
                            {badgeText}
                        </span>
                    )}
                </div>

                <div className="flex-1">
                    <h3 className={`text-lg font-bold mb-2 transition-colors ${isMuted ? 'text-slate-500' : 'text-slate-900 group-hover:text-blue-600'
                        }`}>
                        {title}
                    </h3>
                    <p className={`text-sm ${isMuted ? 'text-slate-400' : 'text-slate-500'}`}>
                        {description}
                    </p>
                </div>

                {statusLine && (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <p className={`text-xs font-medium ${statusTextColor}`}>
                            {statusLine}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );

    if (isMuted) {
        return <div className="h-full select-none">{cardContent}</div>;
    }

    return (
        <Link to={href} className="group h-full block">
            {cardContent}
        </Link>
    );
};
