/**
 * Prometheus Metrics
 * 
 * In-memory metrics collection for Prometheus scraping.
 */

// ============================================================================
// TYPES
// ============================================================================

interface CounterValue {
    value: number;
    labels: Record<string, string>;
}

interface HistogramValue {
    count: number;
    sum: number;
    buckets: Map<number, number>;
    labels: Record<string, string>;
}

// ============================================================================
// METRICS REGISTRY
// ============================================================================

class MetricsRegistry {
    private counters = new Map<string, CounterValue[]>();
    private histograms = new Map<string, { values: HistogramValue[]; buckets: number[] }>();

    // Default histogram buckets (in seconds)
    private defaultBuckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

    // ========================================================================
    // COUNTER OPERATIONS
    // ========================================================================

    incCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
        if (!this.counters.has(name)) {
            this.counters.set(name, []);
        }

        const values = this.counters.get(name)!;
        const existing = values.find(v => this.labelsMatch(v.labels, labels));

        if (existing) {
            existing.value += value;
        } else {
            values.push({ value, labels });
        }
    }

    // ========================================================================
    // HISTOGRAM OPERATIONS
    // ========================================================================

    observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
        if (!this.histograms.has(name)) {
            this.histograms.set(name, { values: [], buckets: this.defaultBuckets });
        }

        const histogram = this.histograms.get(name)!;
        let existing = histogram.values.find(v => this.labelsMatch(v.labels, labels));

        if (!existing) {
            existing = {
                count: 0,
                sum: 0,
                buckets: new Map(histogram.buckets.map(b => [b, 0])),
                labels,
            };
            histogram.values.push(existing);
        }

        existing.count++;
        existing.sum += value;

        for (const bucket of histogram.buckets) {
            if (value <= bucket) {
                existing.buckets.set(bucket, (existing.buckets.get(bucket) || 0) + 1);
            }
        }
    }

    // ========================================================================
    // EXPORT (Prometheus format)
    // ========================================================================

    export(): string {
        const lines: string[] = [];

        // Export counters
        for (const [name, values] of this.counters) {
            lines.push(`# HELP ${name} Counter metric`);
            lines.push(`# TYPE ${name} counter`);
            for (const v of values) {
                const labelStr = this.formatLabels(v.labels);
                lines.push(`${name}${labelStr} ${v.value}`);
            }
        }

        // Export histograms
        for (const [name, histogram] of this.histograms) {
            lines.push(`# HELP ${name} Histogram metric`);
            lines.push(`# TYPE ${name} histogram`);

            for (const v of histogram.values) {
                const baseLabels = this.formatLabels(v.labels);

                for (const [bucket, count] of v.buckets) {
                    const bucketLabels = this.formatLabels({ ...v.labels, le: String(bucket) });
                    lines.push(`${name}_bucket${bucketLabels} ${count}`);
                }

                const infLabels = this.formatLabels({ ...v.labels, le: '+Inf' });
                lines.push(`${name}_bucket${infLabels} ${v.count}`);
                lines.push(`${name}_sum${baseLabels} ${v.sum}`);
                lines.push(`${name}_count${baseLabels} ${v.count}`);
            }
        }

        return lines.join('\n');
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private labelsMatch(a: Record<string, string>, b: Record<string, string>): boolean {
        const aKeys = Object.keys(a).sort();
        const bKeys = Object.keys(b).sort();
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every((k, i) => k === bKeys[i] && a[k] === b[k]);
    }

    private formatLabels(labels: Record<string, string>): string {
        const entries = Object.entries(labels);
        if (entries.length === 0) return '';
        return `{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
    }

    /**
     * Reset all metrics (for testing)
     */
    reset(): void {
        this.counters.clear();
        this.histograms.clear();
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const metrics = new MetricsRegistry();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Record an HTTP request
 */
export function recordRequest(
    method: string,
    path: string,
    statusCode: number,
    durationSeconds: number
): void {
    const status = String(statusCode);
    const statusClass = `${Math.floor(statusCode / 100)}xx`;

    metrics.incCounter('http_requests_total', { method, path, status: statusClass });
    metrics.observeHistogram('http_request_duration_seconds', durationSeconds, { method, path });

    if (statusCode >= 500) {
        metrics.incCounter('http_errors_total', { method, path, status });
    }
}

/**
 * Record optimization processing time
 */
export function recordOptimization(algorithm: string, durationSeconds: number, success: boolean): void {
    metrics.observeHistogram('optimization_duration_seconds', durationSeconds, { algorithm });
    metrics.incCounter('optimizations_total', { algorithm, success: String(success) });
}

/**
 * Record cache hit/miss
 */
export function recordCacheAccess(hit: boolean): void {
    metrics.incCounter(hit ? 'cache_hits_total' : 'cache_misses_total');
}
