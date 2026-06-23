"use strict";
/**
 * LOD Manager — Main orchestrator for Level of Detail system
 * KSA-143
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LODManager = void 0;
const ClusteringAlgorithm_1 = require("./ClusteringAlgorithm");
const DistanceChecker_1 = require("./DistanceChecker");
const BudgetManager_1 = require("./BudgetManager");
const OrbitalLayout_1 = require("./OrbitalLayout");
const config_1 = require("./config");
class LODManager {
    clustering;
    distanceChecker;
    budgetManager;
    clusters = new Map();
    config;
    eventHandlers = new Map();
    hierarchy = null;
    constructor(config) {
        this.config = (0, config_1.validateConfig)(config ?? {});
        this.clustering = new ClusteringAlgorithm_1.ClusteringAlgorithm();
        this.distanceChecker = new DistanceChecker_1.DistanceChecker(this.config.expandThreshold, this.config.collapseThreshold);
        this.budgetManager = new BudgetManager_1.BudgetManager(this.config.maxVisibleNodes);
    }
    async initialize(graphData) {
        // Run clustering
        this.hierarchy = this.clustering.cluster(graphData, {
            minClusterSize: this.config.minClusterSize,
            maxClusterSize: this.config.maxClusterSize,
            connectivityWeight: 2.0,
            typeWeight: 1.0,
        });
        // Initialize cluster states
        this.clusters.clear();
        for (const cluster of this.hierarchy.clusters) {
            this.clusters.set(cluster.id, {
                id: cluster.id,
                state: 'COLLAPSED',
                cluster,
                childCount: cluster.childNodeIds.length,
                distanceToCamera: Infinity,
                lastStateChange: Date.now(),
            });
        }
        // Initial visible count = number of super nodes + isolated nodes
        this.budgetManager.setCount(this.hierarchy.clusters.length + this.hierarchy.isolatedNodes.length);
        return this.hierarchy;
    }
    update(cameraPosition) {
        if (this.clusters.size === 0)
            return;
        // Evaluate distances and get events
        const events = this.distanceChecker.evaluate(cameraPosition, this.clusters);
        // Process events
        for (const event of events) {
            if (event.type === 'EXPAND') {
                this.handleExpand(event.clusterId);
            }
            else if (event.type === 'COLLAPSE') {
                this.handleCollapse(event.clusterId);
            }
        }
    }
    handleExpand(clusterId) {
        const state = this.clusters.get(clusterId);
        if (!state || state.state !== 'COLLAPSED')
            return;
        // Budget check
        if (!this.budgetManager.canExpand(state)) {
            // Auto-collapse farthest
            const farthestId = this.budgetManager.getFarthestExpanded(this.clusters);
            if (farthestId) {
                this.handleCollapse(farthestId);
                this.emit('budget-exceeded', {
                    requestedClusterId: clusterId,
                    currentVisible: this.budgetManager.getCount(),
                    requestedAdditional: state.childCount,
                    collapsedClusterId: farthestId,
                });
            }
            else {
                return; // Cannot expand, no cluster to collapse
            }
        }
        // Expand
        state.state = 'EXPANDED';
        state.lastStateChange = Date.now();
        // Budget: remove 1 super node, add N child nodes
        this.budgetManager.updateCount(state.childCount - 1);
        this.emit('cluster-expanded', clusterId);
    }
    handleCollapse(clusterId) {
        const state = this.clusters.get(clusterId);
        if (!state || state.state !== 'EXPANDED')
            return;
        state.state = 'COLLAPSED';
        state.lastStateChange = Date.now();
        // Budget: remove N child nodes, add 1 super node
        this.budgetManager.updateCount(-(state.childCount - 1));
        this.emit('cluster-collapsed', clusterId);
    }
    expandCluster(clusterId) {
        this.handleExpand(clusterId);
    }
    collapseCluster(clusterId) {
        this.handleCollapse(clusterId);
    }
    getVisibleNodeCount() {
        return this.budgetManager.getCount();
    }
    getExpandedClusters() {
        const expanded = [];
        for (const [id, state] of this.clusters) {
            if (state.state === 'EXPANDED')
                expanded.push(id);
        }
        return expanded;
    }
    getClusterState(clusterId) {
        return this.clusters.get(clusterId);
    }
    getOrbitalPositions(clusterId) {
        const state = this.clusters.get(clusterId);
        if (!state)
            return [];
        return OrbitalLayout_1.OrbitalLayout.compute(state.childCount, state.cluster.center, state.cluster.radius);
    }
    setConfig(config) {
        this.config = (0, config_1.validateConfig)({ ...this.config, ...config });
        this.distanceChecker.setThresholds(this.config.expandThreshold, this.config.collapseThreshold);
        this.budgetManager.setMax(this.config.maxVisibleNodes);
    }
    getConfig() {
        return { ...this.config };
    }
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    emit(event, ...args) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                handler(...args);
            }
        }
    }
    dispose() {
        this.clusters.clear();
        this.eventHandlers.clear();
        this.hierarchy = null;
        this.budgetManager.setCount(0);
    }
}
exports.LODManager = LODManager;
//# sourceMappingURL=LODManager.js.map