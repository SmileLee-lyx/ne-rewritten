import type { NotationDefinition } from '@/utils.ts';
import { lex_compare, number_compare } from '@/utils.ts';

type Row = number[];
type Expr = Row[];

const data: Record<string, Expr> = {};
const data_alter: Record<string, Expr> = {};

function toShort(expr: Expr): Row[] {
    return expr.slice(1).map((row) => row.slice(1, -row[0]).concat(row[row.length - 1]));
}

function seqseq_compare(m1: Row[], m2: Row[]): number {
    if (m1.length === 0) return m2.length === 0 ? 0 : -1;
    if (m2.length === 0) return 1;
    const cmp = lex_compare(m1[0], m2[0], number_compare);
    if (cmp) return cmp;
    return seqseq_compare(m1.slice(1), m2.slice(1));
}

function compare(expr1: Expr, expr2: Expr): number {
    return seqseq_compare(toShort(expr1), toShort(expr2));
}

function display(expr: Expr): string {
    return '' + expr === 'Infinity'
        ? 'Limit'
        : expr
              .slice(1)
              .map((row) => '(' + row.slice(1).join(',') + ')' + row[0])
              .join('') +
              ';' +
              expr[0].join(',');
}

function pleasantUntil(rows: Row[], t: Row): number {
    const tcheck = t.slice(1 + t[0]),
        tmax = tcheck[0],
        tmin = tcheck[tcheck.length - 1];
    for (let n = 0; n < rows.length; n++) {
        const scheck = rows[n].slice(1);
        const i1 = scheck.findIndex((x) => x < tmax);
        const i2 = (function (arr: number[], pred: (x: number) => boolean) {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (pred(arr[i])) return i;
            }
            return -1;
        })(scheck, (x) => x > tmin);
        if (~i1 && ~i2 && i1 <= i2 && scheck.slice(i1, i2 + 1).some((x) => !tcheck.includes(x))) return n;
    }
    return -1;
}

function isLimit(expr: Expr): boolean {
    if ('' + expr === 'Infinity') return true;
    const active = expr[expr.length - 1];
    if (!active[1 + active[0]]) return false;
    return pleasantUntil(expr.slice(active[1 + active[0]], -1), active) === -1;
}

function cut(expr0: Expr): Expr {
    const expr = expr0.slice(0, -1).map((row) => row.slice());
    expr[0].pop();
    return expr;
}

function compute_parent_for_mapped_row(
    r_old: Row,
    row_idx: number,
    start: number,
    end: number,
    old_height: number,
    tmin: number,
): number {
    let parent = 0;
    if (row_idx <= r_old.length && row_idx >= 1) parent = r_old[row_idx - 1];
    if (parent && start <= parent && parent <= end) return parent - start + old_height;
    let ancestor = parent;
    while (ancestor) {
        if (ancestor < tmin) return ancestor;
        ancestor = r_old[ancestor - 1];
    }
    return 0;
}

function ap(s: Row, t: Row): Row {
    return [s[0]].concat(
        s
            .slice(1)
            .map((x) =>
                x < t[t.length - 1] ? x : x >= t[1 + t[0]] ? x - t[1 + t[0]] + t[1] : t[t.lastIndexOf(x) - t[0]],
            ),
    );
}

function copy(raw: Expr, flag: number): Expr {
    const active = raw[raw.length - 1];
    const expr = cut(raw);
    expr.push(...raw.slice(active[1 + active[0]], active[1 + active[0]] + flag).map((row) => ap(row, active)));
    for (let row_idx = active[1 + active[0]]; row_idx < active[1 + active[0]] + flag; ++row_idx) {
        expr[0].push(
            compute_parent_for_mapped_row(
                raw[0],
                row_idx,
                active[1 + active[0]],
                active[1 + active[0]] + flag - 1,
                raw.length - 1,
                active[active.length - 1],
            ),
        );
    }
    return expr;
}

function extend(raw: Expr): Expr {
    const active = raw[raw.length - 1];
    const expr = cut(raw);
    expr.push(...raw.slice(active[1 + active[0]]).map((row) => ap(row, active)));
    for (let row_idx = active[1 + active[0]]; row_idx < raw.length; ++row_idx) {
        expr[0].push(
            compute_parent_for_mapped_row(
                raw[0],
                row_idx,
                active[1 + active[0]],
                raw.length - 1,
                raw.length - 1,
                active[active.length - 1],
            ),
        );
    }
    return expr;
}

