import React, { useRef, useEffect } from 'react';
import { Card } from '../../ui';

interface CapabilityDrawerData {
    name: string;
    score: number;
    stageFit: string;
    checkpoints: { id: string; title: string; }[];
}

interface CapabilityTagDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    position: { x: number; y: number };
    data: CapabilityDrawerData;
}

export const CapabilityTagDrawer: React.FC<CapabilityTagDrawerProps> = ({
    isOpen,
    onClose,
    position,
    data
}) => {
    const drawerRef = useRef<HTMLDivElement>(null);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Determine badge color (duplicated helper, ideally in util)
    const getStageColor = (fit: string) => {
        switch (fit) {
            case 'Below Stage': return 'bg-amber-100 text-amber-900';
            case 'At Stage': return 'bg-slate-100 text-slate-700';
            case 'Ahead of Stage': return 'bg-emerald-100 text-emerald-900';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div
            className="fixed z-50 animate-in fade-in zoom-in-95 duration-100"
            style={{
                left: position.x,
                top: position.y + 10, // Slight offset below cursor/click
                transform: 'translateX(-10%)' // Center align hint
            }}
        >
            <Card
                ref={drawerRef}
                className="w-80 p-4 bg-white shadow-xl border-slate-200 ring-1 ring-black/5"
            >
                <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-slate-900 text-sm">{data.name}</h4>
                    <span className="text-xs font-semibold text-slate-500">{data.score}%</span>
                </div>

                <div className="mb-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStageColor(data.stageFit)}`}>
                        {data.stageFit}
                    </span>
                </div>

                <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Related Checkpoints</div>
                    <ul className="space-y-1.5">
                        {data.checkpoints.map(cp => (
                            <li key={cp.id} className="text-xs text-slate-600 leading-snug">
                                <span className="font-medium text-slate-800">{cp.id}</span> {cp.title}
                            </li>
                        ))}
                    </ul>
                </div>
            </Card>
        </div>
    );
};
