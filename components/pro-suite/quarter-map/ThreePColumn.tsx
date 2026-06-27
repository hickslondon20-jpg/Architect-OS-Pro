import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Capability, BucketType } from './types';
import { CapabilityColumnCard } from './CapabilityColumnCard';

interface ThreePColumnProps {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    colorClass: string;
    bucket: BucketType;
    items: Capability[];
    onRemove: (id: string) => void;
    onItemClick: (id: string) => void;
    onAddClick: () => void;
    draggingId: string | null;
    onDragStart: (e: React.DragEvent, capId: string) => void;
    onDragEnd: () => void;
    onDrop: (capId: string, targetBucket: BucketType) => void;
}

export const ThreePColumn: React.FC<ThreePColumnProps> = ({
    title, subtitle, icon, colorClass, bucket, items, onRemove, onItemClick, onAddClick,
    draggingId, onDragStart, onDragEnd, onDrop
}) => {
    const count = items.length;
    const isFull = count >= 3;
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only clear if actually leaving this column, not just moving to a child element
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const capId = e.dataTransfer.getData('capabilityId');
        if (capId) onDrop(capId, bucket);
    };

    return (
        <div
            className={`flex min-h-[400px] flex-1 flex-col rounded-[var(--radius-xs)] border transition-all ${isFull && !isDragOver ? 'border-[var(--aos-brass)]' : isDragOver ? 'border-2 border-[var(--aos-brass)]' : 'border-dashed border-[var(--aos-mist)]'}`}
            style={{
                background: isDragOver ? 'var(--aos-brass-tint)' : 'var(--bg-surface)',
                boxShadow: 'var(--shadow-soft-1)',
                transition: 'background 0.15s, border-color 0.15s',
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`rounded-t-[var(--radius-xs)] border-b border-[var(--aos-mist)] p-4 ${colorClass}`}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h3 className="aos-eyebrow">{title}</h3>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isFull ? 'bg-[var(--aos-brass)] text-[var(--aos-cloud)]' : 'bg-[var(--bg-surface)] text-[var(--fg-2)]'}`}>
                        {count}/3
                    </span>
                </div>
                <p className="text-xs text-[var(--fg-3)]">{subtitle}</p>
            </div>

            <div className="p-3 space-y-3 flex-1 flex flex-col">
                {items.map(cap => (
                    <CapabilityColumnCard
                        key={cap.id}
                        capability={cap}
                        onRemove={onRemove}
                        onClick={onItemClick}
                        isDragging={draggingId === cap.id}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    />
                ))}

                {Array.from({ length: Math.max(0, 3 - count) }).map((_, i) => (
                    <button
                        key={`empty-${i}`}
                        onClick={onAddClick}
                        className="w-full h-24 rounded-lg border-2 border-dashed border-[var(--aos-mist)] flex flex-col items-center justify-center text-[var(--fg-3)] hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)] transition-colors gap-2"
                    >
                        <Plus className="w-5 h-5 opacity-50" />
                        <span className="text-xs font-medium">Add Capability</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
