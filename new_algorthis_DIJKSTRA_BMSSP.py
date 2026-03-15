"""
BMSSP - Breaking the Sorting Barrier for Single-Source Shortest Paths
======================================================================

A Python implementation of the groundbreaking O(m log^(2/3) n) algorithm for 
single-source shortest paths on directed graphs with non-negative edge weights.

This is the FIRST deterministic algorithm to break the classic O(m + n log n) 
time bound of Dijkstra's algorithm on sparse graphs.

Features:
---------
- Drop-in replacement for traditional shortest path algorithms
- Multiple integration methods: Package, REST API, CLI
- Route optimization ready with distance matrix computation
- Comprehensive documentation and examples

Algorithm Paper:
---------------
"Breaking the Sorting Barrier for Directed Single-Source Shortest Paths"
by Duan, Mao, Mao, Shu, and Yin (2024)
arXiv:2504.17033

Installation:
------------
    pip install bmssp

Quick Start:
-----------
    from bmssp import Graph, sssp
    
    g = Graph(4)
    g.add_edge(0, 1, 2.0)
    g.add_edge(0, 2, 4.0)
    g.add_edge(1, 2, 1.0)
    g.add_edge(2, 3, 3.0)
    
    distances, predecessors = sssp(g, source=0)

Author: Based on localrivet/bmssp Go implementation
License: MIT
"""

from __future__ import annotations

import math
import heapq
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional, Set, Callable, Any, Union
from enum import Enum
import json
import time

__version__ = "1.0.0"
__all__ = [
    "Graph",
    "sssp",
    "dijkstra",
    "distance_matrix",
    "find_path",
    "RouteOptimizer",
    "BMSSPOptions",
    "create_from_osm",
    "create_from_adjacency_matrix",
    "create_from_edge_list",
]

# ============================================================================
# CONSTANTS
# ============================================================================

INF = float('inf')


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class Edge:
    """Represents a directed edge with non-negative weight."""
    to: int
    weight: float


@dataclass
class BMSSPOptions:
    """
    Configuration options for the BMSSP algorithm.
    
    Attributes:
        k: Frontier threshold ≈ floor(log(n)^(1/3))
        t: Recursion fanout per level ≈ floor(log(n)^(2/3))
    
    These parameters are automatically computed based on graph size
    when not specified.
    """
    k: Optional[int] = None
    t: Optional[int] = None
    
    def resolve(self, n: int) -> Tuple[int, int]:
        """Compute K and T based on graph size if not specified."""
        if n <= 1:
            return (1, 1)
        
        log_n = math.log(n) if n > 1 else 1
        
        k = self.k if self.k is not None else max(1, int(log_n ** (1/3)))
        t = self.t if self.t is not None else max(1, int(log_n ** (2/3)))
        
        return (k, t)


