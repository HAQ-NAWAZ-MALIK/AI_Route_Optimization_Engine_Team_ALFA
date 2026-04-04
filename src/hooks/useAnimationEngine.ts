'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Types
export interface Student {
    id: number;
    x: number;
    y: number;
    cluster: number;
    assigned: boolean;
    alpha: number;
}

export interface Bus {
    id: number;
    capacity: number;
    color: string;
    students: number[];
    route: { x: number; y: number }[];
    x: number;
    y: number;
    pathIndex: number;
    segmentProgress: number;
}

export interface Cluster {
    busId: number;
    members: number[];
}

export interface Algorithm {
    name: string;
    progress: number;
    distance: number;
    time: number;
    cost: number;
}

export interface AnimationState {
    phase: number;
    animationFrame: number;
    startTime: number;
    students: Student[];
    buses: Bus[];
    clusters: Cluster[];
    routes: { x: number; y: number }[][];
    algorithms: Algorithm[];
    winnerIndex: number;
    school: { x: number; y: number; label: string };
}

// Constants
const NUM_STUDENTS = 45;
const NUM_BUSES = 5;
const BUS_CAPACITIES = [12, 10, 8, 10, 12];
const BUS_COLORS = ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];

const INITIAL_ALGORITHMS: Algorithm[] = [
    { name: 'Christofides TSP', progress: 0, distance: 0, time: 0, cost: 0 },
    { name: 'Genetic Algorithm', progress: 0, distance: 0, time: 0, cost: 0 },
    { name: 'Nearest Neighbor', progress: 0, distance: 0, time: 0, cost: 0 },
    { name: 'Simulated Annealing', progress: 0, distance: 0, time: 0, cost: 0 },
];

