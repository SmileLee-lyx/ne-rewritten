import {
    anti_lex_compare,
    boolean_compare,
    deepcopy,
    lex_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { MN_FS_variants } from '@/notations/FS_util.ts';
import { NotationDefinition } from '@/notation-definition.ts';

export type Sep = number[];
export type Vertical = Sep[];
export type Entry = [number, Sep, boolean];
export type Column = Entry[];
export type Mountain = Column[];

export function Limit_expr(): Mountain {
    return [[[Infinity]]] as any;
}

export function is_infinity(m: Mountain) {
    return '' + m === 'Infinity';
}

export function is_limit(m: Mountain) {
    return is_infinity(m) || (m.length > 0 && m[m.length - 1].length > 0);
}

export function display(m: Mountain): string {
    return is_infinity(m) ? 'Limit' : mountain_display(m);
}

function mountain_display(m: Mountain): string {
    return m.map(column_display).join('');
}

function column_display(c: Column): string {
    return '(' + c.map(entry_display).join('') + ')';
}

function entry_display([v, sep, mark]: Entry): string {
    return sep_display(sep) + (mark ? '*' : '') + v;
}

function sep_display(sep: Sep): string {
    return ';'.repeat(sep[1]) + ','.repeat(sep[0]);
}

function from_display(str: string): Mountain {
    if (str === 'Limit') return Limit_expr();

    function normalizeSep(s: Sep): Sep {
        while (s.length > 0 && s[s.length - 1] === 0) s.pop();
        return s;
    }

    function parseSimpleSep(start: number): [Sep, number] {
        let c0 = 0,
            c1 = 0;
        while (start + c1 < str.length && str[start + c1] === ';') c1++;
        while (start + c1 + c0 < str.length && str[start + c1 + c0] === ',') c0++;
        return [normalizeSep([c0, c1]), start + c1 + c0];
    }

    function parseExprPrefix(start: number): [Mountain, number] {
        const Mountain: Mountain = [];
        let i = start;
        while (i < str.length && str[i] === '(') {
            i++;
            const col: Column = [];
            while (i < str.length && str[i] !== ')') {
                const [sep, nextI] = parseSimpleSep(i);
                i = nextI;
                let mark = i < str.length && str[i] === '*';
                if (mark) i++;
                let valueStart = i;
                while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
                const valueStr = str.substring(valueStart, i);
                if (valueStr === '') throw new Error('illegal input string: ' + str);
                col.push([parseInt(valueStr), sep, mark]);
            }
            Mountain.push(col);
            if (i === str.length || str[i] !== ')') throw new Error('illegal input string: ' + str);
            i++;
        }
        return [Mountain, i];
    }

    const [result, end] = parseExprPrefix(0);
    if (end !== str.length) throw new Error('illegal input string: ' + str);
    return result;
}

function sep_compare(s1: Sep, s2: Sep): number {
    return anti_lex_compare(s1, s2, number_compare);
}

function vertical_compare(v1: Vertical, v2: Vertical): number {
    return lex_compare(v1, v2, sep_compare);
}

function entry_compare(e1: Entry, e2: Entry): number {
    return tuple_lex_compare(e1, e2, [number_compare, sep_compare, undefined]);
}

function column_compare(c1: Column, c2: Column): number {
    return lex_compare(c1, c2, entry_compare);
}

function mountain_compare(m1: Mountain, m2: Mountain): number {
    return lex_compare(m1, m2, column_compare);
}

export function compare(a: Mountain, b: Mountain): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }
    return mountain_compare(a, b);
}

export function sep_is_one(s: Sep): boolean {
    return s.length === 1 && s[0] === 1;
}

export function sep_dimension(s: Sep): number {
    let d = 0;
    while (s[d] === 0) d++;
    return d;
}

export function sep_add(a: Sep, b: Sep): Sep {
    if (b.length === 0) return a;
    let result = deepcopy(a);
    while (result.length < b.length) result.push(0);
    result[b.length - 1] += b[b.length - 1];
    for (let d = 0; d < b.length - 1; d++) {
        result[d] = b[d];
    }
    return result;
}

export function sep_sub(a: Sep, b: Sep): Sep {
    if (a.length > b.length) return a;
    if (a.length < b.length) return [];
    let d = a.length;
    while (d > 0 && a[d - 1] === b[d - 1]) d--;
    if (d === 0 || a[d - 1] < b[d - 1]) return [];
    let result = a.slice(0, d);
    result[d - 1] -= b[d - 1];
    return result;
}

export function sep_increase(a: Sep, d: number): Sep {
    let result = deepcopy(a);
    while (result.length <= d) result.push(0);
    result[d]++;
    result.fill(0, 0, d);
    return result;
}

export function vertical_increase(v: Vertical, s: Sep): Vertical {
    let i = v.length;
    while (i - 1 >= 0 && sep_compare(v[i - 1], s) < 0) i--;
    return [...v.slice(0, i), s];
}

export function column_verticals(c: Column): Vertical[] {
    const result: Vertical[] = [];
    let current: Vertical = [];
    for (let e of c) {
        result.push((current = vertical_increase(current, e[1])));
    }
    return result;
}

