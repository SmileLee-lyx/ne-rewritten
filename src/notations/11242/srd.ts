import { seriesText } from './i18n.ts';
import { budget, lex, natural, partialCounts, ResourceLimit } from './common.ts';
export type SRDExpr = number[][];
export const SRD_INITIAL: SRDExpr = [[0]];
const parentColumn = (g: SRDExpr, p: number) => (p ? g[p - 1] : []);
export const srdPlain = (g: SRDExpr) => g.map((c) => '[' + c.join(',') + ']').join('') || '0';
export const srdCompare = (a: SRDExpr, b: SRDExpr) => lex(a, b, (x, y) => lex(x, y, (p, q) => p - q));

function check(g: SRDExpr): SRDExpr {
    natural(g.length, 8192);
    let cells = 0;
    g.forEach((col, j) => {
        if ((cells += col.length) > 250000) throw new ResourceLimit();
        col.forEach((p, row) => {
            natural(p);
            if (p >= j + 1 || p < col.length - 1 || (row > 0 && col[row - 1] < p))
                throw new Error(seriesText('error.parent-order'));
        });
    });
    return g;
}

export function srdFS(graph: SRDExpr, n: number): SRDExpr {
    natural(n);
    if (!graph.length || !n || !graph.at(-1)!.length) return graph.slice(0, -1);
    const tick = budget(750),
        result = graph.slice(),
        span = graph.length - graph.at(-1)!.at(-1)!;
    natural(graph.length - 1 + n * span, 8192);
    let cells = graph.reduce((s, c) => s + c.length, 0);
    for (let block = 0; block < n; block++) {
        tick();
        const column = result.at(-1)!,
            parent = column.at(-1)!;
        const copies = result.slice(parent).map((source) => {
            tick();
            const size = source.length + (source.length > parent ? span : 0);
            if ((cells += size) > 250000) throw new ResourceLimit();
            const moved = source.map((p) => (p >= parent ? p + span : p));
            return moved
                .slice(0, parent)
                .concat(moved.length > parent ? Array(span).fill(moved[parent]) : [], moved.slice(parent));
        });
        const seam = column.slice(0, -1).concat(parentColumn(result, parent).slice(column.length - 1));
        cells += seam.length - column.length;
        if (cells > 250000) throw new ResourceLimit();
        result[result.length - 1] = seam;
        for (const col of copies) result.push(col);
    }
    return result.slice(0, -1);
}

export function srdParse(raw: string): SRDExpr {
    if (raw.length > 2_000_000) throw new ResourceLimit();
    const s = raw.replace(/\s/g, '');
    const route = /^(?:Limit(?:of(?:SRD|SRPD|RPD0))?|SRD|SRPD|Top|Ω)((?:\[\d+\])*)$/i.exec(s);
    if (route) {
        let result = SRD_INITIAL;
        const steps = [...route[1].matchAll(/\[(\d+)\]/g)];
        if (steps.length > 128) throw new ResourceLimit();
        for (const step of steps) result = srdFS(result, Number(step[1]));
        return result;
    }
    if (!s || s === '∅') return [];
    if (/^\d+$/.test(s)) return Array.from({ length: natural(Number(s), 8192) }, () => []);
    if (!/^(?:\[(?:\d+(?:,\d+)*)?\])+$/.test(s)) throw new Error(seriesText('error.parent-input'));
    return check([...s.matchAll(/\[([^\]]*)\]/g)].map((m) => (m[1] ? m[1].split(',').map(Number) : [])));
}

export function srdCounts(g: SRDExpr): (bigint | null)[] {
    const tick = budget(),
        tables: bigint[][] = [[0n]];
    return partialCounts(g, (j) => {
        const col = g[j],
            table: bigint[] = Array(col.length + 1).fill(0n);
        for (let row = col.length - 1; row >= 0; row--) {
            tick();
            table[row] = table[row + 1] + 1n + (tables[col[row]][row] ?? 0n);
        }
        tables.push(table);
        return table[0] + 1n;
    });
}

export function srdHeights(g: SRDExpr): number[][] {
    const heights: number[][] = [[]];
    for (const col of g) heights.push(col.map((p, row) => 1 + (heights[p][row] ?? 0)));
    return heights.slice(1);
}

export function srdHeightParse(raw: string): SRDExpr {
    const s = raw.replace(/\s/g, '');
    if (!s.startsWith('[')) return srdParse(s);
    if (!/^(?:\[(?:\d+(?:,\d+)*)?\])+$/.test(s)) throw new Error(seriesText('error.height-input'));
    const heights: number[][] = [
        [],
        ...[...s.matchAll(/\[([^\]]*)\]/g)].map((m) => (m[1] ? m[1].split(',').map(Number) : [])),
    ];
    const parents: number[][] = [[]],
        tick = budget();
    for (let j = 1; j < heights.length; j++) {
        parents.push([]);
        while (heights[j].length && heights[j].at(-1) === 0) heights[j].pop();
        for (let row = 0; row < heights[j].length; row++) {
            let p = j;
            do {
                tick();
                p = row ? parents[p]?.[row - 1] : p - 1;
                if (p === undefined || p < 0) throw new Error(seriesText('error.height-parent'));
            } while ((heights[p][row] ?? 0) >= heights[j][row]);
            parents[j].push(p);
        }
    }
    const g = check(parents.slice(1));
    if (srdCompare(srdHeights(g), heights.slice(1))) throw new Error(seriesText('error.height-inverse'));
    return g;
}
