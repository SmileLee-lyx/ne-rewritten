import { seriesText } from './i18n.ts';
import { budget, lex, natural, partialCounts, ResourceLimit } from './common.ts';

export interface Edge {
    k: number;
    p: number;
    q: number;
}
export type Graph = Edge[][] | null;
export type GraphKind = 'RPD' | 'ARD' | 'ARD2';
const WIDTH = 8192;
const CELLS = 250000;
const pairCompare = (a: Edge, b: Edge) => a.k - b.k || a.q - b.q;
const edgeCompare = (a: Edge, b: Edge) => a.p - b.p || pairCompare(a, b);

export function graphCompare(a: Graph, b: Graph): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return lex(a, b, (x, y) => lex(x, y, edgeCompare));
}

export function skyline(col: Edge[]): Edge[] {
    const best = new Map<number, Edge>();
    for (const edge of col) {
        const old = best.get(edge.p);
        if (!old || pairCompare(edge, old) > 0) best.set(edge.p, edge);
    }
    const result: Edge[] = [];
    let high: Edge | undefined;
    for (const edge of [...best.values()].sort((a, b) => b.p - a.p)) {
        if (!high || pairCompare(edge, high) > 0) {
            result.push(edge);
            high = edge;
        }
    }
    return result;
}

function normalize(kind: GraphKind, columns: Edge[][], tick: () => void): Edge[][] {
    natural(columns.length, WIDTH);
    let cells = 0;
    return columns.map((col, j) => {
        const records = new Map<string, Edge>();
        for (const edge of col) {
            tick();
            for (const value of [edge.k, edge.p, edge.q]) natural(value);
            if (
                edge.p >= j ||
                (kind === 'ARD2' ? edge.k > j || edge.q > j : edge.q > edge.p || (kind === 'ARD' && edge.k > edge.p))
            )
                throw new Error(seriesText('error.graph-range'));
            if (kind !== 'RPD') continue;
            if (edge.q >= CELLS) throw new ResourceLimit();
            for (let q = 0; q <= edge.q; q++) {
                tick();
                records.set(`${edge.k},${edge.p},${q}`, { ...edge, q });
                if (++cells > CELLS) throw new ResourceLimit();
            }
        }
        const result = kind === 'RPD' ? [...records.values()].sort((a, b) => -edgeCompare(a, b)) : skyline(col);
        if (kind !== 'RPD' && (cells += result.length) > CELLS) throw new ResourceLimit();
        return result;
    });
}

function predecessor(kind: GraphKind, e: Edge, child: number): Edge[] {
    if (e.q) return [{ ...e, q: e.q - 1 }];
    if (e.k) return [{ ...e, k: e.k - 1, q: kind === 'ARD2' ? child : e.p }];
    return [];
}

export function graphSeed(kind: GraphKind, index: number): Edge[][] {
    natural(index, kind === 'RPD' ? 4096 : WIDTH);
    if (kind === 'RPD') return [[], Array.from({ length: index + 1 }, (_, k) => ({ k, p: 0, q: 0 })).reverse()];
    return Array.from({ length: index }, (_, j) =>
        j ? [{ k: j - (kind === 'ARD' ? 1 : 0), p: j - 1, q: j - (kind === 'ARD' ? 1 : 0) }] : [],
    );
}

export function graphFS(kind: GraphKind, graph: Graph, n: number): Edge[][] {
    natural(n);
    if (graph === null) return graphSeed(kind, n);
    const x = graph.length - 1;
    if (x < 0) return [];
    if (!n || !graph[x].length) return graph.slice(0, x);
    const tick = budget(750),
        last = graph[x];
    const control = kind === 'RPD' ? [...last].sort((a, b) => pairCompare(a, b) || a.p - b.p).at(-1)! : last.at(-1)!;
    const c = control.p,
        width = x - c;
    natural(x + n * width, WIDTH);
    const result = graph.slice(0, x);
    let copied = 0;
    for (let v = 0; v < n; v++) {
        tick();
        const phi = (i: number, block: number) => (i < c ? i : i + block * width);
        const move = (e: Edge, block: number): Edge => {
            tick();
            if (++copied > CELLS) throw new ResourceLimit();
            return { k: kind === 'RPD' ? e.k : phi(e.k, block), p: phi(e.p, block), q: phi(e.q, block) };
        };
        let seam: Edge[];
        if (kind === 'RPD') {
            // Root completion happens after moving addresses. Move and lower do not commute.
            seam = [];
            const cutRoot = phi(control.q, v);
            for (const e of last) {
                const shifted = move(e, v);
                const max = e.k < control.k ? shifted.q : e.k === control.k ? Math.min(shifted.q, cutRoot - 1) : -1;
                if (max >= 0) seam.push({ ...shifted, q: max });
            }
        } else
            seam = [...last.slice(0, -1).map((e) => move(e, v)), ...predecessor(kind, move(control, v), x + v * width)];
        seam.push(...graph[c].map((e) => move(e, v + 1)));
        result.push(seam);
        for (let j = c + 1; j < x; j++) result.push(graph[j].map((e) => move(e, v + 1)));
    }
    return normalize(kind, result, tick);
}

