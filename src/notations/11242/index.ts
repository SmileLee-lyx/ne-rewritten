import { seriesName, seriesText } from './text.ts';
import type { NotationDefinition, NotationDisplaySpec } from '@/notation-definition.ts';
import type { Diagram } from '@/core/diagram_types.ts';
import { countText, textDisplay, textHtml } from './common.ts';
import { graphCompare, graphCounts, graphFS, graphParse, graphPlain, type Graph, type GraphKind } from './graph.ts';
import {
    SRD_INITIAL,
    srdCompare,
    srdCounts,
    srdFS,
    srdHeightParse,
    srdHeights,
    srdParse,
    srdPlain,
    type SRDExpr,
} from './srd.ts';
import { graphDisplays, diagramHtml, type ViewGraph } from './views.ts';
import { ipdCore } from './ipd-core.js';
import { createE0Core, type E0Expr } from './e0-core.js';
import { e0MN as upstreamE0MN } from '@/notations/MN/e0MN.ts';
import { strong_e0MN as upstreamStrongE0MN } from '@/notations/MN/strong_e0MN.ts';
import { natural, ResourceLimit } from './common.ts';

const category = 'category-11242';
const comparisonChain = { id: '11242.description.chain' };
const wellOrdering = { id: '11242.description.well-ordering' };

function makeGraphNotation(kind: GraphKind): NotationDefinition<Graph> {
    const cache = new WeakMap<NonNullable<Graph>, { until: number; text: string }>();
    const counts = (g: Graph): string => {
        if (g === null) return 'Limit';
        const saved = cache.get(g);
        if (saved && Date.now() < saved.until) return saved.text;
        const text = countText(graphCounts(kind, g));
        cache.set(g, { text, until: text.includes('?') ? Date.now() + 2000 : Infinity });
        return text;
    };
    const read = (g: Graph): ViewGraph | null => {
        if (g === null) return null;
        const grouped = new Map<string, { source: number; parent: number; k: number; q: number }>();
        g.forEach((col, source) =>
            col.forEach((e) => {
                const key = `${source},${e.k},${e.p}`,
                    old = grouped.get(key);
                if (!old || old.q < e.q) grouped.set(key, { source, parent: e.p, k: e.k, q: e.q });
            }),
        );
        const edges = [...grouped.values()];
        return {
            columns: g.length,
            layers: [...new Set(edges.map((e) => e.k))].sort((a, b) => a - b).map(String),
            edges: edges.map((e) => ({ ...e, layer: String(e.k), value: String(e.q) })),
            counts: counts(g),
        };
    };
    const fs = (g: Graph, n: number) => graphFS(kind, g, n);
    return {
        id: `11242-${kind.toLowerCase()}`,
        name: kind,
        simple_name: kind,
        category_id: category,
        description: [
            kind === 'RPD'
                ? { id: '11242.description.rpd' }
                : kind === 'ARD'
                  ? { id: '11242.description.ard' }
                  : { id: '11242.description.ard2' },
            wellOrdering,
        ],
        display: textDisplay({ id: '11242.view.list' }, graphPlain, (text) => graphParse(kind, text)),
        display_equiv: {
            [seriesName('view.count')]: textDisplay({ id: '11242.view.count' }, counts),
            ...graphDisplays(read, graphPlain),
        },
        FS: fs,
        FS_short: fs,
        FS_alter: fs,
        compare: graphCompare,
        is_limit: (g) => g === null || !!g.at(-1)?.length,
        init: () => [null, [[]], []],
        debug: {
            counts: (g: NonNullable<Graph>, maxWork?: number, maxMs?: number) => graphCounts(kind, g, maxWork, maxMs),
        },
    };
}

export const RPD = makeGraphNotation('RPD');
export const ARD = makeGraphNotation('ARD');
export const ARD2 = makeGraphNotation('ARD2');

