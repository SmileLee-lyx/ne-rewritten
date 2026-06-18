import { deepcopy, lex_compare, NotationDefinition } from '@/utils.ts';

type Sep = Expr;
type Vertical = Sep[];
type Expr = Column[];
type Column = Entry[];
type Entry = [number, Sep];

const data = new Map<string, Expr>();
const datashort = new Map<string, Expr>();

function entry_compare(a: Entry, b: Entry): number {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    return mountain_compare(a[1], b[1]);
}

function column_compare(a: Column, b: Column): number {
    return lex_compare(a, b, entry_compare);
}

function mountain_compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

function mountain_is_limit(m: Expr) {
    return m.length > 0 && m[m.length - 1].length > 0;
}

function mountain_is_one(m: Expr) {
    return m.length === 1 && m[0].length === 0;
}

function sep_display(sep: Sep): string {
    if (sep.every((col) => !col.length)) return ','.repeat(sep.length);
    return mountain_display(sep);
}

function is_infinite(m: Column[]) {
    return '' + m === 'Infinity';
}

function mountain_display(m: Expr): string {
    if (is_infinite(m)) return 'Limit';
    return m.map((col) => '(' + col.map(([v, sep]) => sep_display(sep) + v).join('') + ')').join('');
}

function vertical_compare(a: Vertical, b: Vertical): number {
    let i = 0;
    while (true) {
        if (i >= a.length) return i >= b.length ? 0 : -1;
        if (i >= b.length) return 1;
        const c = mountain_compare(a[i], b[i]);
        if (c) return c;
        ++i;
    }
}

function vertical_increase(v: Vertical, m: Sep): Vertical {
    let i = v.length - 1;
    while (i >= 0 && mountain_compare(v[i], m) < 0) --i;
    return v.slice(0, i + 1).concat([m]);
}

function find_index_below_row(verticals: Vertical[], y: Vertical): number {
    const working = [[] as Vertical].concat(verticals);
    let i1 = 0,
        i2 = working.length - 1;
    while (i1 < i2) {
        const i = Math.ceil((i1 + i2) / 2);
        if (vertical_compare(working[i], y) < 0) i1 = i;
        else i2 = i - 1;
    }
    return i1;
}

function parent(A: Expr, verticalss: Vertical[][], [i, j]: [number, number]): [number, number] {
    const target_column = A[i][j][0] - 1;
    const target_i = find_index_below_row(verticalss[target_column], verticalss[i][j]);
    return [target_column, target_i];
}

function column_verticals(column: Column): Vertical[] {
    const v: Vertical[] = [[]];
    for (let j = 0; j < column.length; ++j) v.push(vertical_increase(v[j], column[j][1]));
    return v.slice(1);
}

function get_references(A: Expr, rtops: Vertical[]): number[] {
    const verticals = column_verticals(A[A.length - 1]);
    verticals.unshift([]);
    const ref: number[] = [];
    let i = 0,
        j = 0;
    while (i < verticals.length && j < rtops.length) {
        if (vertical_compare(verticals[i], rtops[j]) < 0) {
            ref[j] = i;
            ++i;
        } else {
            ++j;
        }
    }
    return ref;
}

function threshold(A: Expr, shorter: boolean, low: Vertical, high: Vertical): number {
    let n = 0;
    while (true) {
        const res = expand(A, n, shorter);
        if (vertical_compare(vertical_increase(low, res), vertical_increase(high, res)) >= 0) return n;
        n++;
    }
}

function expand(A0: Expr, index: number, shorter: boolean = false): Expr {
    const data_key = mountain_display(A0);
    if (shorter) {
        const v = datashort.get(data_key + '"' + index);
        if (v) return v;
    } else {
        const v = data.get(data_key + '"' + index);
        if (v) return v;
    }

    const rightmost = A0.length - 1;
    const topmost = A0[rightmost].length - 1;
    const A = deepcopy(A0);

    if (topmost === -1) {
        A.pop();
        return A;
    }

    const top_right_entry = A[rightmost][topmost];
    let top_right_separator = top_right_entry[1];
    const V0 = A.map(column_verticals);
    const BRij = parent(A, V0, [rightmost, topmost]);
    const width = rightmost - BRij[0];

    if (mountain_is_limit(top_right_separator)) {
        A[rightmost][topmost][1] = expand(
            top_right_separator,
            threshold(top_right_separator, shorter, V0[BRij[0]][BRij[1] - 1] ?? [], V0[rightmost][topmost - 1] ?? []) +
                index,
            shorter,
        );
        return A;
    }

    const top_verticals = V0[BRij[0]].slice(0, BRij[1]);
    top_verticals.push(V0[rightmost][topmost]);

    if (mountain_is_one(top_right_separator)) A[rightmost].pop();
    else {
        top_right_separator = top_right_separator.slice(0, -1);
        if (
            vertical_compare(
                vertical_increase(V0[BRij[0]][BRij[1] - 1] ?? [], top_right_separator),
                V0[rightmost][topmost - 1] ?? [],
            ) <= 0
        )
            A[rightmost].pop();
        else A[rightmost][topmost][1] = top_right_separator;
    }
    A[rightmost] = A[rightmost].concat(A[BRij[0]].slice(BRij[1]));
    const V = A.map(column_verticals);
    const magma_checks_list: number[][] = [];
    for (let i = BRij[0] + 1; i <= rightmost; ++i) {
        magma_checks_list[i] = [];
        for (let j = 0; j < A[i].length; ++j) {
            let working: [number, number] = [i, j];
            while (working[0] > BRij[0]) {
                if (A[working[0]].length <= working[1]) --working[1];
                working = parent(A, V, working);
            }
            magma_checks_list[i][j] =
                working[0] === BRij[0] &&
                working[1] <= BRij[1] &&
                !vertical_compare(V[working[0]][working[1] - 1] ?? [], V[i][j - 1] ?? [])
                    ? working[1]
                    : -1;
        }
    }
    for (let n = 1; n <= index; ++n) {
        const refs = get_references(A, top_verticals);
        refs[-1] = -1;
        for (let dx = 1; dx <= width; ++dx) {
            const x = BRij[0] + dx;
            const source_magmas = magma_checks_list[x];
            const target_column: Column = [];
            A[x].forEach((entry, y) => {
                const value = entry[0];
                if (~source_magmas[y]) {
                    const BR_index = source_magmas[y];
                    for (let j = refs[BR_index - 1] + 1; j <= refs[BR_index]; ++j) {
                        if (j === refs[BR_index]) target_column.push([value + width * n, entry[1]]);
                        else target_column.push([value + width * n, A[BRij[0] + width * n][j][1]]);
                    }
                } else {
                    target_column.push([value + (value > BRij[0] ? width * n : 0), entry[1]]);
                }
            });
            A[x + width * n] = target_column;
        }
    }
    if (shorter) A.pop();
    if (shorter) datashort.set(data_key + '"' + index, A);
    else data.set(data_key + '"' + index, A);
    return A;
}

