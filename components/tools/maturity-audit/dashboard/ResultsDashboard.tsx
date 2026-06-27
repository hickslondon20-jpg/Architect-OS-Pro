import React, { useState } from 'react';
import { Card } from '../../../ui';
import { Chapter1_Summary } from './chapters/Chapter1_Summary';
import { Chapter2_Systems } from './chapters/Chapter2_Systems';
import { Chapter3_Capabilities } from './chapters/Chapter3_Capabilities';
import { Chapter4_Direction } from './chapters/Chapter4_Direction';

export const ResultsDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState(1);

    const tabs = [
        { id: 1, label: 'Summary' },
        { id: 2, label: 'Systems Perspective' },
        { id: 3, label: 'Structural Levers' },
        { id: 4, label: 'Direction' },
    ];

    const handleNext = () => {
        if (activeTab < 4) setActiveTab(prev => prev + 1);
        window.scrollTo(0, 0);
    };

    return (
        <div className="min-h-screen bg-[var(--bg-canvas)] font-sans">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-50 backdrop-blur-md border-b border-[var(--aos-mist)]" style={{ backgroundColor: 'rgba(252, 251, 248, 0.85)' }}>
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="font-bold text-[var(--fg-1)] tracking-tight text-lg">
                            Maturity Audit Results
                        </div>

                        {/* Segmented Control */}
                        <div className="hidden md:flex space-x-1 bg-[var(--bg-canvas)] p-1 rounded-full">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        window.scrollTo(0, 0);
                                    }}
                                    className={`
                                        px-6 py-2 rounded-full text-sm font-medium transition-all duration-200
                                        ${activeTab === tab.id
                                            ? 'bg-[var(--bg-surface)] text-[var(--aos-brass)] shadow-sm ring-1 ring-[var(--aos-mist)]'
                                            : 'text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-sunken)]'}
                                    `}
                                >
                                    <span className="mr-2 text-xs opacity-60" style={{ fontFamily: 'var(--font-mono)' }}>{tab.id}.</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="w-24" /> {/* Spacer for balance */}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="w-full px-4 sm:px-6 lg:px-8 py-12">
                {activeTab === 1 && <Chapter1_Summary onNext={handleNext} />}

                {activeTab === 2 && <Chapter2_Systems onNext={handleNext} />}

                {activeTab === 3 && <Chapter3_Capabilities onNext={handleNext} />}

                {activeTab === 4 && <Chapter4_Direction />}
            </main>
        </div>
    );
};
