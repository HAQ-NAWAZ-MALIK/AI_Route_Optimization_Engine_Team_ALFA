/**
 * Genetic Algorithm for Route Optimization
 * 
 * Uses evolutionary computing to find optimal routes:
 * - Population of route permutations
 * - Selection via tournament
 * - Order Crossover (OX) for route breeding
 * - Mutation via swap, inversion, insertion
 * - Elitism to preserve best solutions
 */

import type {
    GeneticAlgorithmConfig,
    Individual,
    Population,
    TimeWindow,
} from './types';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: GeneticAlgorithmConfig = {
    populationSize: 50,
    generations: 100,
    crossoverRate: 0.8,
    mutationRate: 0.15,
    elitismCount: 5,
    tournamentSize: 5,
    maxStagnation: 20,
};

// ============================================================================
// MAIN GENETIC ALGORITHM
// ============================================================================

/**
 * Optimize route using genetic algorithm
 * @param distanceMatrix - NxN distance matrix
 * @param startIndex - Fixed starting point (typically depot/office)
 * @param timeWindows - Optional time constraints per stop
 * @param config - Algorithm configuration
 * @returns Best route found as ordered indices
 */
export function optimizeWithGeneticAlgorithm(
    distanceMatrix: number[][],
    startIndex: number = 0,
    timeWindows?: TimeWindow[],
    config: Partial<GeneticAlgorithmConfig> = {}
): { route: number[]; fitness: number; generations: number } {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const n = distanceMatrix.length;

    if (n <= 2) {
        return {
            route: Array.from({ length: n }, (_, i) => i),
            fitness: 0,
            generations: 0,
        };
    }

    // Location indices (excluding start since it's fixed)
    const locationIndices = Array.from({ length: n }, (_, i) => i)
        .filter(i => i !== startIndex);

    // Initialize population
    let population = initializePopulation(
        locationIndices,
        cfg.populationSize,
        distanceMatrix,
        startIndex,
        timeWindows
    );

    let bestIndividual = population.individuals[0];
    let stagnationCount = 0;
    let lastBestFitness = bestIndividual.fitness;

    // Evolution loop
    for (let gen = 0; gen < cfg.generations; gen++) {
        // Selection, crossover, mutation
        const newPopulation = evolvePopulation(
            population,
            distanceMatrix,
            startIndex,
            timeWindows,
            cfg
        );

        population = newPopulation;

        // Update best
        const currentBest = population.individuals[0];
        if (currentBest.fitness < bestIndividual.fitness) {
            bestIndividual = currentBest;
        }

        // Check for stagnation
        if (Math.abs(currentBest.fitness - lastBestFitness) < 0.001) {
            stagnationCount++;
            if (cfg.maxStagnation && stagnationCount >= cfg.maxStagnation) {
                // Early termination
                break;
            }
        } else {
            stagnationCount = 0;
            lastBestFitness = currentBest.fitness;
        }
    }

    // Reconstruct full route with start index
    const fullRoute = [startIndex, ...bestIndividual.chromosome];

    return {
        route: fullRoute,
        fitness: bestIndividual.fitness,
        generations: population.generation,
    };
}

// ============================================================================
// POPULATION INITIALIZATION
// ============================================================================

function initializePopulation(
    locations: number[],
    size: number,
    distanceMatrix: number[][],
    startIndex: number,
    timeWindows?: TimeWindow[]
): Population {
    const individuals: Individual[] = [];

    // Create diverse initial population using multiple heuristics

    // 1. Nearest neighbor variants
    for (let i = 0; i < Math.min(5, size); i++) {
        const route = nearestNeighborVariant(locations, distanceMatrix, startIndex, i);
        individuals.push(evaluateIndividual(route, distanceMatrix, startIndex, timeWindows));
    }

    // 2. Random permutations for the rest
    while (individuals.length < size) {
        const route = shuffleArray([...locations]);
        individuals.push(evaluateIndividual(route, distanceMatrix, startIndex, timeWindows));
    }

    // Sort by fitness (lowest is best)
    individuals.sort((a, b) => a.fitness - b.fitness);

    return {
        individuals,
        generation: 0,
        bestFitness: individuals[0].fitness,
        averageFitness: individuals.reduce((sum, ind) => sum + ind.fitness, 0) / individuals.length,
    };
}

