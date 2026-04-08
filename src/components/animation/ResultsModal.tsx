'use client';

import type { Algorithm } from '@/hooks/useAnimationEngine';

interface ResultsModalProps {
    visible: boolean;
    onClose: () => void;
    elapsedTime: number;
    winnerAlgorithm: Algorithm | null;
}

export function ResultsModal({ visible, onClose, elapsedTime, winnerAlgorithm }: ResultsModalProps) {
    if (!visible || !winnerAlgorithm) return null;

    // Calculate mock savings
    const distanceSaved = Math.round(35 + Math.random() * 15);
    const timeSaved = Math.round(30 + Math.random() * 15);
    const costSaved = Math.round(winnerAlgorithm.cost * 0.35);
    const co2Saved = Math.round(winnerAlgorithm.distance * 0.12 * 10);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="relative bg-gray-950/98 border-3 border-emerald-500 rounded-xl p-10 min-w-[520px] text-center shadow-[0_0_80px_rgba(16,185,129,0.5)] animate-in zoom-in-95 duration-500 z-10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center text-red-400 border-2 border-red-400/50 bg-red-400/20 hover:bg-red-500 hover:text-white hover:border-red-500 hover:rotate-90 transition-all duration-300 text-2xl font-bold cursor-pointer z-20"
                    aria-label="Close results"
                >
                    ×
                </button>

                {/* Header */}
                <h2 className="text-3xl font-bold text-emerald-400 mb-2 tracking-wider flex items-center justify-center gap-3">
                    <span className="text-4xl">✨</span>
                    OPTIMIZATION COMPLETE
                </h2>
                <p className="text-cyan-400 text-sm mb-8">
                    Winner selected in <span className="font-mono font-bold">{elapsedTime.toFixed(2)}</span> seconds
                </p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-5 mb-8">
                    <StatCard label="Distance Saved" value={`${distanceSaved}%`} />
                    <StatCard label="Time Saved" value={`${timeSaved}%`} />
                    <StatCard label="Cost Reduction" value={`₹${costSaved.toLocaleString()}`} />
                    <StatCard label="CO₂ Reduction" value={`${co2Saved}kg`} />
                </div>

                {/* Winner */}
                <div className="bg-emerald-500/15 border border-emerald-500 rounded-lg p-5">
                    <div className="text-cyan-400 text-xs uppercase tracking-wider mb-2">🏆 WINNING ALGORITHM</div>
                    <div className="text-emerald-400 text-xl font-bold tracking-wide">
                        {winnerAlgorithm.name.toUpperCase()}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-cyan-500/10 border border-cyan-500/40 rounded-lg p-5">
            <div className="text-cyan-400 text-xs uppercase tracking-wider mb-2">{label}</div>
            <div className="text-emerald-400 text-3xl font-bold drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                {value}
            </div>
        </div>
    );
}
