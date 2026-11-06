import { seriesText, seriesName } from './text.ts';
import type { Diagram } from '@/core/diagram_types.ts';
import type { NotationDisplaySpec } from '@/notation-definition.ts';
import { escapeHtml as esc, textHtml, textLatex, ResourceLimit } from './common.ts';

export interface ViewEdge {
    source: number;
    parent: number;
    layer: string;
    value: string;
}
export interface ViewGraph {
    columns: number;
    layers: string[];
    edges: ViewEdge[];
    counts: string;
    implicitRoot?: boolean;
}
const graphBudget = (graph: ViewGraph) => {
    if (graph.columns > 256 || graph.layers.length > 128 || graph.edges.length > 6000)
        throw new ResourceLimit(seriesText('error.graph-budget'));
};

export function adjacencyText(g: ViewGraph): string {
    graphBudget(g);
    const cells = new Map(g.edges.map((e) => [`${e.source}|${e.layer}|${e.parent}`, e.value]));
    return (
        Array.from({ length: g.columns - (g.implicitRoot ? 1 : 0) }, (_, index) => {
            const j = index + (g.implicitRoot ? 1 : 0);
            if (!g.edges.some((e) => e.source === j)) return '[]';
            return (
                '[' +
                g.layers
                    .map(
                        (layer) =>
                            layer +
                            ':' +
                            Array.from({ length: j }, (_, p) => cells.get(`${j}|${layer}|${p}`) ?? '').join(','),
                    )
                    .join(';') +
                ']'
            );
        }).join('') || '0'
    );
}

export function triangleHtml(g: ViewGraph): string {
    graphBudget(g);
    if (((g.columns * (g.columns + 1)) / 2) * g.layers.length > 50000)
        throw new ResourceLimit(seriesText('error.matrix-budget'));
    const blocks = [textHtml(g.counts)];
    const n = g.columns;
    for (const layer of g.layers) {
        const cells = new Map(
            g.edges.filter((e) => e.layer === layer).map((e) => [`${e.parent},${e.source}`, e.value]),
        );
        const longest = Math.max(String(n - 1).length, ...[...cells.values()].map((s) => s.length));
        const w = Math.max(19, longest * 8 + 5),
            h = 20,
            left = Math.max(18, layer.length * 8 + 5);
        if (left + n * w > 32000) throw new ResourceLimit(seriesText('error.matrix-width'));
        const parts = [
            `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(seriesText('diagram.matrix', { layer }))}" width="${left + n * w + 1}" height="${n * h + 1}" viewBox="0 0 ${left + n * w + 1} ${n * h + 1}" style="font-family:inherit;display:block;overflow:visible">`,
            `<text x="${left - 5}" y="14" text-anchor="end" fill="currentColor" font-size="13">${esc(layer)}</text>`,
        ];
        for (let p = 0; p < n; p++)
            for (let j = p; j < n; j++) {
                const x = left + j * w,
                    y = p * h,
                    diagonal = p === j;
                const value = diagonal ? String(j) : (cells.get(`${p},${j}`) ?? '');
                parts.push(
                    `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w}" height="${h}" fill="${diagonal ? 'currentColor' : 'none'}" fill-opacity="${diagonal ? '.12' : '0'}" stroke="currentColor" stroke-opacity=".3"/>`,
                );
                if (value)
                    parts.push(
                        `<text x="${x + w / 2}" y="${y + 14.5}" text-anchor="middle" fill="currentColor" font-size="13">${esc(value)}</text>`,
                    );
            }
        parts.push('</svg>');
        blocks.push(parts.join(''));
    }
    return `<span class="rd-matrices" style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:7px;font-family:inherit">${blocks.join('')}</span>`;
}