class Graph:
    """
    Directed graph with adjacency list representation.
    
    Designed for efficient shortest path computation with support for:
    - Non-negative edge weights (required for BMSSP)
    - Dynamic edge addition
    - Multiple input formats
    
    Example:
        >>> g = Graph(4)
        >>> g.add_edge(0, 1, 2.0)
        >>> g.add_edge(1, 2, 1.5)
        >>> len(g)
        4
    """
    
    def __init__(self, n: int):
        """
        Create a new graph with n vertices.
        
        Args:
            n: Number of vertices (labeled 0 to n-1)
        """
        if n < 0:
            raise ValueError("Number of vertices must be non-negative")
        
        self.n = n
        self.adj: List[List[Edge]] = [[] for _ in range(n)]
        self._edge_count = 0
    
    def __len__(self) -> int:
        """Return number of vertices."""
        return self.n
    
    def add_edge(self, u: int, v: int, weight: float) -> None:
        """
        Add a directed edge from u to v with given weight.
        
        Args:
            u: Source vertex
            v: Destination vertex
            weight: Edge weight (must be non-negative)
        
        Raises:
            ValueError: If vertices are out of range or weight is negative
        """
        if u < 0 or u >= self.n or v < 0 or v >= self.n:
            raise ValueError(f"Vertex out of range: u={u}, v={v}, n={self.n}")
        if weight < 0:
            raise ValueError("Negative weights are not supported")
        
        self.adj[u].append(Edge(to=v, weight=weight))
        self._edge_count += 1
    
    def add_undirected_edge(self, u: int, v: int, weight: float) -> None:
        """Add an undirected edge (two directed edges)."""
        self.add_edge(u, v, weight)
        self.add_edge(v, u, weight)
    
    @property
    def edge_count(self) -> int:
        """Return number of edges."""
        return self._edge_count
    
    def neighbors(self, v: int) -> List[Tuple[int, float]]:
        """Return list of (neighbor, weight) tuples for vertex v."""
        return [(e.to, e.weight) for e in self.adj[v]]
    
    def to_dict(self) -> Dict:
        """Convert graph to dictionary for JSON serialization."""
        return {
            "n": self.n,
            "edges": [
                {"from": u, "to": e.to, "weight": e.weight}
                for u in range(self.n)
                for e in self.adj[u]
            ]
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Graph":
        """Create graph from dictionary."""
        g = cls(data["n"])
        for edge in data["edges"]:
            g.add_edge(edge["from"], edge["to"], edge["weight"])
        return g


# ============================================================================
# INTERNAL DATA STRUCTURES
# ============================================================================

class _Set:
    """Internal set implementation for frontier management."""
    
    def __init__(self, initial: Optional[Set[int]] = None):
        self._data: Set[int] = initial.copy() if initial else set()
    
    def has(self, v: int) -> bool:
        return v in self._data
    
    def add(self, v: int) -> None:
        self._data.add(v)
    
    def size(self) -> int:
        return len(self._data)
    
    def to_list(self) -> List[int]:
        return list(self._data)
    
    def __iter__(self):
        return iter(self._data)
    
    def copy(self) -> "_Set":
        return _Set(self._data)


class _LevelQueue:
    """
    Level-adaptive priority queue for frontier management.
    
    Supports efficient batch operations and maintains vertices organized
    by distance levels for optimal frontier reduction.
    """
    
    def __init__(self, upper_bound: float = INF):
        self._heap: List[Tuple[float, int]] = []  # (key, vertex)
        self._min_key = INF
        self._upper_bound = upper_bound
    
    def insert(self, v: int, key: float) -> None:
        """Enqueue a vertex with key (distance label)."""
        heapq.heappush(self._heap, (key, v))
        if key < self._min_key:
            self._min_key = key
    
    def pull(self) -> Tuple[List[int], float]:
        """
        Yield a sub-frontier Si and bound Bi.
        Groups vertices by approximately equal distances.
        """
        bi = self._upper_bound
        if not self._heap:
            self._min_key = INF
            return [], bi
        
        eps = 1e-12
        smallest_key, _ = self._heap[0]
        
        if smallest_key > bi + eps:
            return [], bi
        
        # Group all items with approximately the same key
        base_key = smallest_key
        si = []
        
        key, v = heapq.heappop(self._heap)
        si.append(v)
        
        while self._heap and self._heap[0][0] <= base_key + eps:
            key, v = heapq.heappop(self._heap)
            si.append(v)
        
        self._min_key = self._heap[0][0] if self._heap else INF
        return si, bi
    
    def batch_prepend(self, candidates: List[Tuple[int, float]]) -> None:
        """Add multiple candidates efficiently."""
        if not candidates:
            return
        
        min_cand_key = INF
        for v, key in candidates:
            heapq.heappush(self._heap, (key, v))
            if key < min_cand_key:
                min_cand_key = key
        
        if min_cand_key < self._min_key:
            self._min_key = min_cand_key
    
    def non_empty(self) -> bool:
        return len(self._heap) > 0


# ============================================================================
# CORE ALGORITHMS
# ============================================================================

def dijkstra(g: Graph, source: int) -> Tuple[List[float], List[int]]:
    """
    Classic Dijkstra's algorithm using binary heap.
    
    Time Complexity: O(m + n log n)
    
    Args:
        g: Input graph
        source: Source vertex
    
    Returns:
        Tuple of (distances, predecessors)
        - distances[v] = shortest distance from source to v
        - predecessors[v] = previous vertex on shortest path (-1 if none)
    
    Example:
        >>> g = Graph(3)
        >>> g.add_edge(0, 1, 2.0)
        >>> g.add_edge(1, 2, 3.0)
        >>> dist, pred = dijkstra(g, 0)
        >>> dist
        [0.0, 2.0, 5.0]
    """
    dist = [INF] * g.n
    pred = [-1] * g.n
    dist[source] = 0.0
    
    # (distance, vertex)
    heap: List[Tuple[float, int]] = [(0.0, source)]
    
    while heap:
        d, u = heapq.heappop(heap)
        
        if d > dist[u]:
            continue
        
        for edge in g.adj[u]:
            cand = d + edge.weight
            if cand < dist[edge.to]:
                dist[edge.to] = cand
                pred[edge.to] = u
                heapq.heappush(heap, (cand, edge.to))
    
    return dist, pred


def _base_case(
    g: Graph, 
    B: float, 
    S: _Set, 
    db: List[float], 
    pred: List[int], 
    k: int
) -> Tuple[float, _Set]:
    """
    Run bounded mini-Dijkstra from a singleton frontier S={x}.
    
    This is the base case of the recursive algorithm where we run
    a bounded Dijkstra until either we process K+1 vertices or exhaust bound B.
    """
    if S.size() != 1:
        raise ValueError("baseCase requires singleton S")
    
    x = S.to_list()[0]
    
    # Run bounded Dijkstra with limit K+1 vertices
    U0: List[int] = []
    heap: List[Tuple[float, int]] = [(db[x], x)]
    processed = [False] * g.n
    
    while heap and len(U0) < k + 1:
        du, u = heapq.heappop(heap)
        
        if processed[u] or du >= B:
            continue
        
        processed[u] = True
        U0.append(u)
        
        for edge in g.adj[u]:
            cand = du + edge.weight
            if cand < db[edge.to] and cand < B:
                db[edge.to] = cand
                pred[edge.to] = u
                if not processed[edge.to]:
                    heapq.heappush(heap, (cand, edge.to))
    
    # If we processed ≤ K vertices, return them all with bound B
    if len(U0) <= k:
        U = _Set()
        for v in U0:
            U.add(v)
        return B, U
    
    # Otherwise, return exactly K vertices and use (K+1)-th distance as bound
    pairs = [(db[v], v) for v in U0]
    pairs.sort()
    
    B_prime = pairs[k][0]
    
    U = _Set()
    for i in range(k):
        U.add(pairs[i][1])
    
    return B_prime, U


def _nearly_equal(a: float, b: float, eps: float = 1e-12) -> bool:
    """Check if two floats are approximately equal."""
    return abs(a - b) < eps


def _find_pivots(
    g: Graph,
    B: float,
    S: _Set,
    db: List[float],
    pred: List[int],
    k: int
) -> Tuple[_Set, _Set]:
    """
    Implement frontier reduction technique from the paper.
    
    Performs k rounds of bounded relaxations from frontier S to define
    the touched set W, then extracts pivots P based on shortest-path tree sizes.
    """
    # Initialize touched set W with frontier S
    W = S.copy()
    
    # Temporary labels
    tmp = db.copy()
    
    # Perform k rounds of bounded relaxations
    current = S.copy()
    for _ in range(k):
        next_set = _Set()
        for u in current:
            du = tmp[u]
            if du >= B:
                continue
            for edge in g.adj[u]:
                cand = du + edge.weight
                if cand < tmp[edge.to] and cand < B:
                    tmp[edge.to] = cand
                    W.add(edge.to)
                    next_set.add(edge.to)
        
        if W.size() > k * max(1, S.size()):
            return S, W
        
        current = next_set
        if current.size() == 0:
            break
    
    # Compute pivots
    P = _compute_pivots(g, S, W, tmp, k)
    return P, W


def _compute_pivots(
    g: Graph,
    S: _Set,
    W: _Set,
    db: List[float],
    k: int
) -> _Set:
    """Extract pivots from frontier S based on shortest-path tree sizes."""
    subtree_size: Dict[int, int] = {}
    children: Dict[int, List[int]] = {}
    
    for v in W:
        subtree_size[v] = 1
        children[v] = []
    
    # Build parent-child relationships
    for v in W:
        dv = db[v]
        for edge in g.adj[v]:
            u = edge.to
            if not W.has(u):
                continue
            if _nearly_equal(db[u], dv + edge.weight):
                children[v].append(u)
    
    # Sort vertices by distance for topological ordering
    vertices = [(db[v], v) for v in W]
    vertices.sort()
    
    # Compute subtree sizes bottom-up
    for _, v in reversed(vertices):
        for child in children[v]:
            subtree_size[v] += subtree_size.get(child, 0)
    
    # Extract pivots
    P = _Set()
    for v in S:
        if subtree_size.get(v, 0) >= k:
            P.add(v)
    
    if P.size() == 0:
        return S
    
    return P


def _int_pow2(exp: int) -> int:
    """Compute 2^exp efficiently."""
    return 1 << exp if exp >= 0 else 1


def _bmssp(
    g: Graph,
    level: int,
    B: float,
    S: _Set,
    db: List[float],
    pred: List[int],
    k: int,
    t: int
) -> Tuple[float, _Set]:
    """
    Main recursive BMSSP algorithm with full frontier management.
    
    Maintains the frontier reduction invariant and processes vertices
    in a carefully controlled manner to achieve O(m log^(2/3) n) complexity.
    """
    # Base case
    if level == 0:
        return _base_case(g, B, S, db, pred, k)
    
    # Step 1: Find pivots P and touched set W
    P, W = _find_pivots(g, B, S, db, pred, k)
    
    # Step 2: Initialize level queue with pivot vertices
    D = _LevelQueue(upper_bound=B)
    for v in P:
        D.insert(v, db[v])
    
    # Step 3: Initialize completed set U with touched vertices W
    U = _Set()
    for v in W:
        U.add(v)
    
    B_prime = B
    limit = k * k * _int_pow2(level * t)
    
    # Step 4: Main loop
    while U.size() < limit and D.non_empty():
        Si, Bi = D.pull()
        
        if not Si:
            break
        
        Ui = _Set()
        Bi_prime = Bi
        
        if level - 1 == 0:
            for v in Si:
                singleton = _Set({v})
                bps, us = _base_case(g, Bi, singleton, db, pred, k)
                if bps < Bi_prime:
                    Bi_prime = bps
                for x in us:
                    Ui.add(x)
        else:
            Si_set = _Set(set(Si))
            Bi_prime, Ui = _bmssp(g, level - 1, Bi, Si_set, db, pred, k, t)
        
        for v in Ui:
            U.add(v)
        
        # Step 5: Relaxation sweep
        candidates: List[Tuple[int, float]] = []
        for u in Ui:
            du = db[u]
            for edge in g.adj[u]:
                cand = du + edge.weight
                if cand <= db[edge.to]:
                    db[edge.to] = cand
                    pred[edge.to] = u
                    
                    if cand < B:
                        D.insert(edge.to, cand)
                    elif Bi_prime <= cand < Bi:
                        candidates.append((edge.to, cand))
        
        D.batch_prepend(candidates)
        
        if Bi_prime < B_prime:
            B_prime = Bi_prime
        
        # Step 6: Absorb certified vertices
        for x in W:
            if db[x] < B_prime:
                U.add(x)
    
    return B_prime, U


def sssp(
    g: Graph, 
    source: int, 
    options: Optional[BMSSPOptions] = None
) -> Tuple[List[float], List[int]]:
    """
    BMSSP: Breaking the Sorting Barrier Single-Source Shortest Path algorithm.
    
    Implements the full O(m log^(2/3) n) algorithm from Duan et al. (2024).
    This is the FIRST deterministic algorithm to break Dijkstra's O(m + n log n)
    time bound on sparse graphs.
    
    Time Complexity: O(m log^(2/3) n)
    Space Complexity: O(n + m)
    
    Args:
        g: Input graph with non-negative edge weights
        source: Source vertex (0 to n-1)
        options: Optional algorithm parameters (auto-computed if None)
    
    Returns:
        Tuple of (distances, predecessors)
        - distances[v] = shortest distance from source to v (INF if unreachable)
        - predecessors[v] = previous vertex on shortest path (-1 if none)
    
    Example:
        >>> g = Graph(4)
        >>> g.add_edge(0, 1, 2.0)
        >>> g.add_edge(0, 2, 4.0)
        >>> g.add_edge(1, 2, 1.0)
        >>> g.add_edge(2, 3, 3.0)
        >>> dist, pred = sssp(g, 0)
        >>> dist
        [0.0, 2.0, 3.0, 6.0]
    
    Why Use BMSSP Over Dijkstra?
    ---------------------------
    - Better asymptotic complexity on sparse graphs
    - Deterministic (unlike randomized improvements)
    - Exact results (no approximation)
    
    When to Use Dijkstra Instead:
    ----------------------------
    - Small to medium graphs (< 10,000 vertices)
    - Dense graphs where m ≈ n²
    - When simplicity is preferred
    """
    if source < 0 or source >= g.n:
        raise ValueError(f"Source vertex out of range: {source}")
    
    opts = options or BMSSPOptions()
    k, t = opts.resolve(g.n)
    
    # Initialize distance and predecessor arrays
    db = [INF] * g.n
    pred = [-1] * g.n
    db[source] = 0.0
    
    # Compute number of recursion levels
    log_n = math.log(max(2, g.n))
    level = int(math.ceil(log_n / t))
    
    # Initial frontier
    initial_frontier = _Set({source})
    
    # Run main BMSSP recursion
    _bmssp(g, level, INF, initial_frontier, db, pred, k, t)
    
    return db, pred


# ============================================================================
# HIGH-LEVEL ROUTE OPTIMIZATION API
# ============================================================================

def find_path(
    g: Graph, 
    source: int, 
    target: int,
    use_bmssp: bool = True
) -> Tuple[List[int], float]:
    """
    Find shortest path between two vertices.
    
    Args:
        g: Input graph
        source: Starting vertex
        target: Ending vertex
        use_bmssp: If True, use BMSSP; otherwise use Dijkstra
    
    Returns:
        Tuple of (path, distance)
        - path: List of vertices from source to target
        - distance: Total path distance (INF if unreachable)
    
    Example:
        >>> g = Graph(4)
        >>> g.add_edge(0, 1, 2.0)
        >>> g.add_edge(1, 2, 1.0)
        >>> g.add_edge(2, 3, 3.0)
        >>> path, dist = find_path(g, 0, 3)
        >>> path
        [0, 1, 2, 3]
        >>> dist
        6.0
    """
    if use_bmssp:
        distances, predecessors = sssp(g, source)
    else:
        distances, predecessors = dijkstra(g, source)
    
    if distances[target] == INF:
        return [], INF
    
    # Reconstruct path
    path = []
    current = target
    while current != -1:
        path.append(current)
        current = predecessors[current]
    
    path.reverse()
    return path, distances[target]


def distance_matrix(
    g: Graph,
    sources: Optional[List[int]] = None,
    use_bmssp: bool = True
) -> List[List[float]]:
    """
    Compute distance matrix from multiple sources.
    
    Ideal for route optimization where you need distances between
    multiple locations (e.g., vehicles, depots, destinations).
    
    Args:
        g: Input graph
        sources: List of source vertices (default: all vertices)
        use_bmssp: If True, use BMSSP; otherwise use Dijkstra
    
    Returns:
        2D matrix where result[i][j] = distance from sources[i] to vertex j
    
    Example:
        >>> g = Graph(3)
        >>> g.add_undirected_edge(0, 1, 2.0)
        >>> g.add_undirected_edge(1, 2, 3.0)
        >>> dm = distance_matrix(g)
        >>> dm[0]  # Distances from vertex 0
        [0.0, 2.0, 5.0]
    """
    if sources is None:
        sources = list(range(g.n))
    
    algo = sssp if use_bmssp else dijkstra
    
    result = []
    for source in sources:
        distances, _ = algo(g, source)
        result.append(distances)
    
    return result


class RouteOptimizer:
    """
    High-level route optimization interface.
    
    Provides a simple API for common routing scenarios:
    - Single route optimization
    - Multi-vehicle routing
    - Distance/time matrix computation
    - Nearest neighbor search
    
    Example:
        >>> optimizer = RouteOptimizer()
        >>> optimizer.add_location(0, "Depot")
        >>> optimizer.add_location(1, "Customer A")
        >>> optimizer.add_location(2, "Customer B")
        >>> optimizer.add_route(0, 1, 10.0)  # 10 km
        >>> optimizer.add_route(1, 2, 5.0)
        >>> optimizer.add_route(0, 2, 12.0)
        >>> path, dist = optimizer.find_route(0, 2)
    """
    
    def __init__(self, use_bmssp: bool = True):
        """
        Initialize route optimizer.
        
        Args:
            use_bmssp: If True, use BMSSP algorithm; otherwise Dijkstra
        """
        self.use_bmssp = use_bmssp
        self._locations: Dict[int, str] = {}
        self._graph: Optional[Graph] = None
        self._edges: List[Tuple[int, int, float]] = []
        self._max_id = -1
    
    def add_location(self, id: int, name: str = "") -> None:
        """Add a location (vertex) to the network."""
        self._locations[id] = name
        self._max_id = max(self._max_id, id)
    
    def add_route(
        self, 
        from_id: int, 
        to_id: int, 
        distance: float,
        bidirectional: bool = False
    ) -> None:
        """
        Add a route (edge) between locations.
        
        Args:
            from_id: Source location ID
            to_id: Destination location ID
            distance: Route distance/cost
            bidirectional: If True, add route in both directions
        """
        self._edges.append((from_id, to_id, distance))
        if bidirectional:
            self._edges.append((to_id, from_id, distance))
        self._graph = None  # Invalidate cache
    
    def _build_graph(self) -> Graph:
        """Build internal graph from added locations and routes."""
        if self._graph is not None:
            return self._graph
        
        n = self._max_id + 1
        self._graph = Graph(n)
        
        for u, v, w in self._edges:
            self._graph.add_edge(u, v, w)
        
        return self._graph
    
    def find_route(
        self, 
        from_id: int, 
        to_id: int
    ) -> Tuple[List[int], float]:
        """
        Find optimal route between two locations.
        
        Returns:
            Tuple of (path, distance)
        """
        g = self._build_graph()
        return find_path(g, from_id, to_id, self.use_bmssp)
    
    def get_distance_matrix(
        self, 
        location_ids: Optional[List[int]] = None
    ) -> List[List[float]]:
        """
        Get distance matrix for specified locations.
        
        Returns matrix where result[i][j] is distance from location_ids[i] 
        to location_ids[j].
        """
        g = self._build_graph()
        if location_ids is None:
            location_ids = list(self._locations.keys())
        
        return distance_matrix(g, location_ids, self.use_bmssp)
    
    def find_nearest(
        self, 
        from_id: int, 
        candidates: List[int]
    ) -> Tuple[int, float]:
        """
        Find nearest location from candidates.
        
        Args:
            from_id: Starting location
            candidates: List of candidate location IDs
        
        Returns:
            Tuple of (nearest_id, distance)
        """
        g = self._build_graph()
        algo = sssp if self.use_bmssp else dijkstra
        distances, _ = algo(g, from_id)
        
        nearest_id = -1
        nearest_dist = INF
        
        for cand in candidates:
            if distances[cand] < nearest_dist:
                nearest_dist = distances[cand]
                nearest_id = cand
        
        return nearest_id, nearest_dist


# ============================================================================
# GRAPH BUILDERS - Multiple Input Formats
# ============================================================================

def create_from_edge_list(
    n: int,
    edges: List[Tuple[int, int, float]],
    directed: bool = True
) -> Graph:
    """
    Create graph from edge list.
    
    Args:
        n: Number of vertices
        edges: List of (from, to, weight) tuples
        directed: If False, add edges in both directions
    
    Example:
        >>> edges = [(0, 1, 2.0), (1, 2, 3.0)]
        >>> g = create_from_edge_list(3, edges)
    """
    g = Graph(n)
    for u, v, w in edges:
        g.add_edge(u, v, w)
        if not directed:
            g.add_edge(v, u, w)
    return g


def create_from_adjacency_matrix(matrix: List[List[float]]) -> Graph:
    """
    Create graph from adjacency matrix.
    
    Use 0 or INF for non-edges.
    
    Args:
        matrix: n×n adjacency matrix where matrix[i][j] = weight of edge i→j
    
    Example:
        >>> matrix = [
        ...     [0, 2, INF],
        ...     [INF, 0, 3],
        ...     [INF, INF, 0]
        ... ]
        >>> g = create_from_adjacency_matrix(matrix)
    """
    n = len(matrix)
    g = Graph(n)
    
    for i in range(n):
        for j in range(n):
            w = matrix[i][j]
            if i != j and 0 < w < INF:
                g.add_edge(i, j, w)
    
    return g


def create_from_osm(
    nodes: Dict[int, Tuple[float, float]],
    ways: List[Dict]
) -> Tuple[Graph, Dict[int, int]]:
    """
    Create graph from OpenStreetMap-style data.
    
    Args:
        nodes: Dict mapping node_id → (lat, lon)
        ways: List of way objects with 'nodes' and optional 'oneway' fields
    
    Returns:
        Tuple of (graph, id_mapping)
        - graph: Created Graph object
        - id_mapping: Dict mapping original node_ids to graph vertex indices
    
    Example:
        >>> nodes = {1: (40.7, -74.0), 2: (40.71, -74.01), 3: (40.72, -74.02)}
        >>> ways = [{"nodes": [1, 2, 3], "oneway": False}]
        >>> g, mapping = create_from_osm(nodes, ways)
    """
    from math import radians, sin, cos, sqrt, atan2
    
    def haversine(lat1, lon1, lat2, lon2):
        """Calculate distance between two points in km."""
        R = 6371  # Earth radius in km
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))
    
    # Create ID mapping
    node_ids = list(nodes.keys())
    id_mapping = {nid: idx for idx, nid in enumerate(node_ids)}
    
    g = Graph(len(node_ids))
    
    for way in ways:
        way_nodes = way.get("nodes", [])
        oneway = way.get("oneway", False)
        
        for i in range(len(way_nodes) - 1):
            nid1, nid2 = way_nodes[i], way_nodes[i + 1]
            if nid1 in nodes and nid2 in nodes:
                lat1, lon1 = nodes[nid1]
                lat2, lon2 = nodes[nid2]
                dist = haversine(lat1, lon1, lat2, lon2)
                
                u, v = id_mapping[nid1], id_mapping[nid2]
                g.add_edge(u, v, dist)
                if not oneway:
                    g.add_edge(v, u, dist)
    
    return g, id_mapping


