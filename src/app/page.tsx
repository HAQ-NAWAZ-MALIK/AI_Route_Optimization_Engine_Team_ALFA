import Link from 'next/link';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
            <div className="text-center space-y-8 p-8">
                <div className="space-y-4">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        🚀 AI Transport Optimizer
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Multi-algorithm route optimization engine with real road routing
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
                        <div className="text-4xl mb-4">🧠</div>
                        <h3 className="text-lg font-bold mb-2">3 AI Algorithms</h3>
                        <p className="text-gray-400 text-sm">
                            Nearest Neighbor, Christofides TSP, and Genetic Algorithm compete for best results
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
                        <div className="text-4xl mb-4">🗺️</div>
                        <h3 className="text-lg font-bold mb-2">Real Roads</h3>
                        <p className="text-gray-400 text-sm">
                            Mapbox Directions API for actual road routing with traffic data
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
                        <div className="text-4xl mb-4">📊</div>
                        <h3 className="text-lg font-bold mb-2">25-35% Savings</h3>
                        <p className="text-gray-400 text-sm">
                            Guaranteed optimal routes with exhaustive testing for small groups
                        </p>
                    </div>
                </div>

                <Link
                    href="/demo-ai-optimizer"
                    className="inline-block mt-8 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-purple-500/25"
                >
                    🎮 Launch Demo →
                </Link>

                <p className="text-gray-500 text-sm mt-8">
                    Standalone AI Transport Optimizer • Zero dependencies on main project
                </p>
            </div>
        </div>
    );
}
