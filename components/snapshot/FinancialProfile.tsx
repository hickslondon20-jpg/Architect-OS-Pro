import React from 'react';
import './ProfileStyles.css';
import {
    formatCurrency,
    formatDate,
    formatHealthStatus,
    renderBenchmarkBadge
} from './SnapshotProfileUtils';

// Imports updated to include Lucide icons
import { Lightbulb, DollarSign } from 'lucide-react';

interface FinancialProfileProps {
    profileData: any; // Type as any for now to avoid strict schema dependency issues, can refine later
}

export const FinancialProfile: React.FC<FinancialProfileProps> = ({ profileData }) => {
    if (!profileData) return null;

    return (
        <div className="profile-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="profile-header">
                <h3 className="profile-title flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-[var(--aos-success)]" />
                    Economic Foundation Profile
                </h3>
                <span className="profile-timestamp">
                    Last updated: {formatDate(profileData.created_at)}
                </span>
            </div>

            {/* Section 1: Business Scale */}
            <div className="profile-section">
                <h4 className="section-heading">BUSINESS SCALE</h4>

                <div className="metric-row">
                    <span className="metric-label">Monthly Revenue</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.monthly_revenue)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Monthly AGI</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.monthly_agi)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Monthly Payroll</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.monthly_payroll)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Annual Revenue Run Rate</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.annual_revenue_run_rate)}
                    </span>
                </div>
            </div>

            <div className="divider"></div>

            {/* Section 2: Efficiency & Profitability */}
            <div className="profile-section">
                <h4 className="section-heading">EFFICIENCY & PROFITABILITY</h4>

                <div className="metric-row">
                    <span className="metric-label">AGI Percentage</span>
                    <span className="metric-value">
                        {profileData.agi_percentage_calculated?.toFixed(1)}%
                        {renderBenchmarkBadge('agi_percentage', profileData.agi_percentage_calculated)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Operating Profit Margin</span>
                    <span className="metric-value">
                        {profileData.profit_margin_percentage}%
                        {renderBenchmarkBadge('profit_margin', profileData.profit_margin_percentage)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Monthly Operating Profit</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.monthly_operating_profit)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Monthly Operating Expenses</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.monthly_operating_expenses)}
                    </span>
                </div>
            </div>

            <div className="divider"></div>

            {/* Section 3: Financial Stability */}
            <div className="profile-section">
                <h4 className="section-heading">FINANCIAL STABILITY</h4>

                <div className="metric-row">
                    <span className="metric-label">Cash Available</span>
                    <span className="metric-value">
                        {formatCurrency(profileData.cash_available)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Cash Runway</span>
                    <span className="metric-value">
                        {profileData.cash_runway_months?.toFixed(1)} months
                        {renderBenchmarkBadge('cash_runway', profileData.cash_runway_months)}
                    </span>
                </div>

                <div className="metric-row">
                    <span className="metric-label">Financial Health Status</span>
                    <span className="metric-value">
                        {formatHealthStatus(profileData.financial_health_status)}
                    </span>
                </div>
            </div>

            <div className="divider"></div>

        </div>
    );
};
