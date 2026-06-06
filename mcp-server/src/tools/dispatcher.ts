import { MCPError, ErrorCode } from '../errors.js';
import {
    handleCalculateDistanceMatrix,
    handleOptimizeMultiCluster,
    handleOptimizeRoute,
} from './handlers.js';

export type ToolName = 'optimize_route' | 'optimize_multi_cluster' | 'calculate_distance_matrix';

export const TOOL_NAMES: ToolName[] = [
    'optimize_route',
    'optimize_multi_cluster',
    'calculate_distance_matrix',
];

export function isToolName(value: string): value is ToolName {
    return (TOOL_NAMES as string[]).includes(value);
}

export async function callToolByName(
    toolName: string,
    args: unknown,
    requestId: string
): Promise<unknown> {
    switch (toolName) {
        case 'optimize_route':
            return handleOptimizeRoute(args, requestId);

        case 'optimize_multi_cluster':
            return handleOptimizeMultiCluster(args, requestId);

        case 'calculate_distance_matrix':
            return handleCalculateDistanceMatrix(args, requestId);

        default:
            throw new MCPError(
                ErrorCode.ToolNotFound,
                `Unknown tool: ${toolName}`
            );
    }
}