function nearestNeighborVariant(
    locations: number[],
    distanceMatrix: number[][],
    startIndex: number,
    variant: number
): number[] {
    const route: number[] = [];
    const remaining = new Set(locations);

    // Start from different positions based on variant
    let current = startIndex;
    if (variant > 0 && locations.length > variant) {
        current = locations[variant];
        route.push(current);
        remaining.delete(current);
    }

    while (remaining.size > 0) {
        let nearest = -1;
        let nearestDist = Infinity;

        for (const loc of remaining) {
            const dist = distanceMatrix[current][loc];
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = loc;
            }
        }

        if (nearest !== -1) {
            route.push(nearest);
            remaining.delete(nearest);
            current = nearest;
        }
    }

    return route;
}

// ============================================================================
// EVOLUTION
// ============================================================================

function evolvePopulation(
    population: Population,
    distanceMatrix: number[][],
    startIndex: number,
    timeWindows: TimeWindow[] | undefined,
    config: GeneticAlgorithmConfig
): Population {
    const newIndividuals: Individual[] = [];

    // Elitism: keep best individuals
    for (let i = 0; i < config.elitismCount; i++) {
        newIndividuals.push({ ...population.individuals[i] });
    }

    // Fill rest with offspring
    while (newIndividuals.length < config.populationSize) {
        // Selection
        const parent1 = tournamentSelect(population.individuals, config.tournamentSize);
        const parent2 = tournamentSelect(population.individuals, config.tournamentSize);

        // Crossover
        let offspring1: number[], offspring2: number[];
        if (Math.random() < config.crossoverRate) {
            [offspring1, offspring2] = orderCrossover(
                parent1.chromosome,
                parent2.chromosome
            );
        } else {
            offspring1 = [...parent1.chromosome];
            offspring2 = [...parent2.chromosome];
        }

        // Mutation
        if (Math.random() < config.mutationRate) {
            offspring1 = mutate(offspring1);
        }
        if (Math.random() < config.mutationRate) {
            offspring2 = mutate(offspring2);
        }

        // Evaluate and add
        newIndividuals.push(
            evaluateIndividual(offspring1, distanceMatrix, startIndex, timeWindows)
        );
        if (newIndividuals.length < config.populationSize) {
            newIndividuals.push(
                evaluateIndividual(offspring2, distanceMatrix, startIndex, timeWindows)
            );
        }
    }

    // Sort by fitness
    newIndividuals.sort((a, b) => a.fitness - b.fitness);

    return {
        individuals: newIndividuals.slice(0, config.populationSize),
        generation: population.generation + 1,
        bestFitness: newIndividuals[0].fitness,
        averageFitness: newIndividuals.reduce((sum, ind) => sum + ind.fitness, 0) / newIndividuals.length,
    };
}

// ============================================================================
// SELECTION
// ============================================================================

function tournamentSelect(
    individuals: Individual[],
    tournamentSize: number
): Individual {
    let best: Individual | null = null;

    for (let i = 0; i < tournamentSize; i++) {
        const idx = Math.floor(Math.random() * individuals.length);
        const candidate = individuals[idx];

        if (!best || candidate.fitness < best.fitness) {
            best = candidate;
        }
    }

    return best!;
}

// ============================================================================
// CROSSOVER: ORDER CROSSOVER (OX)
// ============================================================================

function orderCrossover(
    parent1: number[],
    parent2: number[]
): [number[], number[]] {
    const n = parent1.length;

    if (n <= 2) {
        return [[...parent1], [...parent2]];
    }

    // Select two random crossover points
    let start = Math.floor(Math.random() * n);
    let end = Math.floor(Math.random() * n);
    if (start > end) [start, end] = [end, start];

    // Create offspring
    const offspring1 = createOXOffspring(parent1, parent2, start, end);
    const offspring2 = createOXOffspring(parent2, parent1, start, end);

    return [offspring1, offspring2];
}

function createOXOffspring(
    parent1: number[],
    parent2: number[],
    start: number,
    end: number
): number[] {
    const n = parent1.length;
    const offspring = new Array(n).fill(-1);
    const usedGenes = new Set<number>();

    // Copy segment from parent1
    for (let i = start; i <= end; i++) {
        offspring[i] = parent1[i];
        usedGenes.add(parent1[i]);
    }

    // Fill remaining positions with genes from parent2
    let currentPos = (end + 1) % n;
    for (let i = 0; i < n; i++) {
        const idx = (end + 1 + i) % n;
        const gene = parent2[idx];

        if (!usedGenes.has(gene)) {
            offspring[currentPos] = gene;
            currentPos = (currentPos + 1) % n;
        }
    }

    return offspring;
}