function srdMountain(g: SRDExpr): Diagram | undefined {
    if (!g.length) return undefined;
    const levels = Math.max(1, ...g.map((c) => c.length)),
        gap = 34,
        left = 34;
    if (g.length > 256 || levels > 128) return undefined;
    const diagram: Diagram = {
        width: left + (g.length + 1) * gap,
        height: 0,
        elements: [],
        extra_text: [],
    };
    const x = (j: number) => left + j * gap;
    const counts = srdCounts(g),
        heights = srdHeights(g);
    diagram.extra_text.push({ text: countText(counts), x: 0, y: 10, align: 'left', size: 14 });
    let nextY = 30;
    for (let row = levels - 1; row >= 0; row--) {
        const maxHeight = Math.max(0, ...heights.map((col) => col[row] ?? 0));
        const base = nextY + maxHeight * 14 + 12;
        const height = (j: number) => (j ? (heights[j - 1][row] ?? 0) : 0);
        const y = (j: number) => base - height(j) * 14;
        const nodes = new Set<number>();
        diagram.extra_text.push({ text: String(row), x: 3, y: nextY, align: 'left', size: 12 });
        g.forEach((col, index) => {
            if (col[row] === undefined) return;
            const j = index + 1,
                p = col[row];
            diagram.elements.push({
                type: 'line',
                x1: x(j),
                y1: y(j),
                x2: x(p),
                y2: y(p),
                stroke: true,
                stroke_color: { type: 'gray' },
            });
            nodes.add(j);
            nodes.add(p);
        });
        for (const j of nodes) {
            diagram.elements.push({ type: 'circle', x: x(j), y: y(j), r: 2, fill: true, stroke: false });
            diagram.extra_text.push({
                text: String(height(j)),
                x: x(j),
                y: y(j) - 10,
                size: 13,
                align: 'center',
            });
        }
        nextY = base + 28;
    }
    if (nextY > 32000) return undefined;
    diagram.height = nextY;
    return diagram;
}
const srdCountText = (g: SRDExpr) => countText(srdCounts(g));
const srdGraph = (g: SRDExpr): ViewGraph => ({
    columns: g.length + 1,
    implicitRoot: true,
    layers: Array.from({ length: Math.max(0, ...g.map((c) => c.length)) }, (_, row) => String(row)),
    edges: g.flatMap((col, index) =>
        col.map((parent, row) => ({ source: index + 1, parent, layer: String(row), value: '1' })),
    ),
    counts: srdCountText(g),
});
export const SRD: NotationDefinition<SRDExpr> = {
    id: '11242-srd',
    name: 'SRD',
    simple_name: 'SRD',
    category_id: category,
    description: [{ id: '11242.description.srd' }, comparisonChain, wellOrdering],
    display: textDisplay({ id: '11242.view.list' }, srdPlain, srdParse),
    display_equiv: {
        [seriesName('view.count')]: textDisplay({ id: '11242.view.count' }, srdCountText),
        ...graphDisplays(srdGraph, srdPlain),
        [seriesName('view.heights')]: textDisplay(
            { id: '11242.view.heights' },
            (g) => srdPlain(srdHeights(g)),
            srdHeightParse,
        ),
        [seriesName('view.mountain')]: {
            name: { id: '11242.view.mountain' },
            plain: srdPlain,
            html: (g) => diagramHtml(srdMountain(g), srdPlain(g)),
            from_display: srdParse,
        },
    },
    FS: srdFS,
    FS_alter: srdFS,
    FS_short: srdFS,
    compare: srdCompare,
    is_limit: (g) => !!g.at(-1)?.length,
    draw_diagram: { default_data: {}, draw_diagram: srdMountain },
    init: () => [SRD_INITIAL, [[]], []],
    debug: { counts: srdCounts },
};

export const IPD: NotationDefinition<string> = {
    id: '11242-ipd',
    name: 'IPD',
    simple_name: 'IPD',
    category_id: category,
    description: [{ id: '11242.description.ipd' }, wellOrdering],
    display: textDisplay({ id: '11242.view.list' }, ipdCore.plain, ipdCore.parse),
    display_equiv: {
        [seriesName('view.count')]: textDisplay({ id: '11242.view.count' }, ipdCore.counts),
        ...graphDisplays((raw) => {
            const graph = ipdCore.graph(raw);
            return (
                graph && {
                    ...graph,
                    layers: [...new Set(graph.edges.map((e) => e.layer))].sort((a, b) => Number(a) - Number(b)),
                    counts: ipdCore.counts(raw),
                }
            );
        }, ipdCore.plain),
        [seriesName('view.trees')]: {
            name: { id: '11242.view.trees' },
            plain: ipdCore.plain,
            html: ipdCore.treeHtml,
            from_display: ipdCore.parse,
        },
    },
    FS: ipdCore.fs,
    FS_alter: ipdCore.fs,
    FS_short: ipdCore.fs,
    compare: ipdCore.compare,
    is_limit: ipdCore.isLimit,
    init: () => ['Limit', '[]', '0'],
};