export function graphPlain(graph: Graph): string {
    return graph === null
        ? 'Limit'
        : graph.map((col) => '[' + col.map((e) => `(${e.k},${e.p},${e.q})`).join(',') + ']').join('') || '0';
}

export function graphParse(kind: GraphKind, raw: string): Graph {
    if (raw.length > 2_000_000) throw new ResourceLimit();
    const s = raw.replace(/\s/g, '');
    if (!s || s === '∅') return [];
    const route = /^(?:Limit(?:of(?:RPD|ARD2?|Anchored-Rows))?|Ω|Top|A(\d+))((?:\[\d+\])*)$/i.exec(s);
    if (route) {
        let graph: Graph = route[1] === undefined ? null : graphSeed(kind, Number(route[1]));
        const steps = [...route[2].matchAll(/\[(\d+)\]/g)];
        if (steps.length > 128) throw new ResourceLimit();
        for (const step of steps) graph = graphFS(kind, graph, Number(step[1]));
        return graph;
    }
    if (/^\d+$/.test(s)) return Array.from({ length: natural(Number(s), WIDTH) }, () => []);
    if (!/^(?:\[(?:\(\d+,\d+,\d+\)(?:,\(\d+,\d+,\d+\))*)?\])+$/.test(s))
        throw new Error(seriesText('error.graph-input'));
    const columns = [...s.matchAll(/\[([^\]]*)\]/g)].map((m) =>
        [...m[1].matchAll(/\((\d+),(\d+),(\d+)\)/g)].map((e) => ({
            k: Number(e[1]),
            p: Number(e[2]),
            q: Number(e[3]),
        })),
    );
    return normalize(kind, columns, budget());
}

export function graphCounts(kind: GraphKind, graph: Edge[][], maxWork = 2_000_000, maxMs = 200): (bigint | null)[] {
    const tick = budget(maxMs, maxWork);
    if (kind === 'RPD') return rpdCounts(graph, tick);
    const traces: { top: number; steps: bigint; rest: Edge[] }[][] = [];
    const width = Math.max(1, graph.length),
        pair = (e: Edge) => e.k * width + e.q;
    let cells = 0;
    return partialCounts(graph, (j) => {
        let col = graph[j],
            steps = 0n;
        const trace: { top: number; steps: bigint; rest: Edge[] }[] = [];
        for (;;) {
            tick();
            const e = col.at(-1);
            if (kind === 'ARD') {
                if ((cells += col.length + 1) > 500000) throw new ResourceLimit();
                trace.push({ top: e ? pair(e) : -1, steps, rest: col });
            }
            if (!e) break;
            const shell = [...col.slice(0, -1), ...predecessor(kind, e, j)];
            if (kind === 'ARD') {
                const ts = traces[e.p];
                let lo = 0,
                    hi = ts.length - 1;
                while (lo < hi) {
                    tick();
                    const mid = (lo + hi) >> 1;
                    if (ts[mid].top >= pair(e)) lo = mid + 1;
                    else hi = mid;
                }
                steps += 1n + ts[lo].steps;
                col = skyline(shell.concat(ts[lo].rest));
            } else {
                col = skyline(
                    shell.concat(
                        graph[e.p].map((a) => ({ k: a.k === e.p ? j : a.k, p: a.p, q: a.q === e.p ? j : a.q })),
                    ),
                );
                steps++;
            }
        }
        traces[j] = trace;
        return steps + 1n;
    });
}

function rpdCounts(graph: Edge[][], tick: () => void): (bigint | null)[] {
    const labels = [...new Map(graph.flat().map((e) => [`${e.k},${e.q}`, e])).values()].sort(pairCompare);
    const ids = new Map(labels.map((e, i) => [`${e.k},${e.q}`, i]));
    const rows = graph.map((col) => {
        const row = new Map<number, number>();
        for (const e of col) {
            const id = ids.get(`${e.k},${e.q}`)!;
            row.set(id, Math.max(row.get(id) ?? -1, e.p));
        }
        return row;
    });
    const highest = rows.map((row) => Math.max(-1, ...row.keys()));
    const memo = new Map<string, { steps: bigint; rest: Map<number, number> }>();
    let cells = 0;
    const normalise = (j: number, cut: number, depth = 0): { steps: bigint; rest: Map<number, number> } => {
        tick();
        if (depth > 256) throw new ResourceLimit();
        if (highest[j] < cut) return { steps: 0n, rest: rows[j] };
        const key = `${j}:${cut}`,
            saved = memo.get(key);
        if (saved) return saved;
        const active = new Map(rows[j]);
        let steps = 0n;
        for (let i = highest[j]; i >= cut; i--) {
            tick();
            const parent = active.get(i);
            if (parent === undefined) continue;
            active.delete(i);
            const sub = normalise(parent, i, depth + 1);
            steps += 1n + sub.steps;
            for (const [id, p] of sub.rest) active.set(id, Math.max(active.get(id) ?? -1, p));
        }
        if ((cells += active.size) > 250000 || memo.size > 8192) throw new ResourceLimit();
        const result = { steps, rest: active };
        memo.set(key, result);
        return result;
    };
    return partialCounts(graph, (j) => normalise(j, 0).steps + 1n);
}