function isAncestor(R: Row, i: number, j: number): boolean {
    return i === j || (i < j && isAncestor(R, i, R[j - 1]));
}

function comp(raw: Expr, i: number, T: Row): Expr {
    const expr = raw.slice(0, i).map((row) => row.slice());
    const u = T.length;
    const li = raw[i].length < raw[i][0] * 2 + 1 ? raw[i][0] : raw[i][0] + 1;
    const ci =
        raw[i].length < raw[i][0] * 2 + 1
            ? raw[i].slice(1, -raw[i][0]).concat(raw[i].slice(1 + raw[i][0]))
            : raw[i].slice(1);
    for (let r = 0; r < u; ++r) {
        let values = ci.concat(T.slice(0, 1 + r)).concat(
            Array(r)
                .fill(0)
                .map((x, rr) => raw[i][1] + 1 + rr),
        );
        values.sort((x, y) => y - x);
        expr[i + r] = [li + r].concat(values);
    }
    for (let ii = i; ii < raw.length; ++ii) {
        let values = raw[ii].slice(1).map((x) => (x <= i ? x : x + u));
        const flag = isAncestor(raw[0], i, ii) && values.findIndex((x) => x <= i) <= raw[ii][0];
        if (flag) {
            values = values.concat(T).concat(
                Array(u)
                    .fill(0)
                    .map((x, uu) => i + 1 + uu),
            );
            values.sort((x, y) => y - x);
        }
        expr[ii + u] = [raw[ii][0] + (flag ? u : 0)].concat(values);
    }
    const m = (x: number) => (x < i ? x : x + u);
    expr[0] = raw[0].slice(0, i);
    for (let r = 0; r < u; ++r) expr[0][i + r] = i + r;
    for (let ii = i + 1; ii < raw.length; ++ii) expr[0][m(ii) - 1] = m(raw[0][ii - 1]);
    return expr;
}

function fullcomp(expr: Expr, i: number): Expr {
    let T = [expr[i][expr[i][0]]];
    do {
        T.unshift(expr[T[0]][2]);
    } while (T[0] > expr[i][expr[i][0] + 1]);
    T = T.slice(1, -1);
    return T.length ? comp(expr, i, T) : expr;
}

function expand(raw: Expr, FSterm: number, longer: boolean): Expr {
    const active = raw[raw.length - 1];
    if (!active[1 + active[0]]) return cut(raw);
    const flag = pleasantUntil(raw.slice(active[1 + active[0]], -1), active);
    let expr = raw;
    if (~flag) {
        expr = copy(expr, flag);
    } else {
        for (let n = 1; n <= FSterm; ++n) expr = extend(expr);
        expr = longer ? copy(expr, 1) : cut(expr);
    }
    for (let i = raw.length - 1; i < expr.length; ++i) {
        if (expr[i].length <= expr[i][0] * 2 + 1) expr = fullcomp(expr, i);
    }
    return expr;
}

function LimitR(n: number): Row {
    return n
        ? [0, 0, 0].concat(
              Array(n - 1)
                  .fill(0)
                  .map((x, nn) => 3 + nn),
          )
        : [0, 0];
}

function Limit_row(n: number): Row {
    return Array(3 + n)
        .fill(0)
        .map((x, nn) => nn)
        .concat(2)
        .reverse();
}

function Limit(n: number): Expr {
    return [LimitR(n), [1, 1, 0], [1, 2, 1, 0]].concat(
        Array(n)
            .fill(0)
            .map((x, nn) => Limit_row(1 + nn)),
    );
}

export const DEN: NotationDefinition<Expr> = {
    id: 'den',
    name: 'Defective embedding notation (DEN)',
    simple_name: 'DEN',
    display,
    is_limit: isLimit,
    compare,
    FS: (m, FSterm) => {
        if ('' + m === 'Infinity') return Limit(FSterm);
        if (m.length <= 1) return [[]];
        return expand(m, FSterm, false);
    },
    FS_alter: (m, FSterm) => {
        if ('' + m === 'Infinity') return Limit(FSterm);
        if (m.length <= 1) return [[]];
        return expand(m, FSterm, true);
    },
    init: () => [[[Infinity]], [[]]],
};
