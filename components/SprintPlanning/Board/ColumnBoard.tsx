import React from 'react';
interface ColumnBoardProps {
    boardState: 'capability' | 'initiative';
    prioritize: React.ReactNode;
    plant: React.ReactNode;
    iterate: React.ReactNode;
}

export const ColumnBoard: React.FC<ColumnBoardProps> = ({ boardState, prioritize, plant, iterate }) => {
    return (
        <div className="grid h-full min-h-[600px] min-w-0 grid-cols-1 gap-4 md:grid-cols-3 xl:gap-5">
            {/* Column 1: PRIORITIZE */}
            <BoardColumn
                title="Prioritize"
                accentColor="border-t-[var(--aos-insight)]"
                bgClass="bg-[var(--bg-canvas)]"
            >
                {prioritize}
            </BoardColumn>

            {/* Column 2: PLANT */}
            <BoardColumn
                title="Plant"
                accentColor="border-t-[var(--aos-brass)]"
                bgClass="bg-[var(--bg-canvas)]"
            >
                {plant}
            </BoardColumn>

            {/* Column 3: PROGRESSIVELY ITERATE */}
            <BoardColumn
                title="Progressively Iterate"
                accentColor="border-t-[var(--aos-success)]"
                bgClass="bg-[var(--bg-canvas)]"
            >
                {iterate}
            </BoardColumn>
        </div>
    );
};

// Sub-component for individual columns
const BoardColumn: React.FC<{
    title: string;
    accentColor: string;
    bgClass: string;
    children: React.ReactNode
}> = ({ title, accentColor, bgClass, children }) => (
    <div className={`flex h-full min-w-0 flex-col rounded-[var(--radius-xs)] border border-[var(--aos-mist)] ${bgClass} shadow-[var(--shadow-soft-1)]`}>
        {/* Column Header */}
        <div className={`border-t-4 ${accentColor} rounded-t-[var(--radius-xs)] border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4`}>
            <h3 className="break-words text-[12px] font-bold uppercase leading-snug tracking-wide text-[var(--fg-1)]">{title}</h3>
        </div>

        {/* Column Content Area */}
        <div className="flex flex-1 flex-col gap-4 p-4">
            {children}
        </div>
    </div>
);
