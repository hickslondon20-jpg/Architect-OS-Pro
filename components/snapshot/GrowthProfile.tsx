import React from 'react';
import './ProfileStyles.css';
import {
    formatCurrency,
    formatDate,
    renderBenchmarkBadge
} from './SnapshotProfileUtils';

// Imports updated to include Lucide icons
import { Lightbulb, TrendingUp } from 'lucide-react';

interface GrowthProfileProps {
    profileData: any;
}

export const GrowthProfile: React.FC<GrowthProfileProps> = ({ profileData }) => {
    if (!profileData) return null;

    return (
        <div className="profile-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="profile-header">
                <h3 className="profile-title flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[var(--aos-insight)]" />
                    Revenue Model Profile
                </h3>
                <span className="profile-timestamp">
                    Last updated: {formatDate(profileData.created_at)}
                </span>
            </div>

            {/* Section 1: Revenue Engine */}
            <div className="profile-section">
                <h4 className="section-heading">REVENUE ENGINE</h4>

                <div className="metric-row">
                    <span className="metric-label">Current MRR</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.current_mrr)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Active Client Count</span>
                    <span className="metric-value">
                        {profileData.active_client_count}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Avg Client Value (ACV)</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.average_client_value_monthly)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Project Revenue (Monthly)</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.project_revenue_monthly)}
                    </span>
                </div>
            </div>

            <div className="divider"></div>

            {/* Section 2: Client Retention */}
            <div className="profile-section">
                <h4 className="section-heading">CLIENT RETENTION</h4>

                <div className="metric-row">
                    <span className="metric-label">Monthly Churn Rate</span>
                    <span className="metric-value">
                        {profileData.monthly_churn_rate}%
                        {renderBenchmarkBadge('churn_rate', profileData.monthly_churn_rate)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Avg Client Lifetime</span>
                    <span className="metric-value">
                        {profileData.average_client_lifetime_months} months
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Churned Clients/Year (Est)</span>
                    <span className="metric-value">
                        {profileData.churned_clients_per_year || '—'}
                    </span>
                </div>
            </div>

            <div className="divider"></div>

        </div>
    );
};
