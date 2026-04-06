'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Student, Bus, Cluster, AnimationState } from '@/hooks/useAnimationEngine';

interface AnimationCanvasProps {
    state: AnimationState;
    width: number;
    height: number;
}

const COLORS = {
    void: '#030712',
    cyan: '#06b6d4',
    green: '#10b981',
    red: '#ef4444',
    orange: '#f59e0b',
    dimGray: '#1f2937',
    gridLine: '#111827',
};

export function AnimationCanvas({ state, width, height }: AnimationCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { phase, students, buses, clusters, routes, school } = state;

    const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;
        const spacing = 50;

        for (let x = 0; x < width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }, [width, height]);

    const drawSchool = useCallback((ctx: CanvasRenderingContext2D) => {
        const size = 28;
        const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;

        // Outer glow
        ctx.shadowBlur = 40 * pulse;
        ctx.shadowColor = COLORS.cyan;

        // Building
        ctx.fillStyle = COLORS.cyan;
        ctx.beginPath();
        ctx.roundRect(school.x - size / 2, school.y - size / 2, size, size, 4);
        ctx.fill();

        // Roof triangle
        ctx.beginPath();
        ctx.moveTo(school.x, school.y - size / 2 - 14);
        ctx.lineTo(school.x - size / 2 - 8, school.y - size / 2);
        ctx.lineTo(school.x + size / 2 + 8, school.y - size / 2);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = COLORS.cyan;
        ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(school.label, school.x, school.y - 45);
    }, [school]);

    const drawStudents = useCallback((ctx: CanvasRenderingContext2D) => {
        students.forEach(student => {
            if (student.alpha <= 0) return;

            let color = COLORS.red;
            let size = 6;

            if (student.assigned && student.cluster >= 0 && buses[student.cluster]) {
                color = buses[student.cluster].color;
                size = 7;
            } else if (student.cluster >= 0) {
                color = COLORS.orange;
                size = 6.5;
            }

            ctx.globalAlpha = student.alpha;
            ctx.fillStyle = color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = color;
            ctx.beginPath();
            ctx.arc(student.x, student.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        });
    }, [students, buses]);

    const drawClusters = useCallback((ctx: CanvasRenderingContext2D) => {
        if (phase < 2 || phase >= 6) return;

        clusters.forEach((cluster, idx) => {
            if (cluster.members.length === 0) return;

            let cx = 0, cy = 0;
            cluster.members.forEach(sid => {
                cx += students[sid].x;
                cy += students[sid].y;
            });
            cx /= cluster.members.length;
            cy /= cluster.members.length;

            let maxDist = 0;
            cluster.members.forEach(sid => {
                const dist = Math.hypot(students[sid].x - cx, students[sid].y - cy);
                maxDist = Math.max(maxDist, dist);
            });

            const color = cluster.busId !== -1 && buses[cluster.busId] ? buses[cluster.busId].color : COLORS.orange;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, maxDist + 25, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            if (cluster.busId !== -1) {
                ctx.fillStyle = color;
                ctx.font = 'bold 12px "Inter", system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`CAB ${cluster.busId + 1}`, cx, cy - maxDist - 35);
                ctx.font = '11px "Inter", system-ui, sans-serif';
                ctx.fillText(`${cluster.members.length}/${buses[cluster.busId].capacity}`, cx, cy - maxDist - 22);
            }
        });
    }, [phase, clusters, students, buses]);

    const drawRoutes = useCallback((ctx: CanvasRenderingContext2D) => {
        if (phase < 4) return;

        routes.forEach((route, idx) => {
            const bus = buses[idx];
            if (!route || route.length < 2) return;

            ctx.strokeStyle = bus.color;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 20;
            ctx.shadowColor = bus.color;
            ctx.globalAlpha = phase === 6 ? 1 : 0.4;

            ctx.beginPath();
            ctx.moveTo(route[0].x, route[0].y);

            for (let i = 0; i < route.length - 1; i++) {
                const start = route[i];
                const end = route[i + 1];
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const dist = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx);

                const curvature = 0.3;
                const offsetAngle = angle + Math.PI / 2;
                const variation = Math.sin(idx * 1.5 + i * 0.7) * 0.5 + 0.5;
                const offset = dist * curvature * variation;

                const midX = (start.x + end.x) / 2 + Math.cos(offsetAngle) * offset;
                const midY = (start.y + end.y) / 2 + Math.sin(offsetAngle) * offset;

                ctx.quadraticCurveTo(midX, midY, end.x, end.y);
            }

            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            // Direction arrows in phase 6
            if (phase === 6) {
                for (let i = 0; i < route.length - 1; i++) {
                    const start = route[i];
                    const end = route[i + 1];
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const dist = Math.hypot(dx, dy);
                    const angle = Math.atan2(dy, dx);

                    const curvature = 0.3;
                    const offsetAngle = angle + Math.PI / 2;
                    const variation = Math.sin(idx * 1.5 + i * 0.7) * 0.5 + 0.5;
                    const offset = dist * curvature * variation;

                    const midX = (start.x + end.x) / 2 + Math.cos(offsetAngle) * offset;
                    const midY = (start.y + end.y) / 2 + Math.sin(offsetAngle) * offset;

                    const t = 0.5;
                    const curveX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * midX + t * t * end.x;
                    const curveY = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * midY + t * t * end.y;

                    const tangentX = 2 * (1 - t) * (midX - start.x) + 2 * t * (end.x - midX);
                    const tangentY = 2 * (1 - t) * (midY - start.y) + 2 * t * (end.y - midY);
                    const tangentAngle = Math.atan2(tangentY, tangentX);

                    ctx.fillStyle = bus.color;
                    ctx.save();
                    ctx.translate(curveX, curveY);
                    ctx.rotate(tangentAngle);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-14, -7);
                    ctx.lineTo(-14, 7);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            }
        });
    }, [phase, routes, buses]);

    const drawBuses = useCallback((ctx: CanvasRenderingContext2D) => {
        if (phase < 3) return;

        buses.forEach(bus => {
            if (bus.students.length === 0) return;

            ctx.fillStyle = bus.color;
            ctx.shadowBlur = 25;
            ctx.shadowColor = bus.color;

            // Modern square bus icon
            ctx.beginPath();
            ctx.roundRect(bus.x - 10, bus.y - 10, 20, 20, 4);
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.roundRect(bus.x - 6, bus.y - 6, 12, 6, 2);
            ctx.fill();

            ctx.shadowBlur = 0;
        });
    }, [phase, buses]);

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;

        const render = () => {
            ctx.fillStyle = COLORS.void;
            ctx.fillRect(0, 0, width, height);

            drawGrid(ctx);
            drawClusters(ctx);
            drawRoutes(ctx);
            drawSchool(ctx);
            drawStudents(ctx);
            drawBuses(ctx);

            animationId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationId);
    }, [width, height, drawGrid, drawSchool, drawStudents, drawClusters, drawRoutes, drawBuses]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="block absolute inset-0"
        />
    );
}
