import { deepcopy, index_of_first, index_of_last, lex_compare, number_compare } from '@/utils.ts';
import type { Diagram, Rgba } from '@/core/diagram_types.ts';
import { sequence_FS_variants } from '@/notations/FS_util.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';

export type Expr = Row[];
type Row = [number, Entry[]];
type Entry = [number, boolean?];

function toShort(expr: Expr) {
    return expr.map((row: Row) =>
        row[1]
            .slice(0, -row[0])
            .concat([row[1][row[1].length - 1]])
            .map((x) => x[0]),
    );
}

function seq_seq_compare(m1: number[][], m2: number[][]): number {
    return lex_compare(m1, m2, (r1, r2) => lex_compare(r1, r2, number_compare));
}

function compare(expr1: Expr, expr2: Expr): number {
    if ('' + expr1 === 'Infinity' && '' + expr2 === 'Infinity') return 0;
    if ('' + expr1 === 'Infinity') return 1;
    if ('' + expr2 === 'Infinity') return -1;
    return seq_seq_compare(toShort(expr1), toShort(expr2));
}

function is_infinity(expr: Row[]) {
    return '' + expr === 'Infinity';
}

function entry_display(x: Entry) {
    return (x[1] ? '*' : '') + x[0];
}

function row_display(row: Row) {
    return '(' + row[1].map(entry_display).join(',') + ')' + row[0];
}

function display(expr: Expr) {
    return is_infinity(expr) ? 'Limit' : expr.map(row_display).join('');
}

function from_display(str: string): Expr {
    if (str === 'Limit') return [Infinity] as any;
    const result: Expr = [];
    const fullPattern = /^(\([^)]+\)\d+)*$/;
    if (!fullPattern.test(str)) throw new Error('illegal input string: ' + str);
    const groupRegex = /\(([^)]+)\)(\d+)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = groupRegex.exec(str)) !== null) {
        if (match.index !== lastIndex) throw new Error('illegal input string: ' + str);
        const inner = match[1],
            stepLengthStr = match[2];
        if (!/^\d+$/.test(stepLengthStr)) throw new Error('illegal input string: ' + str);
        const stepLength = parseInt(stepLengthStr, 10);
        if (inner.length === 0) throw new Error('illegal input string: ' + str);
        const parts = inner.split(',');
        const group: Entry[] = [];
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part.length === 0) throw new Error('illegal input string: ' + str);
            const hasStar = part.startsWith('*');
            let numStr = hasStar ? part.slice(1) : part;
            if (hasStar && numStr.length === 0) throw new Error('illegal input string: ' + str);
            if (!/^\d+$/.test(numStr)) throw new Error('illegal input string: ' + str);
            const num = parseInt(numStr, 10);
            if (hasStar) group.push([num, true]);
            else group.push([num]);
        }
        result.push([stepLength, group]);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex !== str.length) throw new Error('illegal input string: ' + str);
    return result;
}

function values(row: Row) {
    return row[1].map((x) => x[0]);
}

function pleasant_until(rows: Row[], t: Row): number {
    let t_check = values(t).slice(t[0]);
    let t_max = t_check[0],
        t_min = t_check[t_check.length - 1];
    for (let n = 0; n < rows.length; n++) {
        let s_check = rows[n][1];
        let i1 = index_of_first(s_check, ([x]) => x < t_max);
        let i2 = index_of_last(s_check, ([x]) => x > t_min);
        if (~i1 && ~i2 && i1 <= i2 && s_check.slice(i1, i2 + 1).some(([x]) => !t_check.includes(x))) return n;
    }
    return -1;
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    if (expr.length === 0) return false;
    let active = expr[expr.length - 1];
    if (!active[1][active[0]]?.[0]) return false;
    return pleasant_until(expr.slice(active[1][active[0]][0] - 1, -1), active) === -1;
}

function cut(expr: Expr) {
    return deepcopy(expr.slice(0, -1));
}

function seqFrom(expr: Expr, i: number, j: number) {
    let row = expr[i],
        val = row[1][j][0],
        threshold = row[1][j + row[0]]?.[0] ?? 0;
    let record = [[i + 1, j], [val]];
    while (val > threshold) {
        row = expr[val - 1];
        let idx = row[0];
        record[record.length - 1][1] = idx;
        val = row[1][idx]?.[0];
        record.push([val]);
    }
    record.pop();
    return record;
}

