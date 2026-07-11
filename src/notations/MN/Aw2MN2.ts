import { deepcopy, lex_compare } from '@/utils.ts';
import { sequence_FS_variants } from '@/notations/notation_utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';

export type Sep = Expr;
export type Vertical = Expr[];
export type Entry = [number, Sep, boolean?];
export type Column = Entry[];
export type Expr = Column[];

export function is_infinity(a: Expr) {
    return '' + a === 'Infinity';
}

export function entry_compare(a: Entry, b: Entry): number {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    return mountain_compare(a[1], b[1]);
}

export function column_compare(a: Column, b: Column): number {
    return lex_compare(a, b, entry_compare);
}

export function mountain_compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

export function mountain_is_limit(m: Expr): boolean {
    return m.length > 0 && m[m.length - 1].length > 0;
}

export function mountain_is_one(m: Expr): boolean {
    return m.length === 1 && m[0].length === 0;
}

export function sep_display(sep: Expr): string {
    if (sep.every((column) => !column.length)) return ','.repeat(sep.length);
    if (
        mountain_display(sep.slice(0, 2)) === mountain_display([[], [[1, [[]]]]]) &&
        sep.slice(2).every((column) => !column.length)
    )
        return ';' + ','.repeat(sep.length - 2);
    return mountain_display(sep);
}

export function entry_display(entry: Entry): string {
    return sep_display(entry[1]) + (entry[2] ? '*' : '') + entry[0];
}

export function column_display(col: Column): string {
    return '(' + col.map(entry_display).join('') + ')';
}

export function mountain_display(m: Expr): string {
    if (is_infinity(m)) return 'Limit';
    return m.map(column_display).join('');
}

export function vertical_compare(a: Vertical, b: Vertical): number {
    return lex_compare(a, b, mountain_compare);
}

export function vertical_increase(v: Vertical, m: Sep) {
    let i = v.length - 1;
    while (i >= 0 && mountain_compare(v[i], m) < 0) --i;
    return v.slice(0, i + 1).concat([m]);
}

export function find_index_below_row(verticals: Vertical[], y: Vertical): number {
    let working: Vertical[] = [[], ...verticals];
    let i1 = 0,
        i2 = working.length - 1;
    while (i1 < i2) {
        let i = Math.ceil((i1 + i2) / 2);
        if (vertical_compare(working[i], y) < 0) i1 = i;
        else i2 = i - 1;
    }
    return i1;
}

export function Parent(A: Expr, V: Vertical[][], [i, j]: [number, number]): [number, number] {
    let target_column = A[i][j][0] - 1;
    let target_j = find_index_below_row(V[target_column], V[i][j]);
    return [target_column, target_j];
}

export function column_verticals(column: Column): Vertical[] {
    let v: Vertical[] = [[]];
    for (let j = 0; j < column.length; ++j) v.push(vertical_increase(v[j], column[j][1]));
    return v.slice(1);
}

