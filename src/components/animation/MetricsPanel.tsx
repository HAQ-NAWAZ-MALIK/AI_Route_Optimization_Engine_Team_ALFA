'use client';

import type { AnimationState } from '@/hooks/useAnimationEngine';

interface MetricsPanelProps {
    state: AnimationState;
    elapsedTime: number;
}

const PHASE_LABELS = [
    { step: 'INITIALIZING...', desc: 'Preparing neural optimization engine' },
    { step: 'STEP 1: UNDERSTANDING THE CHALLENGE', desc: 'Receiving employee locations, cab capacities, and office coordinates' },
    { step: 'STEP 2: INTELLIGENT GROUPING', desc: 'Analyzing geographic distribution and forming optimal clusters' },
    { step: 'STEP 3: SMART ASSIGNMENT', desc: 'Assigning clusters to cabs to minimize total collective distance' },
    { step: 'STEP 4: ROUTE OPTIMIZATION', desc: 'Running 4 AI algorithms simultaneously to find the best routes' },
    { step: 'STEP 5: SELECTING THE WINNER', desc: 'Comparing results and selecting the most efficient route' },
    { step: 'STEP 6: EXECUTION', desc: 'Deploying optimized routes for all transport cabs' },
];

export function MetricsPanel({ state, elapsedTime }: MetricsPanelProps) {
    const { phase, students, buses, clusters, algorithms, winnerIndex } = state;

    const studentsVisible = students.filter(s => s.alpha > 0).length;
    const studentsAssigned = students.filter(s => s.assigned).length;
    const totalCapacity = buses.reduce((sum, b) => sum + b.capacity, 0);
    const activeBuses = buses.filter(b => b.students.length > 0).length;
    const clusterCount = phase >= 2 ? buses.length : 0;

    const winner = winnerIndex >= 0 ? algorithms[winnerIndex] : null;
    const totalDistance = winner?.distance || 0;
    const fuelCost = winner?.cost || 0;
    const coverage = phase >= 5 ? 100 : phase >= 3 ? Math.round((studentsAssigned / 45) * 100) : 0;

    const progressWidth = phase === 0 ? 0 : phase === 1 ? 20 : phase === 2 ? 40 : phase === 3 ? 60 : phase === 4 ? 80 : 100;

    return (
        <div className="fixed top-5 left-5 z-10 min-w-[380px] animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="bg-gray-950/95 border-2 border-cyan-500/60 backdrop-blur-xl rounded-lg p-5 shadow-[0_0_40px_rgba(6,182,212,0.3)]">
                <h1 className="text-xl font-bold text-emerald-400 mb-4 text-center tracking-widest uppercase border-b border-cyan-500/30 pb-3 flex items-center justify-center gap-2">
                    <span className="text-2xl">⚡</span>
                    AI ROUTE OPTIMIZER
                </h1>

                {/* Current Step */}
                <div className="bg-cyan-500/10 border border-cyan-500/40 rounded-lg p-3 mb-4">
                    <div className="text-emerald-400 font-bold text-sm mb-1">
                        {PHASE_LABELS[phase]?.step || 'INITIALIZING...'}
                    </div>
                    <div className="text-cyan-400 text-xs leading-relaxed">
                        {PHASE_LABELS[phase]?.desc || 'Preparing neural optimization engine'}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-gray-800 rounded-full border border-cyan-500/30 mb-4 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        style={{ width: `${progressWidth}%` }}
                    />
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="Employees" value={studentsVisible} />
                    <MetricCard label="Available Cabs" value={buses.length} />
                    <MetricCard label="Total Capacity" value={totalCapacity} />
                    <MetricCard label="Coverage" value={`${coverage}%`} warning={coverage < 100} />
                    <MetricCard label="Clusters Formed" value={clusterCount} />
                    <MetricCard label="Processing Time" value={`${elapsedTime.toFixed(2)}s`} />
                    <MetricCard
                        label="Total Distance"
                        value={totalDistance > 0 ? `${totalDistance.toFixed(1)} km` : '--'}
                        good={totalDistance > 0}
                    />
                    <MetricCard
                        label="Est. Fuel Cost"
                        value={fuelCost > 0 ? `₹${fuelCost.toFixed(0)}` : '--'}
                        good={fuelCost > 0}
                    />
                </div>
            </div>
        </div>
    );
}

function MetricCard({
    label,
    value,
    warning,
    good
}: {
    label: string;
    value: string | number;
    warning?: boolean;
    good?: boolean;
}) {
    return (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
            <div className="text-cyan-500 text-[10px] uppercase tracking-wider mb-1">{label}</div>
            <div className={`font-bold text-lg ${warning ? 'text-amber-500' :
                    good ? 'text-emerald-400' :
                        'text-emerald-400'
                }`}>
                {value}
            </div>
        </div>
    );
}