function apv(s: number[], t: number[], step_t: number) {
    return s.map((x) =>
        x < t[t.length - 1] ? x : x >= t[step_t] ? x - t[step_t] + t[0] : t[t.lastIndexOf(x) - step_t],
    );
}

function ap(s: Row, t: Row): Row {
    return [s[0], apv(values(s), values(t), t[0]).map((x) => [x])];
}

function copy(raw: Expr, flag: number) {
    let active = raw[raw.length - 1];
    let expr = cut(raw);
    let begin = active[1][active[0]][0];
    let end = ~flag ? active[1][active[0]][0] + flag : raw.length + 1;
    let offset = raw.length - begin;
    expr = expr.concat(raw.slice(begin - 1, end - 1).map((row) => ap(row, active)));
    for (let i = begin - 1; i < end - 1; ++i) {
        let row = raw[i];
        let target_row = expr[i + offset];
        for (let j = 0; j < row[1].length; ++j) {
            if (!row[1][j][1]) continue;
            let seq = seqFrom(raw, i, j);
            let no_move = seq.findIndex((x) => x[0] < active[1][active[0]][0]);
            if (no_move === -1) {
                target_row[1][j][1] = true;
                continue;
            }
            if (seq[no_move][0] < active[1][active[1].length - 1][0]) {
                target_row[1][j][1] = true;
                continue;
            }
            let c = seq[no_move - 1][0] + offset,
                row_c = expr[c - 1],
                b = row_c[1][seq[no_move - 1][1]][0];
            if (
                target_row[1][j + target_row[0] - 1]?.[0] <= active[1][active[1].length - 1][0] &&
                active[1].find((x) => x[0] === b)?.[1]
            )
                target_row[1][j][1] = true;
        }
    }
    return expr;
}

function compTo(raw: Expr, r: number, already: number[][]): Expr {
    let expr = deepcopy(raw);
    for (let j = raw[r][1].length - 1; j >= 0; --j) {
        if (!raw[r][1][j][1]) continue;
        let n = raw[r][1][j][0];
        let seq = seqFrom(raw, r, j);
        let t = seq[seq.length - 1][0];
        let T = already[t - 1];
        if (!T) continue;
        let q = T.length;
        let entries = deepcopy(expr[r][1])
            .concat(T.map((x) => [x]))
            .concat(
                Array(q)
                    .fill(0)
                    .map((_, k: number) => [n + 1 + k, true]),
            );
        entries.sort((x: Entry, y: Entry) => y[0] - x[0]);
        expr[r] = [expr[r][0] + q, entries];
    }
    return expr;
}

function compFrom(raw: Expr, r: number, T: number[]): Expr {
    let expr = deepcopy(raw.slice(0, r));
    let q = T.length;
    let lr = raw[r][1].length < raw[r][0] * 2 ? raw[r][0] : raw[r][0] + 1;
    let cr =
        raw[r][1].length < raw[r][0] * 2
            ? raw[r][1].slice(0, -raw[r][0]).concat(raw[r][1].slice(raw[r][0]))
            : raw[r][1];
    for (let l = 0; l < q; ++l) {
        let entries = deepcopy(cr)
            .concat(T.slice(0, 1 + l).map((x) => [x]))
            .concat(
                Array(l)
                    .fill(0)
                    .map((_, k) => [raw[r][1][0][0] + 1 + k]),
            );
        entries.sort((x, y) => y[0] - x[0]);
        expr[r + l] = [lr + l, entries];
    }
    let entries = deepcopy(raw[r][1])
        .concat(T.map((x) => [x]))
        .concat(
            Array(q)
                .fill(0)
                .map((_, k) => [raw[r][1][0][0] + 1 + k]),
        );
    entries.sort((x, y) => y[0] - x[0]);
    expr[r + q] = [raw[r][0] + q, entries];
    for (let l = 1; l <= q; ++l) for (let k = 1; k <= l; ++k) expr[r + l][1][k][1] = true;
    let m = (x: Entry) => {
        let xx = deepcopy(x);
        xx[0] += xx[0] <= raw[r][1][0][0] ? 0 : q;
        return xx;
    };
    expr = expr.concat(raw.slice(r + 1).map((row) => [row[0], row[1].map(m)]));
    return expr;
}