export function find_index_below(Vi: Vertical[], v: Vertical): number {
    let l = 0,
        r = Vi.length;
    while (l < r) {
        const j = Math.ceil((l + r) / 2);
        const Vij = j === 0 ? [] : Vi[j - 1];
        if (vertical_compare(Vij, v) < 0) l = j;
        else r = j - 1;
    }
    return l;
}

export function find_index_below_equal(Vi: Vertical[], v: Vertical): number {
    let l = 0,
        r = Vi.length;
    while (l < r) {
        const j = Math.ceil((l + r) / 2);
        const Vij = j === 0 ? [] : Vi[j - 1];
        if (vertical_compare(Vij, v) <= 0) l = j;
        else r = j - 1;
    }
    return l;
}

export type Position = [number, number];

export function parent(m: Mountain, V: Vertical[][], [i, j]: Position): Position {
    const [value, _] = m[i][j];
    const pi = value - 1;
    const pj = pi === -1 ? 0 : find_index_below(V[pi], V[i][j]);
    return [pi, pj];
}

export function magma_indices(m: Mountain, V: Vertical[][], [Ri, Rj]: Position, MI_partial?: number[][]): number[][] {
    const result: number[][] = MI_partial ?? [];
    for (let i = result.length; i < m.length; i++) {
        result.push([]);
        if (i <= Ri) {
            // do nothing
        } else {
            for (let j = 0; j < m[i].length; j++) {
                let [pi, pj] = parent(m, V, [i, j]);
                if (pi < Ri) {
                    break;
                } else if (pi === Ri) {
                    result[i][j] = Math.min(pj, Rj);
                } else {
                    if (pj === m[pi].length) pj--;
                    if (pj >= result[pi].length) break;
                    result[i][j] = result[pi][pj];
                }
            }
        }
    }

    return result;
}

function S(c: Column, j: number): Sep {
    if (j > c.length) return S(c, j - 1);
    if (j < 0) return [];
    if (c[j][1][1]) return [];
    if (c[j][2]) return c[j][1];
    return S(c, j - 1);
}

type StretchData = {
    threshold: Sep;
    stretch_to: Sep;
    force: boolean;
};

export function stretch_data_top(m: Mountain, V: Vertical[][]): StretchData | undefined {
    const right: number = m.length - 1;
    const top: number = m[right].length - 1;
    const [Ri, Rj] = parent(m, V, [right, top]);

    if (m[right][top][1][0] === 0) {
        const threshold = S(m[Ri], Rj - 1);
        let stretch_to = S(m[right], top - 1);
        let force = false;
        if (sep_compare(stretch_to, threshold) <= 0) {
            stretch_to = sep_increase(stretch_to, 0);
            force = true;
        }
        return { threshold, stretch_to, force };
    } else {
        return undefined;
    }
}

export function stretch_data_list(m: Mountain, V: Vertical[][], MI: number[][]): (StretchData | undefined)[] {
    const right: number = m.length - 1;
    const top: number = m[right].length - 1;
    const [Ri, Rj] = parent(m, V, [right, top]);
    const result: (StretchData | undefined)[] = [];

    let ref_j = -1;
    for (let j = 0; j < Rj; j++) {
        while (ref_j + 1 <= top && MI[right][ref_j + 1] <= j) ref_j++;
        if (m[Ri][j][1][0] !== 0) {
            result[j] = undefined;
        } else {
            const threshold = S(m[Ri], j - 1);
            const stretch_to = S(m[right], ref_j - 1);
            result[j] = { threshold, stretch_to, force: false };
        }
    }

    result[Rj] = stretch_data_top(m, V);

    return result;
}

export function subtract_1(m: Mountain, V?: Vertical[][], SD_top?: StretchData): Mountain {
    V = V ?? m.map(column_verticals);
    SD_top = SD_top ?? stretch_data_top(m, V);
    const right: number = m.length - 1;
    const top: number = m[right].length - 1;
    const top_right_sep: Sep = m[right][top][1];
    const [Ri, Rj] = parent(m, V, [right, top]);

    const result = deepcopy(m);
    result[right].pop();

    const top_right_sep_dimension = sep_dimension(top_right_sep);
    if (sep_is_one(top_right_sep)) {
        // do nothing
    } else if (top_right_sep_dimension === 0) {
        const new_sep = [top_right_sep[0] - 1, ...top_right_sep.slice(1)];

        const v_parent = Rj === 0 ? [] : V[Ri][Rj - 1];
        const v_bottom = top === 0 ? [] : V[right][top - 1];
        if (vertical_compare(vertical_increase(v_parent, new_sep), v_bottom) > 0) {
            result[right].push([Ri + 1, new_sep, top_right_sep[0] === 0]);
        }
    } else if (SD_top!.force) {
        const new_sep = SD_top!.stretch_to;
        result[right].push([Ri + 1, new_sep, true]);
    }

    for (let j = Rj; j < m[Ri].length; j++) {
        result[right].push(deepcopy(m[Ri][j]));
    }

    return result;
}

