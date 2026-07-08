import {
    boolean_compare,
    deepcopy,
    DisplayMap,
    DisplaySet,
    lex_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { MN_FS_variants } from '@/notations/FS_util.ts';
import { draw_mountain_diagram, MountainDiagramData } from '@/notations/draw_mountain_util.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import type { NotationCategoryDefinition } from '@/core/notation_category.ts';

export type Sep = number;
export type Vertical = Sep[];
export type Entry = [number, Sep];
export type Column = Entry[];
export type Mountain = Column[];

export function INFINITY(): Mountain {
    return [[[Infinity]]] as any;
}

export function is_infinity(m: Mountain) {
    return '' + m === 'Infinity';
}

export function is_limit(m: Mountain) {
    return is_infinity(m) || (m.length > 0 && m[m.length - 1].length > 0);
}

function to_data_key(m: Mountain): string {
    return mountain_display(m, true);
}

function mountain_display(m: Mountain, simple: boolean): string {
    if (is_infinity(m)) return 'Limit';
    return m.map((col) => column_display(col, simple)).join(simple ? ' ' : '');
}

function column_display(c: Column, simple: boolean): string {
    if (simple && c.length === 0) return '0';
    let result = c.map((e) => entry_display(e, simple)).join('');
    return simple ? result : '(' + result + ')';
}

function entry_display([v, sep]: Entry, simple: boolean): string {
    let d_sep = sep_display(sep, simple);
    let d_v = '' + v;
    if (simple && d_v.length >= 2) d_v = '(' + d_v + ')';
    return d_sep + d_v;
}

function sep_display(sep: Sep, simple: boolean): string {
    if (simple && sep === 0) return '';
    return ','.repeat(sep + 1);
}

function vertical_display(v: Vertical): string {
    return v.map((s) => sep_display(s, false)).join('/');
}

function from_display(str: string): Mountain {
    if (str === 'Limit') return INFINITY();

    function parseSimpleSep(start: number): [Sep, number] {
        let c0 = 0;
        while (start + c0 < str.length && str[start + c0] === ',') c0++;
        return [c0 - 1, start + c0];
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
                let valueStart = i;
                while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
                const valueStr = str.substring(valueStart, i);
                if (valueStr === '') throw new Error('illegal input string: ' + str);
                col.push([parseInt(valueStr), sep]);
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

function from_display_simple(s: string): Mountain {
    let i = 0;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function parse_sep(): Sep {
        let count = 0;
        while (i < s.length && s[i] === ',') {
            count++;
            i++;
        }
        return count === 0 ? 0 : count - 1;
    }

    function parse_entry(): Entry {
        const sep = parse_sep();
        let v: number;
        if (i < s.length && s[i] === '(') {
            i++;
            const start = i;
            while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
            if (start === i) error();
            if (i >= s.length || s[i] !== ')') error();
            v = parseInt(s.substring(start, i), 10);
            i++;
        } else if (i < s.length && s[i] >= '0' && s[i] <= '9') {
            v = s.charCodeAt(i) - 48;
            i++;
        } else {
            error();
        }
        return [v, sep];
    }

    function parse_column(): Column {
        const col: Column = [];
        while (i < s.length && s[i] !== ' ') {
            col.push(parse_entry());
        }
        return col;
    }

    function parse_expr(): Mountain {
        const result: Mountain = [];
        while (true) {
            skip_spaces();
            if (i >= s.length) break;
            if (s[i] === '0' && (i + 1 >= s.length || s[i + 1] === ' ')) {
                result.push([]);
                i++;
                continue;
            }
            result.push(parse_column());
        }
        return result;
    }

    skip_spaces();
    if (i + 5 <= s.length && s.substring(i, i + 5) === 'Limit') {
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY();
    }

    const result = parse_expr();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

function sep_compare(s1: Sep, s2: Sep): number {
    return number_compare(s1, s2);
}

function vertical_compare(v1: Vertical, v2: Vertical): number {
    return lex_compare(v1, v2, sep_compare);
}

function entry_compare(e1: Entry, e2: Entry): number {
    return tuple_lex_compare(e1, e2, [number_compare, number_compare]);
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

function vertical_diff(v1: Vertical, v2: Vertical): Sep {
    let i = 0;
    while (i < v2.length && v1[i] === v2[i]) i++;
    return v1[i];
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

function fill_ghost(m0: Mountain): Mountain {
    const m = deepcopy(m0);
    const V = m.map(column_verticals);

    for (let i = 0; i < m.length; i++) {
        for (let j = 0; j < m[i].length; j++) {
            const [pi, pj] = parent(m, V, [i, j]);
            if (pj !== m[pi].length) continue;
            const v_parent = pj === 0 ? [] : V[pi][pj - 1];
            const v = V[i][j];
            const [_, sep] = m[i][j];
            if (vertical_compare(vertical_increase(v_parent, sep), v) < 0) {
                m[pi].push([0, v[v.length - 2]]);
                V[pi].push(v.slice(0, v.length - 1));
            }
        }
    }

    return m;
}

function clear_ghost(m: Mountain): Mountain {
    return m.map((c) => c.filter((e) => e[0] !== 0));
}

export function subtract_1(m: Mountain, V?: Vertical[][]): Mountain {
    V = V ?? m.map(column_verticals);
    const right: number = m.length - 1;
    const top: number = m[right].length - 1;
    const top_right_sep: Sep = m[right][top][1];
    const [Ri, Rj] = parent(m, V, [right, top]);

    const result = deepcopy(m);
    result[right].pop();

    if (top_right_sep > 0) {
        const new_sep: Sep = top_right_sep - 1;
        const v_parent = Rj === 0 ? [] : V[Ri][Rj - 1];
        const v_bottom = top === 0 ? [] : V[right][top - 1];
        if (vertical_compare(vertical_increase(v_parent, new_sep), v_bottom) > 0) {
            result[right].push([Ri + 1, new_sep]);
        }
    }

    for (let j = Rj; j < m[Ri].length; j++) {
        result[right].push(deepcopy(m[Ri][j]));
    }

    return result;
}

export function copy_column(
    m0i: Column,
    MI0i: number[],
    mr: Column,
    MIr: number[],
    [Ri, Rj]: Position,
    offset: number,
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
            result.push([new_value, sep]);
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

    const m = subtract_1(m0, V0);
    const V = [...V0.slice(0, right), column_verticals(m[right])];
    const MI = magma_indices(m, V, [Ri, Rj], MI0.slice(0, right));

    const offset = right - Ri;
    for (let i = Ri + 1; i < m0.length; i++) {
        m.push(copy_column(m0[i], MI0[i], m[right], MI[right], [Ri, Rj], offset));
    }
    return m;
}

export function Limit(index: number): Mountain {
    return [[], [[1, index]]];
}

export function NT_infinity_FS(n: number): (index: number) => Mountain {
    return (index) => [[], Array.from({ length: index }, () => [1, n - 1])];
}

export function expand(m: Mountain, index: number, shorter: boolean = false): Mountain {
    if (is_infinity(m)) return Limit(index);
    if (m.length === 0) return m;
    if (m[m.length - 1].length === 0) return m.slice(0, m.length - 1);
    let current = fill_ghost(m);
    for (let i = 0; i < index; ++i) current = extend(current);
    current = shorter ? current.slice(0, current.length - 1) : subtract_1(current);
    current = clear_ghost(current);
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

export interface DiagramData {
    current_equiv: string | undefined;
    invert_vertical?: boolean;
}

/** 计算层：将 ωMN 的 Expr 转为 MountainDiagramData。 */
function compute_mountain_diagram(expr: Mountain, current_equiv?: string): MountainDiagramData | undefined {
    if (is_infinity(expr) || expr.length === 0) return undefined;

    const m = fill_ghost(expr);
    const m_display = current_equiv?.includes('layer') ? convert_to_layer(expr) : expr;
    const V = m.map(column_verticals);

    const vertical_set = new DisplaySet<Vertical>(vertical_display);
    vertical_set.add([]);
    for (const Vi of V) for (const v of Vi) vertical_set.add(v);
    const sorted = vertical_set.values().sort(vertical_compare);
    const sorted_verticals = sorted.map(vertical_display);
    const vertical_index = new DisplayMap<Vertical, number>(vertical_display);
    for (let i = 0; i < sorted.length; i++) {
        vertical_index.set(sorted[i], i);
    }

    // 计算行高
    const H = 40,
        HS = 5;
    const line_heights: number[] = [];
    const heights: number[] = [0];
    for (let i = 1; i < sorted.length; i++) {
        const sep = vertical_diff(sorted[i], sorted[i - 1]);
        const d_height = H + HS * sep;
        heights.push(heights[i - 1] + d_height);
        for (let k = 0; k <= sep; k++) line_heights.push(heights[i - 1] + H / 2 + HS * k);
    }

    const entries: (string | undefined)[][] = Array.from({ length: m.length }, () =>
        Array.from({ length: vertical_index.size }, () => undefined),
    );
    const left_legs: ([number, number] | undefined)[][] = Array.from({ length: m.length }, () =>
        Array.from({ length: vertical_index.size }, () => undefined),
    );

    for (let i = 0; i < m.length; ++i) {
        entries[i][0] = '*';
        for (let j = 0; j < m[i].length; j++) {
            const vj = vertical_index.get(V[i][j])!;
            entries[i][vj] = j < m_display[i].length ? entry_display(m_display[i][j], false) : '*';
            const [pi, pj] = parent(m, V, [i, j]);
            if (pi !== -1) {
                const pvj = pj === 0 ? 0 : vertical_index.get(V[pi][pj - 1])!;
                left_legs[i][vj] = [pi, pvj];
            }
        }
    }

    return { sorted_verticals, heights, line_heights, entries, left_legs };
}

const draw_diagram_control: DiagramControl<Mountain, DiagramData> = {
    default_data: { current_equiv: undefined, invert_vertical: undefined },
    draw_diagram: (_expr, _data) => {
        const mountain = compute_mountain_diagram(_expr, _data.current_equiv);
        if (!mountain) return undefined;
        return draw_mountain_diagram(mountain, { invert_vertical: _data.invert_vertical ?? false });
    },
    handle_action: (data: DiagramData, action): DiagramData | null => {
        if (action.type === 'scroll') {
            if (action.direction === 'down') {
                return { ...data, invert_vertical: true };
            } else if (action.direction === 'up') {
                return { ...data, invert_vertical: false };
            }
        }
        return null;
    },
};

export const category_n_mn: NotationCategoryDefinition = {
    id: 'category-n-mn',
    name: 'n-MN',
    parent_id: 'category-mn',
    generator: { start: 1, initial: 3, create: (n) => n_MN(n) },
};

export function n_MN(n: number): NotationDefinition<Mountain> {
    return {
        id: n + '-MN',
        name: 'non triangular' + n + 'MN',
        simple_name: n + 'MN',
        category_id: 'category-n-mn',
        display: {
            plain: (m) => mountain_display(m, false),
            from_display: from_display,
        },
        display_equiv: {
            layer: {
                plain: (m) => mountain_display(convert_to_layer(m), false),
                from_display: (str) => convert_from_layer(from_display(str)),
            },
            simple: {
                plain: (m) => mountain_display(m, true),
                from_display: from_display_simple,
            },
            'layer simple': {
                plain: (m) => mountain_display(convert_to_layer(m), true),
                from_display: (s) => convert_from_layer(from_display_simple(s)),
            },
        },
        draw_diagram: draw_diagram_control,
        ...MN_FS_variants(expand, is_infinity, NT_infinity_FS(n), is_limit, to_data_key),
        is_limit,
        compare,
        credit_text_id: 'credit.n_mn',

        init: () => [INFINITY(), []],
    };
}
