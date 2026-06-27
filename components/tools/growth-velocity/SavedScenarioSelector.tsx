import React from 'react';
import { Button, Checkbox, Label, Popover, PopoverContent, PopoverTrigger } from '../../ui';
import { ChevronDown, Check } from 'lucide-react';

export interface SavedScenario {
    id: string;
    name: string;
    date: string;
}

interface SavedScenarioSelectorProps {
    scenarios: SavedScenario[];
    selectedIds: string[];
    onToggleScenario: (id: string) => void;
}

export const SavedScenarioSelector: React.FC<SavedScenarioSelectorProps> = ({
    scenarios,
    selectedIds,
    onToggleScenario
}) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-[300px] justify-between text-left font-normal bg-white">
                    <span>
                        {selectedIds.length === 0
                            ? "Select scenarios to compare..."
                            : `${selectedIds.length} scenario${selectedIds.length > 1 ? 's' : ''} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 bg-white" align="start">
                <div className="p-2 space-y-1">
                    <div className="flex items-center space-x-2 p-2 rounded bg-slate-50 opacity-50 cursor-not-allowed">
                        <Checkbox id="baseline" checked disabled />
                        <Label htmlFor="baseline" className="font-medium cursor-not-allowed">Baseline (Current)</Label>
                    </div>
                    {scenarios.map((scenario) => (
                        <div key={scenario.id} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 cursor-pointer" onClick={() => onToggleScenario(scenario.id)}>
                            <Checkbox
                                id={scenario.id}
                                checked={selectedIds.includes(scenario.id)}
                                onCheckedChange={() => onToggleScenario(scenario.id)}
                            />
                            <div className="flex flex-col">
                                <Label htmlFor={scenario.id} className="font-medium cursor-pointer pointer-events-none">{scenario.name}</Label>
                                <span className="text-xs text-slate-500">{scenario.date}</span>
                            </div>
                        </div>
                    ))}
                    {scenarios.length === 0 && (
                        <div className="p-4 text-center text-sm text-slate-500">
                            No saved scenarios found.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};