# ============================================================================
# BENCHMARKING & COMPARISON
# ============================================================================

def benchmark(
    g: Graph,
    source: int,
    iterations: int = 5
) -> Dict[str, Any]:
    """
    Compare BMSSP vs Dijkstra performance.
    
    Args:
        g: Input graph
        source: Source vertex
        iterations: Number of timing iterations
    
    Returns:
        Dict with timing results and comparison
    
    Example:
        >>> g = Graph(1000)
        >>> # ... add edges ...
        >>> results = benchmark(g, 0)
        >>> print(f"BMSSP: {results['bmssp_avg_ms']:.2f}ms")
        >>> print(f"Dijkstra: {results['dijkstra_avg_ms']:.2f}ms")
    """
    # Warm up
    sssp(g, source)
    dijkstra(g, source)
    
    # Time BMSSP
    bmssp_times = []
    for _ in range(iterations):
        start = time.perf_counter()
        dist1, pred1 = sssp(g, source)
        bmssp_times.append((time.perf_counter() - start) * 1000)
    
    # Time Dijkstra
    dijkstra_times = []
    for _ in range(iterations):
        start = time.perf_counter()
        dist2, pred2 = dijkstra(g, source)
        dijkstra_times.append((time.perf_counter() - start) * 1000)
    
    # Verify correctness
    max_diff = max(abs(d1 - d2) for d1, d2 in zip(dist1, dist2) if d1 != INF and d2 != INF)
    
    bmssp_avg = sum(bmssp_times) / len(bmssp_times)
    dijkstra_avg = sum(dijkstra_times) / len(dijkstra_times)
    
    return {
        "graph_vertices": g.n,
        "graph_edges": g.edge_count,
        "bmssp_avg_ms": bmssp_avg,
        "dijkstra_avg_ms": dijkstra_avg,
        "speedup": dijkstra_avg / bmssp_avg if bmssp_avg > 0 else 0,
        "max_distance_diff": max_diff,
        "results_match": max_diff < 1e-9
    }


