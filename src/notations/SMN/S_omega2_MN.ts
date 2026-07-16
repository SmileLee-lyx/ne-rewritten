import {
    anti_lex_compare,
    boolean_compare,
    deepcopy,
    lex_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';

export type Sep = number[];
export type Vertical = Sep[];
export type Entry = [number, Sep];
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

function entry_display([v, sep]: Entry): string {
    return sep_display(sep) + v;
}

function sep_display(sep: Sep): string {
    return ';'.repeat(sep[1]) + ','.repeat(sep[0]);
}

function from_display(str: string): Mountain {
    if (str === 'Limit') return Limit_expr();

    let i = 0;

    function error(): never {
        throw new Error('Illegal input string: ' + str);
    }

    function normalize_sep(s: Sep): Sep {
        while (s.length > 0 && s[s.length - 1] === 0) s.pop();
        return s;
    }

    function skip_spaces(): void {
        while (i < str.length && str[i] === ' ') i++;
    }

    function skip_index(): void {
        if (i < str.length && str[i] === ':') {
            i++;
            skip_spaces();
            while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
        }
    }

    function parse_sep(): Sep {
        let c0 = 0,
            c1 = 0;
        while (i < str.length && str[i] === ';') {
            c1++;
            i++;
        }
        while (i < str.length && str[i] === ',') {
            c0++;
            i++;
        }
        if (c0 === 0 && c1 === 0) error();
        return normalize_sep([c0, c1]);
    }

    function parse_number(): number {
        const start = i;
        while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
        if (start === i) error();
        return parseInt(str.substring(start, i), 10);
    }

    function parse_parenthesized_column(): Column {
        i++; // skip '('
        const col: Column = [];
        skip_spaces();
        while (i < str.length && str[i] !== ')' && str[i] !== ':') {
            skip_spaces();
            const sep = parse_sep();
            skip_spaces();
            const v = parse_number();
            col.push([v, sep]);
            skip_spaces();
        }
        skip_index();
        skip_spaces();
        if (i >= str.length || str[i] !== ')') error();
        i++; // skip ')'
        return col;
    }

    function parse_unparenthesized_column(): Column {
        skip_spaces();
        if (i >= str.length) error();

        // bare '0' followed by terminator → empty column
        if (
            str[i] === '0' &&
            (i + 1 >= str.length ||
                str[i + 1] === ':' ||
                str[i + 1] === ' ' ||
                str[i + 1] === '(' ||
                str[i + 1] === ',' ||
                str[i + 1] === ';')
        ) {
            i++;
            skip_index();
            return [];
        }

        const col: Column = [];

        // ':' at start → empty column with column index
        if (str[i] === ':') {
            skip_index();
            return [];
        }

        // entries: separator + value
        while (i < str.length && str[i] !== ' ' && str[i] !== '(' && str[i] !== ':') {
            const sep = parse_sep();
            skip_spaces();
            col.push([parse_number(), sep]);
        }

        skip_index();
        return col;
    }

    const result: Mountain = [];
    skip_spaces();
    while (i < str.length) {
        if (str[i] === '(') {
            result.push(parse_parenthesized_column());
        } else {
            result.push(parse_unparenthesized_column());
        }
        skip_spaces();
    }
    return result;
}

function sep_compare(s1: Sep, s2: Sep): number {
    return anti_lex_compare(s1, s2, number_compare);
}

function vertical_compare(v1: Vertical, v2: Vertical): number {
    return lex_compare(v1, v2, sep_compare);
}

function entry_compare(e1: Entry, e2: Entry): number {
    return tuple_lex_compare(e1, e2, [number_compare, sep_compare]);
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

function S(c: Column, j: number, bound: Sep): Sep {
    if (j > c.length) return S(c, j - 1, bound);
    if (j < 0) return [];
    if (sep_compare(c[j][1], bound) >= 0) return [];
    let current = c[j][1];
    let previous = S(c, j - 1, bound);
    return sep_compare(current, previous) < 0 ? previous : current;
}

type StretchData = {
    threshold: Sep;
    stretch_to: Sep;
    force: boolean;
};

export function stretch_data_top(m: Mountain, V: Vertical[][]): StretchData {
    const right: number = m.length - 1;
    const top: number = m[right].length - 1;
    const [Ri, Rj] = parent(m, V, [right, top]);

    let top_right_sep = m[right][top][1];

    if (sep_dimension(top_right_sep) > 0) {
        const threshold = S(m[Ri], Rj - 1, top_right_sep);
        let stretch_to = S(m[right], top - 1, top_right_sep);
        let force = false;
        if (sep_compare(stretch_to, threshold) <= 0) {
            stretch_to = sep_increase(stretch_to, 0);
            force = true;
        }
        return { threshold, stretch_to, force };
    } else {
        const threshold = [top_right_sep[0] - 1, ...top_right_sep.slice(1)];
        const stretch_to = threshold;
        let force = false;
        if (!sep_is_one(top_right_sep)) {
            const v_parent = Rj === 0 ? [] : V[Ri][Rj - 1];
            const v_bottom = top === 0 ? [] : V[right][top - 1];
            if (vertical_compare(vertical_increase(v_parent, stretch_to), v_bottom) > 0) {
                force = true;
            }
        }
        return { threshold, stretch_to, force };
    }
}

export function stretch_data_list(m: Mountain, V: Vertical[][], MI: number[][]): StretchData[] {
    const right: number = m.length - 1;
    const top: number = m[right].length - 1;
    const [Ri, Rj] = parent(m, V, [right, top]);
    const result: StretchData[] = [];

    let ref_j = -1;
    for (let j = 0; j < Rj; j++) {
        while (ref_j + 1 <= top && MI[right][ref_j + 1] <= j) ref_j++;
        let current_top_sep = m[Ri][j][1];

        const threshold = S(m[Ri], j - 1, current_top_sep);
        const stretch_to = S(m[right], ref_j - 1, current_top_sep);
        result[j] = { threshold, stretch_to, force: false };
    }

    result[Rj] = stretch_data_top(m, V);

    return result;
}

export function subtract_1(m: Mountain, V?: Vertical[][], SD_top?: StretchData): Mountain {
    V = V ?? m.map(column_verticals);
    SD_top = SD_top ?? stretch_data_top(m, V);
    const right: number = m.length - 1;
    const top: number = m[right].length - 1;
    const [Ri, Rj] = parent(m, V, [right, top]);

    const result = deepcopy(m);
    result[right].pop();

    if (SD_top.force) {
        const new_sep = SD_top!.stretch_to;
        result[right].push([Ri + 1, new_sep]);
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
            const [value, sep] = m0i[j];
            const new_value = value + offset;
            let current_mi = MI0i[j];
            if (current_mi !== last_mi) {
                last_mi = current_mi;
                while (ref_j < MIr.length && MIr[ref_j] === current_mi) {
                    const is_row_lifting =
                        current_mi === Rj || (ref_j + 1 < MIr.length && MIr[ref_j + 1] === current_mi);
                    if (is_row_lifting) {
                        let [_, ref_sep] = mr[ref_j];
                        result.push([new_value, ref_sep]);
                    }
                    ref_j++;
                }
            }
            const new_sep = vertical_compare(V0i[j], stretch_v_max) > 0 ? sep : compute_stretch(sep, SD[current_mi]);
            result.push([new_value, new_sep]);
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
    return [[], [[1, [index, 1]]]];
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

type MarkSpec = 'label' | 'sub';

function column_display_marked(c: Column, type: MarkSpec, index: number): string {
    let result = c.map(entry_display).join('');
    if (type === 'label') result += ':' + index;
    result = '(' + result + ')';
    if (type === 'sub') result += '<sub>' + index + '</sub>';
    return result;
}

function mountain_display_marked(m: Mountain, type: MarkSpec): string {
    if (is_infinity(m)) return 'Limit';
    return m.map((col, i) => column_display_marked(col, type, i + 1)).join('');
}

export const S_omega2_MN: NotationDefinition<Mountain> = {
    id: 'S-omega2-MN',
    name: "Smile's ω2 MN",
    simple_name: 'Sω2MN',
    category_id: 'category-smile-mn',
    display: {
        plain: display,
        from_display: from_display,
        name_id: 'display.index',
    },
    display_equiv: {
        layer: {
            plain: (m) => display(convert_to_layer(m)),
            from_display: (str) => convert_from_layer(from_display(str)),
            name_id: 'display.layer',
        },
        marked: {
            plain: (m) => mountain_display_marked(m, 'label'),
            html: (m) => mountain_display_marked(m, 'sub'),
            name_id: 'display.index-marked',
        },
    },
    ...MN_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),
    is_limit,
    compare,
    credit_text_id: 'credit.n_mn',

    init: () => [Limit_expr(), []],

    debug: { extend, expand, subtract_1, copy_column, stretch_data_list, column_verticals, magma_indices },
};