export function get_references(A: Expr, rtops: Vertical[]): number[] {
    let verticals = column_verticals(A[A.length - 1]);
    verticals.unshift([]);
    let ref = [],
        i = 0,
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

export function S(A: Expr, i: number, j: number): Sep {
    return A[i]?.[j] ? (A[i][j][2] ? A[i][j][1] : S(A, i, j - 1)) : [];
}

function subtract1(A0: Expr, V0: Vertical[][]): Expr {
    let rightmost = A0.length - 1;
    let topmost = A0[rightmost].length - 1;
    let A = deepcopy(A0);
    let top_right_value = A[rightmost][topmost][0];
    let top_right_separator = A[rightmost][topmost][1];
    let BRij = Parent(A, V0, [rightmost, topmost]);

    A[rightmost].pop();

    if (mountain_is_limit(top_right_separator)) {
        let BR_separator = S(A, BRij[0], BRij[1] - 1);
        let J = mountain_compare(BR_separator, top_right_separator) >= 0 ? [[]] : BR_separator.concat([[]]);

        let alpha = V0[BRij[0]][BRij[1] - 1] ?? [];
        let working_vertical = V0[rightmost][topmost - 1] ?? [];

        if (vertical_compare(vertical_increase(alpha, J), working_vertical) > 0) {
            if (vertical_compare(alpha, working_vertical) > 0) {
                let i = working_vertical.length ? find_index_below_row(V0[BRij[0]], working_vertical) : -1;
                while (++i < BRij[1]) {
                    A[rightmost].push([top_right_value, A[BRij[0]][i][1], A[BRij[0]][i][2]]);
                    working_vertical = vertical_increase(working_vertical, A[BRij[0]][i][1]);
                }
            }
            A[rightmost].push([top_right_value, J, true]);
        }
    } else if (!mountain_is_one(top_right_separator)) {
        top_right_separator = top_right_separator.slice(0, -1);

        let alpha = V0[BRij[0]][BRij[1] - 1] ?? [];
        let working_vertical = V0[rightmost][topmost - 1] ?? [];

        if (vertical_compare(alpha, working_vertical) > 0) {
            let i = working_vertical.length ? find_index_below_row(V0[BRij[0]], working_vertical) : -1;
            while (++i < BRij[1]) {
                A[rightmost].push([top_right_value, A[BRij[0]][i][1], A[BRij[0]][i][2]]);
                working_vertical = vertical_increase(working_vertical, A[BRij[0]][i][1]);
            }
        }

        if (!vertical_compare(alpha, working_vertical)) A[rightmost].push([top_right_value, top_right_separator]);
    }

    return A;
}

function extend(A0: Expr, small = false, weak = false): Expr {
    let rightmost = A0.length - 1;
    let topmost = A0[rightmost].length - 1;
    let V0 = A0.map(column_verticals);
    let BRij = Parent(A0, V0, [rightmost, topmost]);
    let top_separators = A0[BRij[0]].slice(0, BRij[1]).map((entry) => entry[1]);
    top_separators.push(A0[rightmost][topmost][1]);
    let top_verticals = V0[BRij[0]].slice(0, BRij[1]);
    top_verticals.push(V0[rightmost][topmost]);
    let width = rightmost - BRij[0];
    let magma_checks_list: number[][] = [];
    for (let i = BRij[0] + 1; i <= rightmost; ++i) {
        magma_checks_list[i] = [];
        for (let j = 0; j < A0[i].length; ++j) {
            let working: [number, number] = [i, j];
            while (working[0] > BRij[0]) {
                if (A0[working[0]].length <= working[1]) --working[1];
                working = Parent(A0, V0, working);
            }
            magma_checks_list[i][j] =
                working[0] === BRij[0] &&
                working[1] <= BRij[1] &&
                !vertical_compare(V0[working[0]][working[1] - 1] ?? [], V0[i][j - 1] ?? [])
                    ? working[1]
                    : -1;
        }
    }

    let BRi = BRij[0];
    magma_checks_list[BRi] = [];
    for (let j = 0; j < A0[BRi].length; ++j) {
        magma_checks_list[BRi][j] = -1;
    }

    let A = subtract1(A0, V0);
    let refs = get_references(A, top_verticals);
    refs[-1] = -1;

    let stretch_threshold = [],
        stretch_value = [];
    for (let i = 0; i < top_separators.length; ++i) {
        if (!mountain_is_limit(top_separators[i])) {
            stretch_value[i] = 0;
            continue;
        }
        if (mountain_compare(S(A0, BRij[0], i - 1), top_separators[i]) >= 0) {
            stretch_threshold[i] = [[]];
        } else {
            stretch_threshold[i] = S(A0, BRij[0], i - 1).concat([[]]);
        }

        stretch_value[i] = 0;
        for (let j = refs[i]; j - 1 > refs[i - 1]; --j) {
            let M = A[rightmost][j - 1]?.[1] ?? [];
            if (mountain_compare(M, top_separators[i]) < 0 && mountain_compare(M, stretch_threshold[i]) >= 0) {
                stretch_value[i] = M.length - stretch_threshold[i].length + 1;
                break;
            }
        }
    }

    for (let dx = 0; dx <= (small ? 0 : width); ++dx) {
        let x = BRij[0] + dx;
        let source_magmas = magma_checks_list[x];
        if (dx) A[x + width] = [];
        let target_column = A[x + width];
        let BR_index = dx ? -1 : refs.length - 1;
        A0[x].forEach((entry, y) => {
            if (!dx && y < BRij[1]) return;
            var value = entry[0];
            if (~source_magmas[y]) {
                BR_index = source_magmas[y];
                for (var j = refs[BR_index - 1] + 1; j <= refs[BR_index]; ++j) {
                    if (j === refs[BR_index])
                        target_column.push([
                            value + width,
                            !stretch_value[BR_index] ||
                            (weak && vertical_compare(V0[x][y], top_verticals[BR_index] ?? []) >= 0) ||
                            mountain_compare(entry[1], top_separators[BR_index]) >= 0 ||
                            mountain_compare(entry[1], stretch_threshold[BR_index]) < 0
                                ? entry[1]
                                : entry[1].concat(Array(stretch_value[BR_index]).fill([])),
                            entry[2],
                        ]);
                    else target_column.push([value + width, A[BRij[0] + width][j][1], A[BRij[0] + width][j][2]]);
                }
            } else {
                target_column.push([
                    value + (value > BRij[0] ? width : 0),
                    !stretch_value[BR_index] ||
                    (weak && vertical_compare(V0[x][y], top_verticals[BR_index] ?? []) >= 0) ||
                    mountain_compare(entry[1], top_separators[BR_index]) >= 0 ||
                    mountain_compare(entry[1], stretch_threshold[BR_index]) < 0
                        ? entry[1]
                        : entry[1].concat(Array(stretch_value[BR_index]).fill([])),
                    entry[2],
                ]);
            }
        });
    }
    return A;
}

function expand(A0: Expr, index: number, shorter = false): Expr {
    let A = A0;
    for (let n = 1; n <= index; ++n) A = extend(A, false);
    return shorter ? A.slice(0, -1) : extend(A, true);
}

function expand_weak(A0: Expr, index: number, shorter = false): Expr {
    let A = A0;
    for (let n = 1; n <= index; ++n) A = extend(A, false, true);
    return shorter ? A.slice(0, -1) : extend(A, true, true);
}

export function infinity_FS(n: number): Expr {
    let Omega: Expr = [[], [[1, [[]]]]];
    return [[], [[1, [...Omega, ...Array.from({ length: n }, () => [])]]]];
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
        const [pCol, pRow] = Parent(m, V, [i, j]);
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

export function convert_to_layer(om: Expr): Expr {
    if (is_infinity(om)) return om;

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

export function convert_from_layer(dm: Expr): Expr {
    if (is_infinity(dm)) return dm;

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
                    [i1, j1] = Parent(om, V, [i1, j1]);
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

export const A_omega2_MN2: NotationDefinition<Expr> = {
    id: 'a-omega2-mn-2',
    name: 'Astral ω·2 mountain notation 2',
    simple_name: 'Aω2MN2',
    category_id: 'category-hypcos-w2mn',
    display: mountain_display,
    is_limit: mountain_is_limit,
    compare: mountain_compare,
    ...sequence_FS_variants(expand, is_infinity, infinity_FS, mountain_is_limit, mountain_display),
    credit_text_id: 'credit.hypcos_mn',

    init: () => [[[[Infinity] as unknown as Entry]], []],
};

export const wA_omega2_MN2: NotationDefinition<Expr> = {
    id: 'weak-a-omega2-mn-2',
    name: 'weak Astral ω·2 mountain notation 2',
    simple_name: 'wAω2MN2',
    category_id: 'category-hypcos-w2mn',
    display: mountain_display,
    display_equiv: {
        layer: (m) => mountain_display(convert_to_layer(m)),
    },
    is_limit: mountain_is_limit,
    compare: mountain_compare,
    ...sequence_FS_variants(expand_weak, is_infinity, infinity_FS, mountain_is_limit, mountain_display),
    credit_text_id: 'credit.hypcos_mn',
    init: () => [[[[Infinity] as unknown as Entry]], []],
};
