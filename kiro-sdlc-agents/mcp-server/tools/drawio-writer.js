"use strict";
/**
 * Writes updated node positions back to draw.io XML — regex-based rewrite.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeLayout = writeLayout;
const fs = __importStar(require("fs"));
const drawio_router_js_1 = require("./drawio-router.js");
/** Write layout results back to the XML file. */
function writeLayout(rawXml, graph, filePath) {
    let xml = rawXml;
    const allNodes = [...graph.nodes, ...graph.containers];
    xml = applyPositions(xml, allNodes);
    xml = applyEdgeAnchors(xml, graph);
    xml = applyEdgeRouting(xml, graph);
    fs.writeFileSync(filePath, xml, 'utf-8');
}
function applyPositions(xml, nodes) {
    for (const node of nodes) {
        // Match mxCell with this id, then update its mxGeometry
        const cellRegex = new RegExp(`(<mxCell[^>]*\\bid="${escapeRegex(node.id)}"[^>]*>\\s*<mxGeometry)([^/]*?)(/?>)`, 's');
        xml = xml.replace(cellRegex, (_match, prefix, attrs, suffix) => {
            attrs = setAttr(attrs, 'x', fmt(node.x));
            attrs = setAttr(attrs, 'y', fmt(node.y));
            attrs = setAttr(attrs, 'width', fmt(node.width));
            attrs = setAttr(attrs, 'height', fmt(node.height));
            return `${prefix}${attrs}${suffix}`;
        });
        // Also handle self-closing mxCell with child mxGeometry on same line
        const altRegex = new RegExp(`(id="${escapeRegex(node.id)}"[^>]*>\\s*<mxGeometry\\s)([^>]*?)(/>)`, 's');
        xml = xml.replace(altRegex, (_match, prefix, attrs, suffix) => {
            attrs = setAttr(attrs, 'x', fmt(node.x));
            attrs = setAttr(attrs, 'y', fmt(node.y));
            attrs = setAttr(attrs, 'width', fmt(node.width));
            attrs = setAttr(attrs, 'height', fmt(node.height));
            return `${prefix}${attrs}${suffix}`;
        });
    }
    return xml;
}
function applyEdgeAnchors(xml, graph) {
    const nodeMap = new Map([...graph.nodes, ...graph.containers].map(n => [n.id, n]));
    for (const edge of graph.edges) {
        const src = nodeMap.get(edge.sourceId);
        const tgt = nodeMap.get(edge.targetId);
        if (!src || !tgt)
            continue;
        const [exitX, exitY] = computeExit(src, tgt);
        const [entryX, entryY] = computeEntry(src, tgt);
        const cellRegex = new RegExp(`(<mxCell[^>]*\\bid="${escapeRegex(edge.id)}"[^>]*style=")([^"]*)(")`, 's');
        xml = xml.replace(cellRegex, (_m, pre, style, post) => {
            style = setStyleProp(style, 'exitX', fmt(exitX));
            style = setStyleProp(style, 'exitY', fmt(exitY));
            style = setStyleProp(style, 'entryX', fmt(entryX));
            style = setStyleProp(style, 'entryY', fmt(entryY));
            return `${pre}${style}${post}`;
        });
    }
    return xml;
}
function applyEdgeRouting(xml, graph) {
    const routes = (0, drawio_router_js_1.routeEdges)(graph);
    if (routes.size === 0)
        return xml;
    for (const [edgeId, waypoints] of routes) {
        // Set orthogonal style
        const styleRegex = new RegExp(`(<mxCell[^>]*\\bid="${escapeRegex(edgeId)}"[^>]*style=")([^"]*)(")`, 's');
        xml = xml.replace(styleRegex, (_m, pre, style, post) => {
            style = setStyleProp(style, 'edgeStyle', 'orthogonalEdgeStyle');
            style = setStyleProp(style, 'rounded', '1');
            return `${pre}${style}${post}`;
        });
        // Add waypoints Array inside mxGeometry
        const geomRegex = new RegExp(`(id="${escapeRegex(edgeId)}"[^>]*>[\\s\\S]*?<mxGeometry[^>]*)(/>|>)`, 's');
        const pointsXml = buildPointsXml(waypoints);
        xml = xml.replace(geomRegex, (_m, prefix, close) => {
            if (close === '/>')
                return `${prefix}>${pointsXml}</mxGeometry>`;
            return `${prefix}>${pointsXml}`;
        });
    }
    return xml;
}
function buildPointsXml(waypoints) {
    const points = waypoints.map(wp => `<mxPoint x="${fmt(wp.x)}" y="${fmt(wp.y)}" />`).join('');
    return `<Array as="points">${points}</Array>`;
}
function computeExit(src, tgt) {
    const dx = (tgt.x + tgt.width / 2) - (src.x + src.width / 2);
    const dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2);
    return pickSide(dx, dy);
}
function computeEntry(src, tgt) {
    const dx = (src.x + src.width / 2) - (tgt.x + tgt.width / 2);
    const dy = (src.y + src.height / 2) - (tgt.y + tgt.height / 2);
    return pickSide(dx, dy);
}
function pickSide(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy))
        return dx > 0 ? [1, 0.5] : [0, 0.5];
    return dy > 0 ? [0.5, 1] : [0.5, 0];
}
function setStyleProp(style, key, value) {
    const regex = new RegExp(`${key}=[^;]*`);
    if (regex.test(style))
        return style.replace(regex, `${key}=${value}`);
    const sep = style.endsWith(';') ? '' : ';';
    return `${style}${sep}${key}=${value};`;
}
function setAttr(attrs, key, value) {
    const regex = new RegExp(`${key}="[^"]*"`);
    if (regex.test(attrs))
        return attrs.replace(regex, `${key}="${value}"`);
    return ` ${key}="${value}"${attrs}`;
}
function fmt(val) {
    const rounded = Math.round(val);
    return rounded === val ? String(rounded) : val.toFixed(1);
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=drawio-writer.js.map