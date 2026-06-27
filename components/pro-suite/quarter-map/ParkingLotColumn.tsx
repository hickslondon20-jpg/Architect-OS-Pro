import React, { useState } from 'react';
import { Archive } from 'lucide-react';
import { Capability, BucketType } from './types';
import { CapabilityColumnCard } from './CapabilityColumnCard';

interface ParkingLotColumnProps {
    items: Capability[];
    onRemove: (id: string) => void;
    onItemClick: (id: string) => void;
    draggingId: string | null;
    onDragStart: (e: React.DragEvent, capId: string) => void;
    onDragEnd: () => void;
    onDrop: (capId: string, targetBucket: BucketType) => void;
}

export const ParkingLotColumn: React.FC<ParkingLotColumnProps> = ({
    items, onRemove, onItemClick, draggingId, onDragStart, onDragEnd, onDrop
}) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const capId = e.dataTransfer.getData('capabilityId');
        if (capId) onDrop(capId, 'PARKING_LOT');
    };

    return (
        <div
            className="flex min-h-[400px] flex-1 flex-col rounded-[var(--radius-xs)] opacity-80 transition-all hover:opacity-100"
            style={{
                background: isDragOver ? 'var(--aos-brass-tint)' : 'var(--bg-surface)',
                border: isDragOver ? '2px solid var(--aos-brass)' : '1px solid var(--aos-mist)',
                boxShadow: 'var(--shadow-soft-1)',
                transition: 'background 0.15s, border-color 0.15s',
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="rounded-t-[var(--radius-xs)] border-b border-[var(--aos-mist)] bg-[var(--bg-sunken)] p-4">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-[var(--fg-2)]">
                        <Archive className="w-5 h-5" />
                        <h3 className="aos-eyebrow">Parking Lot</h3>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--fg-2)]">
                        {items.length}
                    </span>
                </div>
                <p className="text-xs text-[var(--fg-3)]">Not doing these right now. Safe to ignore.</p>
            </div>

            <div className="p-3 space-y-3 flex-1 flex flex-col max-h-[600px] overflow-y-auto">
                {items.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center text-[var(--fg-3)] text-sm border-2 border-dashed border-[var(--aos-mist)] rounded-lg">
                        Send capabilities here to clear them from your view.
                    </div>
                ) : (
                    items.map(cap => (
                        <CapabilityColumnCard
                            key={cap.id}
                            capability={cap}
                            onRemove={onRemove}
                            onClick={onItemClick}
                            isDragging={draggingId === cap.id}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