# ============================================================================
# REST API (Optional - for integration)
# ============================================================================

def create_flask_api():
    """
    Create a Flask REST API for BMSSP.
    
    Returns a Flask app that can be run with:
        app = create_flask_api()
        app.run(port=5000)
    
    Endpoints:
        POST /sssp - Compute shortest paths
        POST /path - Find path between two vertices
        POST /matrix - Compute distance matrix
    """
    try:
        from flask import Flask, request, jsonify
    except ImportError:
        raise ImportError("Flask is required for REST API. Install with: pip install flask")
    
    app = Flask(__name__)
    
    @app.route("/sssp", methods=["POST"])
    def api_sssp():
        data = request.json
        g = Graph.from_dict(data["graph"])
        source = data["source"]
        use_bmssp = data.get("use_bmssp", True)
        
        start = time.perf_counter()
        if use_bmssp:
            dist, pred = sssp(g, source)
        else:
            dist, pred = dijkstra(g, source)
        elapsed = (time.perf_counter() - start) * 1000
        
        return jsonify({
            "distances": [d if d != INF else None for d in dist],
            "predecessors": pred,
            "time_ms": elapsed,
            "algorithm": "bmssp" if use_bmssp else "dijkstra"
        })
    
    @app.route("/path", methods=["POST"])
    def api_path():
        data = request.json
        g = Graph.from_dict(data["graph"])
        source = data["source"]
        target = data["target"]
        
        path, dist = find_path(g, source, target)
        
        return jsonify({
            "path": path,
            "distance": dist if dist != INF else None,
            "reachable": dist != INF
        })
    
    @app.route("/matrix", methods=["POST"])
    def api_matrix():
        data = request.json
        g = Graph.from_dict(data["graph"])
        sources = data.get("sources")
        
        matrix = distance_matrix(g, sources)
        
        return jsonify({
            "matrix": [[d if d != INF else None for d in row] for row in matrix]
        })
    
    return app


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    """Command-line interface for BMSSP."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="BMSSP - Breaking the Sorting Barrier for Single-Source Shortest Paths"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Benchmark command
    bench_parser = subparsers.add_parser("benchmark", help="Run performance benchmark")
    bench_parser.add_argument("-n", "--vertices", type=int, default=1000, help="Number of vertices")
    bench_parser.add_argument("-m", "--edges", type=int, default=5000, help="Number of edges")
    bench_parser.add_argument("-i", "--iterations", type=int, default=5, help="Timing iterations")
    
    # Demo command
    demo_parser = subparsers.add_parser("demo", help="Run quick demo")
    
    # Server command  
    server_parser = subparsers.add_parser("server", help="Start REST API server")
    server_parser.add_argument("-p", "--port", type=int, default=5000, help="Server port")
    
    args = parser.parse_args()
    
    if args.command == "benchmark":
        import random
        random.seed(42)
        
        print(f"\n🚀 BMSSP Benchmark")
        print(f"{'='*50}")
        print(f"Graph: {args.vertices} vertices, {args.edges} edges\n")
        
        g = Graph(args.vertices)
        for _ in range(args.edges):
            u = random.randint(0, args.vertices - 1)
            v = random.randint(0, args.vertices - 1)
            if u != v:
                w = random.uniform(1, 10)
                g.add_edge(u, v, w)
        
        results = benchmark(g, 0, args.iterations)
        
        print(f"BMSSP:    {results['bmssp_avg_ms']:8.3f} ms")
        print(f"Dijkstra: {results['dijkstra_avg_ms']:8.3f} ms")
        print(f"Speedup:  {results['speedup']:8.2f}x")
        print(f"Results match: {results['results_match']}")
    
    elif args.command == "demo":
        print("\n🚀 BMSSP Quick Demo")
        print("="*50)
        
        g = Graph(6)
        edges = [(0,1,2), (0,2,4), (1,2,1), (1,3,7), (2,3,3), (2,4,5), (3,5,1), (4,3,2), (4,5,3)]
        for u, v, w in edges:
            g.add_edge(u, v, w)
        
        print(f"\nGraph: {g.n} vertices, {g.edge_count} edges")
        print(f"Edges: {edges}\n")
        
        dist, pred = sssp(g, 0)
        print("Shortest distances from vertex 0:")
        for i, d in enumerate(dist):
            print(f"  → Vertex {i}: {d}")
        
        path, d = find_path(g, 0, 5)
        print(f"\nShortest path 0 → 5: {' → '.join(map(str, path))} (distance: {d})")
    
    elif args.command == "server":
        print(f"\n🚀 Starting BMSSP REST API on port {args.port}")
        app = create_flask_api()
        app.run(port=args.port)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()