// ============================================================================
// MUTATION OPERATORS
// ============================================================================

function mutate(chromosome: number[]): number[] {
    const mutationType = Math.random();

    if (mutationType < 0.4) {
        return swapMutation(chromosome);
    } else if (mutationType < 0.7) {
        return inversionMutation(chromosome);
    } else {
        return insertionMutation(chromosome);
    }
}

function swapMutation(chromosome: number[]): number[] {
    const result = [...chromosome];
    const i = Math.floor(Math.random() * result.length);
    let j = Math.floor(Math.random() * result.length);
    while (j === i) j = Math.floor(Math.random() * result.length);

    [result[i], result[j]] = [result[j], result[i]];
    return result;
}

function inversionMutation(chromosome: number[]): number[] {
    const result = [...chromosome];
    let i = Math.floor(Math.random() * result.length);
    let j = Math.floor(Math.random() * result.length);
    if (i > j) [i, j] = [j, i];

    // Reverse segment between i and j
    while (i < j) {
        [result[i], result[j]] = [result[j], result[i]];
        i++;
        j--;
    }

    return result;
}

function insertionMutation(chromosome: number[]): number[] {
    const result = [...chromosome];
    const i = Math.floor(Math.random() * result.length);
    let j = Math.floor(Math.random() * result.length);
    while (j === i) j = Math.floor(Math.random() * result.length);

    const gene = result.splice(i, 1)[0];
    result.splice(j > i ? j - 1 : j, 0, gene);

    return result;
}

// ============================================================================
// FITNESS EVALUATION
// ============================================================================

function evaluateIndividual(
    chromosome: number[],
    distanceMatrix: number[][],
    startIndex: number,
    timeWindows?: TimeWindow[]
): Individual {
    // Calculate total distance
    let distance = 0;
    let current = startIndex;

    for (const next of chromosome) {
        distance += distanceMatrix[current][next];
        current = next;
    }
    distance += distanceMatrix[current][startIndex]; // Return to start

    // Calculate duration (assuming 30 km/h average speed)
    const duration = (distance / 30) * 60; // minutes

    // Calculate time window penalty
    let timeWindowPenalty = 0;
    if (timeWindows && timeWindows.length > 0) {
        let currentTime = 0; // minutes from start
        current = startIndex;

        for (let i = 0; i < chromosome.length; i++) {
            const next = chromosome[i];
            const travelTime = (distanceMatrix[current][next] / 30) * 60;
            currentTime += travelTime;

            if (timeWindows[next]) {
                const tw = timeWindows[next];
                if (currentTime < tw.start) {
                    // Arrived early
                    timeWindowPenalty += (tw.start - currentTime) * 0.5;
                } else if (currentTime > tw.end) {
                    // Arrived late (higher penalty)
                    timeWindowPenalty += (currentTime - tw.end) * 2;
                }
            }

            current = next;
            currentTime += 2; // 2 min buffer per stop
        }
    }

    // Fitness = distance + time window penalty
    const fitness = distance + timeWindowPenalty;

    return {
        chromosome,
        fitness,
        distance,
        duration,
        timeWindowPenalty,
    };
}

// ============================================================================
// UTILITIES
// ============================================================================

function shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Get evolution statistics for monitoring
 */
export function getEvolutionStats(population: Population): {
    generation: number;
    bestFitness: number;
    averageFitness: number;
    worstFitness: number;
    diversity: number;
} {
    const fitnesses = population.individuals.map(i => i.fitness);
    const worstFitness = Math.max(...fitnesses);

    // Calculate diversity as standard deviation of fitness
    const mean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const variance = fitnesses.reduce((sum, f) => sum + (f - mean) ** 2, 0) / fitnesses.length;
    const diversity = Math.sqrt(variance);

    return {
        generation: population.generation,
        bestFitness: population.bestFitness,
        averageFitness: population.averageFitness,
        worstFitness,
        diversity,
    };
}
