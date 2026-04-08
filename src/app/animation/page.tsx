'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAnimationEngine } from '@/hooks/useAnimationEngine';
import {
    AnimationCanvas,
    AlgorithmDashboard,
    MetricsPanel,
    ResultsModal,
    EntityCounter,
} from '@/components/animation';

export default function AnimationPage() {
    const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
    const [showResults, setShowResults] = useState(false);

    // Handle window resize
    useEffect(() => {
        const updateDimensions = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    const engine = useAnimationEngine(dimensions.width, dimensions.height);
    const { phase, algorithms, winnerIndex, isComplete, elapsedTime, start, reset } = engine;

    // Show results when complete
    useEffect(() => {
        if (isComplete && !showResults) {
            setShowResults(true);
        }
    }, [isComplete, showResults]);

    const handleStart = useCallback(() => {
        setShowResults(false);
        if (phase === 0) {
            start();
        } else {
            reset();
            setTimeout(() => start(), 100);
        }
    }, [phase, start, reset]);

    const handleCloseResults = useCallback(() => {
        setShowResults(false);
    }, []);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-gray-950">
            {/* Canvas Background */}
            <AnimationCanvas
                state={engine}
                width={dimensions.width}
                height={dimensions.height}
            />

            {/* Metrics Panel (Top Left) */}
            <MetricsPanel state={engine} elapsedTime={elapsedTime} />

            {/* Algorithm Dashboard (Top Right) - Visible from Phase 4 */}
            <AlgorithmDashboard
                algorithms={algorithms}
                phase={phase}
                winnerIndex={winnerIndex}
                visible={phase >= 4}
            />

            {/* Entity Counter (Bottom Left) */}
            <EntityCounter
                students={engine.students}
                buses={engine.buses}
                phase={phase}
            />

            {/* Start Button (Bottom Center) */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10">
                <button
                    onClick={handleStart}
                    disabled={phase > 0 && phase < 6}
                    className={`
            relative overflow-hidden px-12 py-5 text-lg font-bold uppercase tracking-widest
            rounded-lg transition-all duration-300
            ${phase > 0 && phase < 6
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-gray-900 hover:from-emerald-500 hover:to-emerald-600 hover:scale-105 shadow-[0_0_50px_rgba(6,182,212,0.6)] hover:shadow-[0_0_60px_rgba(16,185,129,0.7)]'
                        }
          `}
                >
                    <span className="relative z-10 flex items-center gap-3">
                        <span className="text-2xl">🚀</span>
                        {phase === 0 ? 'RUN AI ROUTE OPTIMIZER' : isComplete ? 'RUN AGAIN' : 'OPTIMIZING...'}
                    </span>

                    {/* Shine effect */}
                    {phase === 0 && (
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                    )}
                </button>
            </div>

            {/* Results Modal */}
            <ResultsModal
                visible={showResults}
                onClose={handleCloseResults}
                elapsedTime={elapsedTime}
                winnerAlgorithm={winnerIndex >= 0 ? algorithms[winnerIndex] : null}
            />

            {/* Gradient overlays for depth */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950/50 via-transparent to-gray-950/30" />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-950/20 via-transparent to-gray-950/20" />
            </div>
        </div>
    );
}