function expand(raw: Expr, index: number, shorter: boolean = true): Expr {
    let active = raw[raw.length - 1];
    if (!active[1][active[0]]?.[0]) return cut(raw);
    let flag = pleasant_until(raw.slice(active[1][active[0]][0] - 1, -1), active);
    let expr = raw;
    if (~flag) {
        expr = copy(expr, flag);
    } else {
        for (let n = 1; n <= index; ++n) expr = copy(expr, flag);
        expr = shorter ? cut(expr) : copy(expr, 1);
    }
    let already: number[][] = [];
    for (let r = raw.length - 1; r < expr.length; ++r) {
        expr = compTo(expr, r, already);
        if (!(expr[r][1].length <= expr[r][0] * 2)) continue;
        let T = [expr[r][1][expr[r][0] - 1][0]];
        do {
            T.unshift(expr[T[0] - 1][1][1][0]);
        } while (T[0] > expr[r][1][expr[r][0]][0]);
        T = T.slice(1, -1);
        if (T.length < 1) continue;
        expr = compFrom(expr, r, T);
        already[r] = T;
        r += T.length;
    }
    return expr;
}

function Limit_row(n: number): Row {
    return [
        2,
        Array(3 + n)
            .fill(0)
            .map((x, nn): Entry => (3 <= nn && nn < 2 + n ? [nn, true] : [nn]))
            .reverse(),
    ];
}

function infinity_FS(n: number): Expr {
    const start: Expr = [
        [1, [[1], [0]]],
        [1, [[2], [1], [0]]],
    ];
    return start.concat(
        Array(n)
            .fill(0)
            .map((_, i) => Limit_row(1 + i)),
    );
}

export const draw_diagram_control: DiagramControl<Expr, { offset: number }> = {
    default_data: { offset: 0 },
    draw_diagram: (expr: Expr, data: { offset: number }): Diagram | undefined => {
        if (is_infinity(expr) || expr.length === 0) return undefined;
        const A = 16;
        const max_display = 40;
        const total = expr.length;
        const show_all = total <= max_display;
        const start = show_all ? 0 : Math.min(data.offset, total - max_display);
        const end = Math.min(start + max_display, total);
        const visible = end - start;
        const width = end * A + A;
        const height = visible * A + A / 2;
        const elements: Diagram['elements'] = [];
        const lines: Diagram['elements'] = [];
        const circles: Diagram['elements'] = [];
        const extra_text: Diagram['extra_text'] = [];
        const black: Rgba = { r: 0, g: 0, b: 0 };
        const white: Rgba = { r: 255, g: 255, b: 255 };
        const red: Rgba = { r: 255, g: 0, b: 0 };
        for (let vi = 0; vi < visible; vi++) {
            const i = start + vi;
            const entries = expr[i][1];
            const step = expr[i][0];
            const rightmost = entries.length > 0 ? entries[0][0] : 0;
            let prev: number | undefined;
            for (let j = 0; j < entries.length; j++) {
                const pos = entries[j][0];
                const mark = entries[j][1];
                if (prev !== undefined) {
                    lines.push({
                        type: 'line',
                        x1: prev * A + A / 2,
                        y1: vi * A + A / 2,
                        x2: pos * A + A / 2,
                        y2: vi * A + A / 2,
                        stroke: true,
                        stroke_color: black,
                        width: 1,
                    });
                }
                circles.push({
                    type: 'circle',
                    x: pos * A + A / 2,
                    y: vi * A + A / 2,
                    r: A / 4,
                    stroke: true,
                    stroke_color: j === step ? red : black,
                    fill: true,
                    fill_color: mark ? black : white,
                    width: 1,
                });
                prev = pos;
            }
            extra_text.push({
                text: '' + step,
                x: rightmost * A + A,
                y: vi * A + A / 2,
                size: 10,
                color: black,
            });
        }
        elements.unshift(...circles);
        elements.unshift(...lines);
        return { width, height, elements, extra_text };
    },
    handle_action: (data: { offset: number }, action): { offset: number } | null => {
        if (action.type === 'scroll') {
            if (action.direction === 'up') {
                return { offset: Math.max(0, data.offset - action.step) };
            } else if (action.direction === 'down') {
                return { offset: data.offset + action.step };
            }
        }
        return null;
    },
};

export const DEN2: NotationDefinition<Expr> = {
    id: 'den2',
    name: 'DEN2',
    category_id: 'category-den',
    display: { plain: display, from_display },
    is_limit: is_limit,
    compare,
    ...sequence_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),
    draw_diagram: draw_diagram_control,
    credit_text_id: 'credit.den23',

    init: () => [[Infinity] as any, []],
};
