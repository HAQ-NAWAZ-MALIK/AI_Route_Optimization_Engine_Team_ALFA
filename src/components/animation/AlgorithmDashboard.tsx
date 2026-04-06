'use client';

import type { Algorithm } from '@/hooks/useAnimationEngine';

interface AlgorithmDashboardProps {
    algorithms: Algorithm[];
    phase: number;
    winnerIndex: number;
    visible: boolean;
}

const ALGO_NAMES = ['Christofides TSP', 'Genetic Algorithm', 'Nearest Neighbor', 'Simulated Annealing'];
const ALGO_ICONS = ['①', '②', '③', '④'];

export function AlgorithmDashboard({ algorithms, phase, winnerIndex, visible }: AlgorithmDashboardProps) {
    if (!visible) return null;

    return (
        <div className="fixed top-5 right-5 z-10 min-w-[420px] animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-gray-950/95 border-2 border-cyan-500/60 backdrop-blur-xl rounded-lg p-5 shadow-[0_0_40px_rgba(6,182,212,0.3)]">
                <h2 className="text-base font-bold text-emerald-400 mb-4 text-center tracking-widest uppercase border-b border-cyan-500/30 pb-3 flex items-center justify-center gap-2">
                    <span className="text-xl">🧠</span>
                    ALGORITHM RACE
                </h2>

                <div className="space-y-3">
                    {algorithms.map((algo, idx) => {
                        const isActive = phase === 4;
                        const isWinner = phase >= 5 && idx === winnerIndex;

                        return (
                            <div
                                key={idx}
                                className={`relative p-3 rounded-lg border transition-all duration-300 ${isWinner
                                        ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                                        : isActive
                                            ? 'bg-cyan-500/10 border-cyan-500/50 animate-pulse'
                                            : 'bg-gray-800/50 border-gray-700/50'
                                    }`}
                            >
                                {isWinner && (
                                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-gray-900 px-3 py-1 text-xs font-bold rounded shadow-lg">
                                        🏆 WINNER
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm mb-2">
                                    <span className="text-lg">{ALGO_ICONS[idx]}</span>
                                    {ALGO_NAMES[idx]}
                                </div>

                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>
                                        Distance:{' '}
                                        <span className="text-emerald-400 font-mono">
                                            {algo.distance > 0 ? `${algo.distance.toFixed(1)} km` : '--'}
                                        </span>
                                    </span>
                                    <span>
                                        Time:{' '}
                                        <span className="text-emerald-400 font-mono">
                                            {algo.time > 0 ? `${algo.time.toFixed(0)} min` : '--'}
                                        </span>
                                    </span>
                                    <span>
                                        Cost:{' '}
                                        <span className="text-emerald-400 font-mono">
                                            {algo.cost > 0 ? `₹${algo.cost.toFixed(0)}` : '--'}
                                        </span>
                                    </span>
                                </div>

                                <div className="h-1.5 bg-gray-700/50 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-100 rounded-full ${isWinner ? 'bg-emerald-500' : 'bg-cyan-500'
                                            }`}
                                        style={{ width: `${algo.progress}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
