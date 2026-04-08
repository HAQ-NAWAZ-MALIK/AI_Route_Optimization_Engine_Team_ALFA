'use client';

import type { Bus, Student } from '@/hooks/useAnimationEngine';

interface EntityCounterProps {
    students: Student[];
    buses: Bus[];
    phase: number;
}

export function EntityCounter({ students, buses, phase }: EntityCounterProps) {
    const unassigned = students.filter(s => s.alpha > 0 && !s.assigned && s.cluster < 0).length;
    const clustering = students.filter(s => s.cluster >= 0 && !s.assigned).length;
    const assigned = students.filter(s => s.assigned).length;
    const activeBuses = buses.filter(b => b.students.length > 0).length;

    return (
        <div className="fixed bottom-5 left-5 z-10 min-w-[280px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gray-950/95 border-2 border-cyan-500/60 backdrop-blur-xl rounded-lg p-4 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
                <div className="space-y-3">
                    <EntityRow
                        color="#ef4444"
                        label="Employees (Unassigned)"
                        value={phase >= 3 ? 0 : unassigned}
                    />
                    <EntityRow
                        color="#f59e0b"
                        label="Clusters Forming"
                        value={phase >= 3 ? 0 : clustering}
                    />
                    <EntityRow
                        color="#10b981"
                        label="Employees Assigned"
                        value={assigned}
                    />
                    <EntityRow
                        color="#06b6d4"
                        label="Active Cabs"
                        value={activeBuses}
                    />
                </div>
            </div>
        </div>
    );
}

function EntityRow({ color, label, value }: { color: string; label: string; value: number }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 text-cyan-400">
                <span
                    className="w-4 h-4 rounded-full shadow-[0_0_8px_currentColor]"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                />
                {label}
            </div>
            <div className="text-emerald-400 font-bold text-base">{value}</div>
        </div>
    );
}