function makeE0Notation(strong: boolean): NotationDefinition<E0Expr> {
    const core = createE0Core(strong),
        name = strong ? 'strong-e0MN' : 'e0MN';
    const original = strong ? upstreamStrongE0MN : upstreamE0MN;
    type NativeExpr = Exclude<E0Expr, 'Limit'>;
    const toNative = (expr: E0Expr): NativeExpr => (expr === 'Limit' ? (Infinity as unknown as NativeExpr) : expr);
    const fromNative = (expr: NativeExpr): E0Expr => ((expr as unknown) === Infinity ? 'Limit' : expr);
    // Share all mathematical operations with MN–ta0, including its short/long/fast variants.
    const wrapFS =
        (fs: (expr: NativeExpr, n: number) => NativeExpr) =>
        (expr: E0Expr, n: number): E0Expr => {
            natural(n, expr === 'Limit' ? 96 : 8192);
            if (expr !== 'Limit' && expr.at(-1)?.length) {
                const span = expr.length - expr.at(-1)!.at(-1)!.a;
                if (expr.length + (n + 1) * span > 8192) throw new ResourceLimit(seriesText('error.expansion-width'));
            }
            return fromNative(fs(toNative(expr), n));
        };
    const viewGraph = (expr: E0Expr): ViewGraph | null => {
        if (expr === 'Limit') return null;
        const rows = new Map(expr.flat().map((e) => [core.ordPlain(e.x), e.x]));
        return {
            columns: expr.length,
            counts: core.counts(expr),
            layers: [...rows.entries()].sort((a, b) => core.ordCompare(a[1], b[1])).map(([text]) => text),
            edges: expr.flatMap((col, source) =>
                col.map((e) => ({ source, parent: e.a - 1, layer: core.ordPlain(e.x), value: '1' })),
            ),
        };
    };
    return {
        id: `11242-${strong ? 'strong-' : ''}e0mn`,
        name,
        simple_name: name,
        category_id: 'category-11242-ta0',
        description: [
            { id: strong ? '11242.description.strong-e0mn' : '11242.description.e0mn' },
            ...(!strong ? [comparisonChain] : []),
            { id: '11242.description.e0-proof' },
        ],
        display: {
            name: { id: '11242.view.list' },
            plain: core.plain,
            html: core.html,
            latex: core.latex,
            from_display: core.parse,
        },
        display_equiv: {
            [seriesName('view.count')]: textDisplay({ id: '11242.view.count' }, core.counts),
            ...graphDisplays(viewGraph, core.plain),
            [seriesName('view.row-difference')]: {
                name: { id: '11242.view.row-difference' },
                plain: core.rowPlain,
                html: core.rowHtml,
                latex: core.rowLatex,
                from_display: core.rowParse,
            },
            [seriesName('view.mountain')]: {
                name: { id: '11242.view.mountain' },
                plain: core.plain,
                html: (expr) =>
                    expr === 'Limit' || !expr.length
                        ? textHtml(core.counts(expr))
                        : `<span style="display:inline-flex;flex-direction:column;gap:7px">${textHtml(core.counts(expr))}${diagramHtml(core.draw(expr), core.plain(expr))}</span>`,
                from_display: core.parse,
            },
        },
        FS: wrapFS(original.FS),
        FS_short: original.FS_short && wrapFS(original.FS_short),
        FS_alter: original.FS_alter && wrapFS(original.FS_alter),
        FS_equiv: Object.fromEntries(Object.entries(original.FS_equiv ?? {}).map(([name, fs]) => [name, wrapFS(fs)])),
        compare: (a, b) => original.compare(toNative(a), toNative(b)),
        is_limit: (expr) => original.is_limit(toNative(expr)),
        draw_diagram: { default_data: {}, draw_diagram: core.draw },
        credit_text_id: 'credit.e0mn',
        init: () => ['Limit', [[]], []],
        debug: core,
    };
}
export const e0MN = makeE0Notation(false);
export const strongE0MN = makeE0Notation(true);

export const series11242 = [SRD, RPD, ARD, ARD2, IPD, e0MN, strongE0MN] as NotationDefinition<any>[];