export function arcHtml(g: ViewGraph): string {
    graphBudget(g);
    const gap = Math.max(38, ...g.edges.map((e) => e.value.length * 7 + 12)),
        left = Math.max(32, ...g.layers.map((layer) => layer.length * 8 + 10)),
        width = Math.max(64, left + g.columns * gap),
        parts: string[] = [];
    if (width > 32000) throw new ResourceLimit(seriesText('error.arc-width'));
    let y = 0;
    for (const layer of g.layers) {
        const edges = g.edges
            .filter((e) => e.layer === layer)
            .sort((a, b) => a.source - a.parent - (b.source - b.parent));
        const lanes: ViewEdge[][] = [],
            routes: { edge: ViewEdge; lane: number }[] = [];
        for (const edge of edges) {
            let lane = lanes.findIndex((list) =>
                list.every((old) => old.source < edge.parent || edge.source < old.parent),
            );
            if (lane < 0) {
                lane = lanes.length;
                lanes.push([]);
            }
            lanes[lane].push(edge);
            routes.push({ edge, lane });
        }
        const base = y + 22 + Math.max(1, lanes.length) * 24;
        parts.push(`<text x="3" y="${base + 4}" fill="currentColor" font-size="13">${esc(layer)}</text>`);
        for (let j = 0; j < g.columns; j++)
            parts.push(`<circle cx="${left + j * gap}" cy="${base}" r="2" fill="currentColor"/>`);
        for (const { edge: e, lane } of routes) {
            const x1 = left + e.parent * gap,
                x2 = left + e.source * gap,
                top = base - 20 - lane * 24;
            const mx = (x1 + x2) / 2,
                labelWidth = Math.max(16, e.value.length * 7 + 6);
            parts.push(
                `<path d="M${x1},${base} L${x1},${top + 5} Q${x1},${top} ${x1 + 5},${top} H${x2 - 5} Q${x2},${top} ${x2},${top + 5} V${base}" fill="none" stroke="currentColor" stroke-width="1"/>`,
            );
            parts.push(
                `<rect x="${mx - labelWidth / 2}" y="${top - 8}" width="${labelWidth}" height="16" rx="8" fill="var(--color-bg,Canvas)" stroke="currentColor" stroke-opacity=".6"/><text x="${mx}" y="${top + 4}" text-anchor="middle" fill="currentColor" font-size="12">${esc(e.value)}</text>`,
            );
        }
        y = base + 18;
    }
    if (y > 32000) throw new ResourceLimit(seriesText('error.arc-height'));
    return `<span style="display:inline-flex;flex-direction:column;gap:7px;font-family:inherit">${textHtml(g.counts)}<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(seriesText('diagram.arcs'))}" width="${width}" height="${Math.max(y, 20)}" style="display:block;font-family:inherit">${parts.join('')}</svg></span>`;
}

export function graphDisplays<T>(
    read: (expr: T) => ViewGraph | null,
    plain: (expr: T) => string,
): Record<string, NotationDisplaySpec<T>> {
    const render = (fn: (g: ViewGraph) => string) => (expr: T) => {
        try {
            const g = read(expr);
            return g ? fn(g) : textHtml(plain(expr));
        } catch (error) {
            if (!(error instanceof ResourceLimit)) throw error;
            return textHtml(error.message);
        }
    };
    const adjacency = (expr: T) => {
        const g = read(expr);
        return g ? adjacencyText(g) : plain(expr);
    };
    return {
        [seriesName('view.adjacency')]: {
            name: seriesName('view.adjacency'),
            plain: adjacency,
            html: render((g) => textHtml(adjacencyText(g))),
            latex: (expr) => textLatex(adjacency(expr)),
        },
        [seriesName('view.matrix')]: {
            name: seriesName('view.matrix'),
            plain: adjacency,
            html: render(triangleHtml),
            latex: (expr) => textLatex(adjacency(expr)),
        },
        [seriesName('view.arcs')]: {
            name: seriesName('view.arcs'),
            plain,
            html: render(arcHtml),
            latex: (expr) => textLatex(plain(expr)),
        },
    };
}

/** Use the same native diagram data in inline HTML and NER's graph panel. */
export function diagramHtml(diagram: Diagram | undefined, fallback = ''): string {
    if (!diagram) return textHtml(fallback);
    const color = (c: { type?: string } | undefined) =>
        c?.type === 'red' ? 'var(--color-red,#b44)' : c?.type === 'gray' ? 'var(--color-gray,#999)' : 'currentColor';
    const elements = diagram.elements.map((e) => {
        if (e.type === 'line')
            return `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="${color(e.stroke_color as { type?: string })}" stroke-width="${e.width ?? 1}"/>`;
        if (e.type === 'circle')
            return `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="${e.fill ? color(e.fill_color as { type?: string }) : 'none'}" stroke="${e.stroke ? color(e.stroke_color as { type?: string }) : 'none'}"/>`;
        return `<text x="${e.x}" y="${e.y}" fill="currentColor">${esc(e.text)}</text>`;
    });
    for (const e of diagram.extra_text) {
        if (e.display_html)
            elements.push(
                `<foreignObject x="${e.x - 150}" y="${e.y - 10}" width="300" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${e.size ?? 14}px">${e.text}</div></foreignObject>`,
            );
        else
            elements.push(
                `<text x="${e.x}" y="${e.y + 4}" text-anchor="${e.align === 'left' ? 'start' : e.align === 'right' ? 'end' : 'middle'}" fill="${color(e.color as { type?: string })}" font-size="${e.size ?? 14}">${esc(e.text)}</text>`,
            );
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${diagram.width}" height="${diagram.height}" viewBox="0 0 ${diagram.width} ${diagram.height}" style="display:block;font-family:inherit">${elements.join('')}</svg>`;
}
