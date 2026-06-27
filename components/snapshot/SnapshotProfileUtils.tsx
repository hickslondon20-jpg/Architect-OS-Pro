import React from 'react';

// Format currency
export const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

// Format date
export const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Format health status (capitalize and prettify)
export const formatHealthStatus = (status: string | null | undefined) => {
    if (!status) return '—';
    const statusMap: Record<string, string> = {
        stressed: 'Stressed',
        tight: 'Tight',
        stable: 'Stable',
        healthy: 'Healthy',
        excellent: 'Excellent'
    };
    return statusMap[status] || status;
};

// Format delivery model
export const formatDeliveryModel = (model: string | null | undefined) => {
    if (!model) return '—';
    const modelMap: Record<string, string> = {
        solo_execution: 'Solo Execution',
        team_pods: 'Team Pods',
        hybrid: 'Hybrid',
        specialized_roles: 'Specialized Roles'
    };
    return modelMap[model] || model;
};

// Render benchmark badge
export const renderBenchmarkBadge = (metricType: 'agi_percentage' | 'profit_margin' | 'cash_runway' | 'churn_rate' | 'retention_rate' | 'agi_per_fte' | 'billable_ratio', value: number | null | undefined) => {
    if (value === null || value === undefined) return null;

    let badgeClass = '';
    let badgeText = '';

    if (metricType === 'agi_percentage') {
        const config = {
            healthy: value >= 85 && value <= 95,
            caution: (value >= 75 && value < 85) || (value > 95 && value <= 100),
            critical: value < 75 || value > 100
        };
        if (config.healthy) {
            badgeClass = 'badge-healthy';
            badgeText = 'Healthy';
        } else if (config.caution) {
            badgeClass = 'badge-caution';
            badgeText = 'Review';
        } else if (config.critical) {
            badgeClass = 'badge-critical';
            badgeText = 'Concern';
        }
    } else if (metricType === 'profit_margin') {
        const config = {
            excellent: value >= 30,
            healthy: value >= 20 && value < 30,
            acceptable: value >= 15 && value < 20,
            critical: value < 15
        };
        if (config.excellent) {
            badgeClass = 'badge-healthy';
            badgeText = 'Excellent';
        } else if (config.healthy) {
            badgeClass = 'badge-healthy';
            badgeText = 'Healthy';
        } else if (config.acceptable) {
            badgeClass = 'badge-caution';
            badgeText = 'Acceptable';
        } else if (config.critical) {
            badgeClass = 'badge-critical';
            badgeText = 'Critical';
        }
    } else if (metricType === 'cash_runway') {
        const config = {
            healthy: value >= 3,
            caution: value >= 1 && value < 3,
            critical: value < 1
        };
        if (config.healthy) {
            badgeClass = 'badge-healthy';
            badgeText = 'Healthy';
        } else if (config.caution) {
            badgeClass = 'badge-caution';
            badgeText = 'Tight';
        } else if (config.critical) {
            badgeClass = 'badge-critical';
            badgeText = 'Critical';
        }
    } else if (metricType === 'churn_rate') {
        const config = {
            healthy: value <= 2.5,
            caution: value > 2.5 && value <= 4,
            critical: value > 4
        };
        if (config.healthy) {
            badgeClass = 'badge-healthy';
            badgeText = 'Healthy';
        } else if (config.caution) {
            badgeClass = 'badge-caution';
            badgeText = 'Monitor';
        } else if (config.critical) {
            badgeClass = 'badge-critical';
            badgeText = 'Critical';
        }
    } else if (metricType === 'retention_rate') {
        const config = {
            healthy: value >= 97.5,
            caution: value >= 95 && value < 97.5,
            critical: value < 95
        };
        if (config.healthy) {
            badgeClass = 'badge-healthy';
            badgeText = 'Strong';
        } else if (config.caution) {
            badgeClass = 'badge-caution';
            badgeText = 'Acceptable';
        } else if (config.critical) {
            badgeClass = 'badge-critical';
            badgeText = 'Concerning';
        }
    } else if (metricType === 'agi_per_fte') {
        const config = {
            healthy: value >= 15500,
            caution: value >= 12000 && value < 15500,
            critical: value < 12000
        };
        if (config.healthy) {
            badgeClass = 'badge-healthy';
            badgeText = 'Healthy';
        } else if (config.caution) {
            badgeClass = 'badge-caution';
            badgeText = 'Review';
        } else if (config.critical) {
            badgeClass = 'badge-critical';
            badgeText = 'Concerning';
        }
    } else if (metricType === 'billable_ratio') {
        const config = {
            healthy: value >= 3,
            caution: value >= 2 && value < 3,
            critical: value < 2
        };
        if (config.healthy) {
            badgeClass = 'badge-healthy';
            badgeText = 'Strong';
        } else if (config.caution) {
            badgeClass = 'badge-caution';
            badgeText = 'Acceptable';
        } else if (config.critical) {
            badgeClass = 'badge-critical';
            badgeText = 'Imbalanced';
        }
    }

    if (!badgeText) return null;

    return (
        <span className={`benchmark-badge ${badgeClass}`
        }>
            {badgeText}
        </span>
    );
};