export function compute_stretch(sep: Sep, data: StretchData | undefined): Sep {
    if (data === undefined) return sep;
    let { threshold, stretch_to } = data;
    if (sep_compare(sep, threshold) <= 0) {
        return sep;
    } else {
        return sep_add(stretch_to, sep_sub(sep, threshold));
    }
}

export function copy_column(
    m0i: Column,
    MI0i: number[],
    V0i: Vertical[],
    mr: Column,
    MIr: number[],
    [Ri, Rj]: Position,
    SD: (StretchData | undefined)[],
    offset: number,
    stretch_v_max: Vertical,
): Column {
    const result: Column = [];
    let last_mi = -1;
    let ref_j = 0;
    for (let j = 0; j < m0i.length; j++) {
        if (j >= MI0i.length) {
            let entry = deepcopy(m0i[j]);
            if (entry[0] >= Ri + 1) entry[0] += offset;
            result.push(entry);
        } else {
            const [value, sep, mark] = m0i[j];
            const new_value = value + offset;
            let current_mi = MI0i[j];
            if (current_mi !== last_mi) {
                last_mi = current_mi;
                while (ref_j < MIr.length && MIr[ref_j] === current_mi) {
                    const is_row_lifting =
                        current_mi === Rj || (ref_j + 1 < MIr.length && MIr[ref_j + 1] === current_mi);
                    if (is_row_lifting) {
                        let [_, ref_sep, ref_mark] = mr[ref_j];
                        result.push([new_value, ref_sep, ref_mark]);
                    }
                    ref_j++;
                }
            }
            const new_sep = vertical_compare(V0i[j], stretch_v_max) > 0 ? sep : compute_stretch(sep, SD[current_mi]);
            result.push([new_value, new_sep, mark]);
        }
    }
    return result;
}

export function extend(m0: Mountain): Mountain {
    const right: number = m0.length - 1;
    const top: number = m0[right].length - 1;

    const V0 = m0.map(column_verticals);
    const [Ri, Rj] = parent(m0, V0, [right, top]);
    const MI0 = magma_indices(m0, V0, [Ri, Rj]);
    const SD0 = stretch_data_list(m0, V0, MI0);

    const m = subtract_1(m0, V0, SD0[Rj]);
    const V = [...V0.slice(0, right), column_verticals(m[right])];
    const MI = magma_indices(m, V, [Ri, Rj], MI0.slice(0, right));

    const offset = right - Ri;
    for (let i = Ri + 1; i < m0.length; i++) {
        m.push(copy_column(m0[i], MI0[i], V0[i], m[right], MI[right], [Ri, Rj], SD0, offset, V0[right][top]));
    }
    return m;
}

export function infinity_FS(index: number): Mountain {
    return [[], [[1, [index, 1], false]]];
}

export function expand(m: Mountain, index: number, shorter: boolean = false): Mountain {
    if (is_infinity(m)) return infinity_FS(index);
    if (m.length === 0) return m;
    if (m[m.length - 1].length === 0) return m.slice(0, m.length - 1);
    let current = m;
    for (let i = 0; i < index; ++i) current = extend(current);
    current = shorter ? current.slice(0, current.length - 1) : subtract_1(current);
    return current;
}

function calc_ancestor_depths(m: Mountain): number[][] {
    const V = m.map(column_verticals);
    const depthMap: number[][] = [];

    for (let i = 0; i < m.length; i++) {
        depthMap[i] = [];
        for (let j = 0; j < m[i].length; j++) {
            const [pi, pj] = parent(m, V, [i, j]);
            depthMap[i][j] = pj === m[pi].length ? 1 : 1 + depthMap[pi][pj];
        }
    }
    return depthMap;
}

function convert_to_layer(om: Mountain): Mountain {
    if (is_infinity(om)) return om;

    const depthMap = calc_ancestor_depths(om);
    const dm = deepcopy(om);
    for (let i = 0; i < dm.length; i++) {
        const column = dm[i];
        for (let j = 0; j < column.length; j++) {
            const entry = column[j];
            entry[0] = depthMap[i][j];
        }
    }
    return dm;
}

function convert_from_layer(dm: Mountain): Mountain {
    if (is_infinity(dm)) return dm;

    const om = deepcopy(dm);

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
                let j0 = find_index_below_equal(V[i1], j === 0 ? [] : V[i][j - 1]);
                if (j0 === dm[i1].length || dm[i1][j0][0] < entry[0]) {
                    entry[0] = i1 + 1;
                    break;
                }
            }
        }
    }

    return om;
}

export const SA_omega2_MN: NotationDefinition<Mountain> = {
    id: 'SA-omega2-MN',
    name: "Smile's Astral ω2 MN",
    simple_name: 'SAω2MN',
    display: { plain: display, from_display: from_display },
    display_equiv: {
        layer: {
            plain: (m) => display(convert_to_layer(m)),
            from_display: (str) => convert_from_layer(from_display(str)),
        },
    },
    ...MN_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),
    is_limit,
    compare,
    init: () => [Limit_expr(), []],

    debug: { extend, expand, subtract_1, copy_column, stretch_data_list, column_verticals, magma_indices },
};
