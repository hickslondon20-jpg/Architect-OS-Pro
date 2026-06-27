import React from 'react';
import './ProfileStyles.css';
import {
    formatCurrency,
    formatDate,
    formatDeliveryModel,
    renderBenchmarkBadge
} from './SnapshotProfileUtils';

// Imports updated to include Lucide icons
import { Lightbulb, Users } from 'lucide-react';

interface TeamProfileProps {
    profileData: any;
}

export const TeamProfile: React.FC<TeamProfileProps> = ({ profileData }) => {
    if (!profileData) return null;

    return (
        <div className="profile-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="profile-header">
                <h3 className="profile-title flex items-center gap-2">
                    <Users className="h-5 w-5 text-[var(--aos-insight)]" />
                    Delivery Architecture Profile
                </h3>
                <span className="profile-timestamp">
                    Last updated: {formatDate(profileData.created_at)}
                </span>
            </div>

            {/* Section 1: Team Composition */}
            <div className="profile-section">
                <h4 className="section-heading">TEAM COMPOSITION</h4>

                <div className="metric-row">
                    <span className="metric-label">Total Team Size</span>
                    <span className="metric-value">
                        {profileData.total_team_size_fte} FTE
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Billable Staff</span>
                    <span className="metric-value">
                        {profileData.billable_staff_count}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Non-Billable Staff</span>
                    <span className="metric-value">
                        {profileData.non_billable_staff_count}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Delivery Model</span>
                    <span className="metric-value">
                        {formatDeliveryModel(profileData.team_structure_type)}
                    </span>
                </div>
            </div>

            <div className="divider"></div>

            {/* Section 2: Efficiency & Leverage */}
            <div className="profile-section">
                <h4 className="section-heading">EFFICIENCY & LEVERAGE</h4>

                <div className="metric-row">
                    <span className="metric-label">AGI per FTE</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.agi_per_fte_monthly)}/mo
                        {renderBenchmarkBadge('agi_per_fte', profileData.agi_per_fte_monthly)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Billable:Non-Billable Ratio</span>
                    <span className="metric-value">
                        {profileData.billable_ratio_calculated?.toFixed(1)}:1
                        {renderBenchmarkBadge('billable_ratio', profileData.billable_ratio_calculated)}
                    </span>
                </div>

            </div>

            <div className="divider"></div>

        </div>
    );
};