function Limit(n: number): Expr {
    return n > 0 ? [[], [[1, Limit(n - 1)]]] : [[]];
}

function calc_ancestor_depths(m: Expr): number[][] {
    if (!Array.isArray(m) || m.length === 0) return [];
    const V = m.map(column_verticals);
    const depthMap: number[][] = Array.from({ length: m.length }, () => []);
    const visited = new Set();

    function getDepth(i: number, j: number): number {
        const key = `${i},${j}`;
        if (visited.has(key)) return 0;
        visited.add(key);
        const [pCol, pRow] = parent(m, V, [i, j]);
        if (pCol < 0 || pCol >= m.length || pRow < 0 || pRow >= m[pCol].length) {
            visited.delete(key);
            return 0;
        }
        const depth = 1 + getDepth(pCol, pRow);
        visited.delete(key);
        return depth;
    }

    for (let i = 0; i < m.length; i++) {
        const column = m[i];
        for (let j = 0; j < column.length; j++) {
            depthMap[i][j] = getDepth(i, j);
        }
    }
    return depthMap;
}

function convert_to_layer(om: Expr): Expr {
    if (is_infinite(om)) return om;

    const depthMap = calc_ancestor_depths(om);
    const dm = deepcopy(om);
    for (let i = 0; i < dm.length; i++) {
        const column = dm[i];
        for (let j = 0; j < column.length; j++) {
            const entry = column[j];
            entry[0] = depthMap[i][j] + 1;
            if (Array.isArray(entry[1]) && entry[1].length > 0) {
                entry[1] = convert_to_layer(entry[1]);
            }
        }
    }
    return dm;
}

function convert_from_layer(dm: Expr): Expr {
    if (is_infinite(dm)) return dm;

    const om = deepcopy(dm);
    for (let i = 0; i < om.length; i++) {
        const column = om[i];
        for (let j = 0; j < column.length; j++) {
            const entry = column[j];
            if (Array.isArray(entry[1]) && entry[1].length > 0) {
                entry[1] = convert_from_layer(entry[1]);
            }
        }
    }

    let V = om.map(column_verticals);
    for (let i = 0; i < om.length; i++) {
        const column = om[i];
        for (let j = 0; j < column.length; j++) {
            const entry = column[j];

            let i1 = i,
                j1 = j - 1;
            while (true) {
                if (i1 === 0) {
                    entry[0] = 1;
                    break;
                }
                if (j1 >= 0) {
                    [i1, j1] = parent(om, V, [i1, j1]);
                } else {
                    i1 = i1 - 1;
                }
                let j0 = find_index_below_row(V[i1], j === 0 ? [[[]]] : V[i][j - 1].concat([[[]]]));
                if (j0 === dm[i1].length || dm[i1][j0][0] < entry[0]) {
                    entry[0] = i1 + 1;
                    break;
                }
            }
        }
    }

    return om;
}

export const T_omega_MN: NotationDefinition<Expr> = {
    id: 't-omega-mn',
    name: 'TωMN',
    display: mountain_display,
    display_equiv: {
        layer: (m) => mountain_display(convert_to_layer(m)),
    },
    is_limit: mountain_is_limit,
    compare: mountain_compare,
    FS: (m: Expr, index: number) => {
        if (is_infinite(m)) return Limit(index);
        if (m.length === 0) return [];
        return expand(m, index, true);
    },
    FS_alter: (m: Expr, index: number) => {
        if (is_infinite(m)) return Limit(index);
        if (m.length === 0) return [];
        return expand(m, index);
    },
    FS_short: (m: Expr, index: number) => {
        if (is_infinite(m)) return Limit(index);
        if (m.length === 0) return [];
        if (index === 0) return expand(m, 0, true);
        if (index === 1) {
            if (mountain_compare(expand(m, 0, true), expand(m, 0, false)) === 0) return expand(m, 1, true);
            else return expand(m, 0, false);
        }
        if (
            mountain_compare(expand(m, 0, true), expand(m, 0, false)) === 0 ||
            mountain_compare(expand(m, 1, true), expand(m, 0, false)) === 0
        )
            return expand(m, index, true);
        return expand(m, index - 1, true);
    },
    init: () => [[[Infinity] as any], []],
};