export function useAnimationEngine(canvasWidth: number, canvasHeight: number) {
    const [state, setState] = useState<AnimationState>(() => ({
        phase: 0,
        animationFrame: 0,
        startTime: 0,
        students: [],
        buses: [],
        clusters: [],
        routes: [],
        algorithms: [...INITIAL_ALGORITHMS],
        winnerIndex: -1,
        school: { x: canvasWidth / 2, y: canvasHeight / 2, label: 'COMPANY HQ' },
    }));

    const animationRef = useRef<number | null>(null);
    const isRunning = useRef(false);

    // Initialize students
    const initializeStudents = useCallback((schoolX: number, schoolY: number): Student[] => {
        const students: Student[] = [];
        for (let i = 0; i < NUM_STUDENTS; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 150 + Math.random() * 280;
            students.push({
                id: i,
                x: schoolX + Math.cos(angle) * distance,
                y: schoolY + Math.sin(angle) * distance,
                cluster: -1,
                assigned: false,
                alpha: 0,
            });
        }
        return students;
    }, []);

    // Initialize buses
    const initializeBuses = useCallback((schoolX: number, schoolY: number): Bus[] => {
        return BUS_CAPACITIES.map((capacity, i) => ({
            id: i,
            capacity,
            color: BUS_COLORS[i],
            students: [],
            route: [],
            x: schoolX,
            y: schoolY,
            pathIndex: 0,
            segmentProgress: 0,
        }));
    }, []);

    // Reset and initialize
    const initialize = useCallback(() => {
        const schoolX = canvasWidth / 2;
        const schoolY = canvasHeight / 2;

        setState({
            phase: 0,
            animationFrame: 0,
            startTime: 0,
            students: initializeStudents(schoolX, schoolY),
            buses: initializeBuses(schoolX, schoolY),
            clusters: [],
            routes: [],
            algorithms: INITIAL_ALGORITHMS.map(a => ({ ...a })),
            winnerIndex: -1,
            school: { x: schoolX, y: schoolY, label: 'COMPANY HQ' },
        });
    }, [canvasWidth, canvasHeight, initializeStudents, initializeBuses]);

    // Update school position on resize
    useEffect(() => {
        setState(prev => ({
            ...prev,
            school: { ...prev.school, x: canvasWidth / 2, y: canvasHeight / 2 },
        }));
    }, [canvasWidth, canvasHeight]);

    // Phase update functions
    const updatePhase1 = useCallback((prev: AnimationState): AnimationState => {
        const newStudents = [...prev.students];
        const studentsPerFrame = 2;
        const startIdx = Math.floor(prev.animationFrame / 15) * studentsPerFrame;

        for (let i = startIdx; i < Math.min(startIdx + studentsPerFrame, NUM_STUDENTS); i++) {
            if (newStudents[i]) {
                newStudents[i] = { ...newStudents[i], alpha: Math.min(1, newStudents[i].alpha + 0.1) };
            }
        }

        const nextPhase = prev.animationFrame > 150 ? 2 : prev.phase;
        return {
            ...prev,
            students: newStudents,
            phase: nextPhase,
            animationFrame: nextPhase !== prev.phase ? 0 : prev.animationFrame + 1,
        };
    }, []);

    const updatePhase2 = useCallback((prev: AnimationState): AnimationState => {
        let newClusters = prev.clusters;
        let newStudents = prev.students;

        if (prev.animationFrame === 1) {
            // K-means clustering simulation
            newClusters = Array.from({ length: NUM_BUSES }, () => ({ busId: -1, members: [] }));
            newStudents = prev.students.map((student, idx) => {
                const angle = Math.atan2(student.y - prev.school.y, student.x - prev.school.x);
                const normalizedAngle = (angle + Math.PI) / (2 * Math.PI);
                const clusterIdx = Math.floor(normalizedAngle * NUM_BUSES) % NUM_BUSES;
                newClusters[clusterIdx].members.push(idx);
                return { ...student, cluster: clusterIdx };
            });
        }

        const nextPhase = prev.animationFrame > 120 ? 3 : prev.phase;
        return {
            ...prev,
            students: newStudents,
            clusters: newClusters,
            phase: nextPhase,
            animationFrame: nextPhase !== prev.phase ? 0 : prev.animationFrame + 1,
        };
    }, []);

    const updatePhase3 = useCallback((prev: AnimationState): AnimationState => {
        let newClusters = prev.clusters;
        let newStudents = prev.students;
        let newBuses = prev.buses;

        if (prev.animationFrame === 1) {
            newClusters = prev.clusters.map((cluster, idx) => ({ ...cluster, busId: idx }));
            newStudents = prev.students.map(student => ({
                ...student,
                assigned: student.cluster >= 0,
            }));
            newBuses = prev.buses.map((bus, idx) => ({
                ...bus,
                students: prev.clusters[idx]?.members || [],
            }));
        }

        const nextPhase = prev.animationFrame > 90 ? 4 : prev.phase;
        return {
            ...prev,
            students: newStudents,
            clusters: newClusters,
            buses: newBuses,
            phase: nextPhase,
            animationFrame: nextPhase !== prev.phase ? 0 : prev.animationFrame + 1,
        };
    }, []);

    const updatePhase4 = useCallback((prev: AnimationState): AnimationState => {
        const speeds = [0.8, 1.2, 1.0, 0.9];
        const newAlgorithms = prev.algorithms.map((algo, idx) => {
            const newProgress = Math.min(100, algo.progress + speeds[idx]);
            let distance = algo.distance;
            let time = algo.time;
            let cost = algo.cost;

            if (newProgress > 50 && algo.distance === 0) {
                distance = 180 + Math.random() * 40;
                time = 45 + Math.random() * 15;
                cost = distance * 8.5;
            }

            return { ...algo, progress: newProgress, distance, time, cost };
        });

        const allComplete = newAlgorithms.every(a => a.progress >= 100);
        const nextPhase = allComplete ? 5 : prev.phase;

        return {
            ...prev,
            algorithms: newAlgorithms,
            phase: nextPhase,
            animationFrame: nextPhase !== prev.phase ? 0 : prev.animationFrame + 1,
        };
    }, []);

    const updatePhase5 = useCallback((prev: AnimationState): AnimationState => {
        let newWinnerIndex = prev.winnerIndex;
        let newRoutes = prev.routes;

        if (prev.animationFrame === 30) {
            // Find winner (lowest distance)
            newWinnerIndex = 0;
            let minDist = prev.algorithms[0].distance;
            prev.algorithms.forEach((algo, idx) => {
                if (algo.distance < minDist) {
                    minDist = algo.distance;
                    newWinnerIndex = idx;
                }
            });

            // Generate routes
            newRoutes = prev.buses.map(bus => {
                const route = [prev.school];
                bus.students.forEach(sid => route.push(prev.students[sid]));
                route.push(prev.school);
                return route;
            });
        }

        const nextPhase = prev.animationFrame > 90 ? 6 : prev.phase;
        const newBuses = nextPhase === 6 ? prev.buses.map(bus => ({
            ...bus,
            x: prev.school.x,
            y: prev.school.y,
            pathIndex: 0,
            segmentProgress: 0,
        })) : prev.buses;

        return {
            ...prev,
            winnerIndex: newWinnerIndex,
            routes: newRoutes,
            buses: newBuses,
            phase: nextPhase,
            animationFrame: nextPhase !== prev.phase ? 0 : prev.animationFrame + 1,
        };
    }, []);

    const updatePhase6 = useCallback((prev: AnimationState): AnimationState => {
        const newBuses = prev.buses.map((bus, idx) => {
            const route = prev.routes[idx];
            if (!route || bus.pathIndex >= route.length - 1) return bus;

            const start = route[bus.pathIndex];
            const end = route[bus.pathIndex + 1];

            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            const curvature = 0.3;
            const offsetAngle = angle + Math.PI / 2;
            const variation = Math.sin(idx * 1.5 + bus.pathIndex * 0.7) * 0.5 + 0.5;
            const offset = dist * curvature * variation;

            const ctrlX = (start.x + end.x) / 2 + Math.cos(offsetAngle) * offset;
            const ctrlY = (start.y + end.y) / 2 + Math.sin(offsetAngle) * offset;

            let newSegmentProgress = bus.segmentProgress + 0.03;
            let newPathIndex = bus.pathIndex;
            let newX = bus.x;
            let newY = bus.y;

            if (newSegmentProgress >= 1) {
                newPathIndex++;
                newSegmentProgress = 0;
            } else {
                const t = newSegmentProgress;
                newX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * ctrlX + t * t * end.x;
                newY = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * ctrlY + t * t * end.y;
            }

            return { ...bus, x: newX, y: newY, pathIndex: newPathIndex, segmentProgress: newSegmentProgress };
        });

        return {
            ...prev,
            buses: newBuses,
            animationFrame: prev.animationFrame + 1,
        };
    }, []);

    // Animation loop
    const tick = useCallback(() => {
        if (!isRunning.current) return;

        setState(prev => {
            if (prev.phase === 0) return prev;
            if (prev.phase === 1) return updatePhase1(prev);
            if (prev.phase === 2) return updatePhase2(prev);
            if (prev.phase === 3) return updatePhase3(prev);
            if (prev.phase === 4) return updatePhase4(prev);
            if (prev.phase === 5) return updatePhase5(prev);
            if (prev.phase === 6) return updatePhase6(prev);
            return prev;
        });

        animationRef.current = requestAnimationFrame(tick);
    }, [updatePhase1, updatePhase2, updatePhase3, updatePhase4, updatePhase5, updatePhase6]);

    // Start animation
    const start = useCallback(() => {
        if (state.phase !== 0) return;

        isRunning.current = true;
        setState(prev => ({
            ...prev,
            phase: 1,
            animationFrame: 0,
            startTime: Date.now(),
        }));
        animationRef.current = requestAnimationFrame(tick);
    }, [state.phase, tick]);

    // Stop animation
    const stop = useCallback(() => {
        isRunning.current = false;
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
    }, []);

    // Reset
    const reset = useCallback(() => {
        stop();
        initialize();
    }, [stop, initialize]);

    // Initialize on mount
    useEffect(() => {
        initialize();
        return () => stop();
    }, [initialize, stop]);

    // Continue tick while running
    useEffect(() => {
        if (state.phase > 0 && state.phase < 7) {
            animationRef.current = requestAnimationFrame(tick);
        }
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [state.phase, tick]);

    const elapsedTime = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
    const isComplete = state.phase === 6 && state.animationFrame > 120;

    return {
        ...state,
        elapsedTime,
        isComplete,
        start,
        stop,
        reset,
    };
}
