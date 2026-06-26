import {
    deepcopy,
    type DiagramControl,
    DisplayMap,
    DisplaySet,
    lex_compare,
    NotationDefinition,
    number_compare,
} from '@/utils.ts';
import { MN_FS_variants } from '@/notations/FS_util.ts';
import { draw_mountain_diagram, type MountainDiagramData } from '@/notations/draw_mountain_util.ts';

const data = new Map<string, Expr>();
const data_shorter = new Map<string, Expr>();

type Sep = number;
type Vertical = Sep[];
type Entry = [number, Sep];
type Column = Entry[];
type Expr = Column[];

function is_infinity(m: Expr): boolean {
    return ('' + m).startsWith('Infinity');
}

function entry_compare(a: Entry, b: Entry): number {
    return lex_compare(a, b, number_compare);
}

function column_compare(a: Column, b: Column): number {
    return lex_compare(a, b, entry_compare);
}

function mountain_compare(a: Expr, b: Expr): number {
    if (is_infinity(a) && is_infinity(b)) return 0;
    if (is_infinity(a)) return 1;
    if (is_infinity(b)) return -1;
    return lex_compare(a, b, column_compare);
}

function mountain_is_limit(m: Expr): boolean {
    return is_infinity(m) || (m.length > 0 && m[m.length - 1].length > 0);
}

function sep_display(sep: Sep): string {
    return ','.repeat(sep + 1);
}

function vertical_display(v: Vertical): string {
    return v.map(sep_display).join('/');
}

function entry_display(e: Entry): string {
    return sep_display(e[1]) + e[0];
}

function column_display(col: Column): string {
    return '(' + col.map(entry_display).join('') + ')';
}

function mountain_display(m: Expr): string {
    if (is_infinity(m)) return 'Limit';
    return m.map(column_display).join('');
}

function mountain_from_display(str: string): Expr {
    if (str === 'Limit') return [[[Infinity] as any]];

    function parseSimpleSep(start: number): [Sep, number] {
        let c0 = 0;
        while (start + c0 < str.length && str[start + c0] === ',') c0++;
        return [c0 - 1, start + c0];
    }

    function parseExprPrefix(start: number): [Expr, number] {
        const expr: Expr = [];
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
            expr.push(col);
            if (i === str.length || str[i] !== ')') throw new Error('illegal input string: ' + str);
            i++;
        }
        return [expr, i];
    }

    const [result, end] = parseExprPrefix(0);
    if (end !== str.length) throw new Error('illegal input string: ' + str);
    return result;
}

function vertical_compare(a: Vertical, b: Vertical): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
}

function vertical_diff(v1: Vertical, v2: Vertical): Sep {
    let i = 0;
    while (i < v2.length && v1[i] === v2[i]) i++;
    return v1[i];
}

function vertical_increase(v: Vertical, s: Sep): Vertical {
    let i = v.length;
    while (i > 0 && v[i - 1] < s) --i;
    return v.slice(0, i).concat([s]);
}

function find_index_below_row(Vi: Vertical[], v: Vertical): number {
    const working = [[] as Vertical].concat(Vi);
    let i1 = 0,
        i2 = working.length - 1;
    while (i1 < i2) {
        const i = Math.ceil((i1 + i2) / 2);
        if (vertical_compare(working[i], v) < 0) i1 = i;
        else i2 = i - 1;
    }
    return i1;
}

function parent(m: Expr, V: Vertical[][], [i, j]: [number, number]): [number, number] {
    const pi = m[i][j][0] - 1;
    const pj = find_index_below_row(V[pi], V[i][j]);
    return [pi, pj];
}

function column_verticals(column: Column): Vertical[] {
    const v: Vertical[] = [[]];
    for (let j = 0; j < column.length; j++) v.push(vertical_increase(v[j], column[j][1]));
    return v.slice(1);
}

function mountain_verticals(m: Expr): Vertical[][] {
    return m.map(column_verticals);
}

function get_references(m: Expr, rtops: Vertical[]): number[] {
    const verticals = column_verticals(m[m.length - 1]);
    verticals.unshift([]);
    const ref: number[] = [];
    let i = 0,
        j = 0;
    while (i < verticals.length && j < rtops.length) {
        if (vertical_compare(verticals[i], rtops[j]) < 0) {
            ref[j] = i;
            i++;
        } else {
            j++;
        }
    }
    return ref;
}

function expand(m0: Expr, index: number, shorter: boolean = false): Expr {
    const data_key = mountain_display(m0);
    if (shorter) {
        const v = data_shorter.get(data_key + '"' + index);
        if (v) return v;
    } else {
        const v = data.get(data_key + '"' + index);
        if (v) return v;
    }

    const rightmost = m0.length - 1;
    const topmost = m0[rightmost].length - 1;
    const m = deepcopy(m0);

    if (topmost === -1) {
        m.pop();
        return m;
    }

    const tr_entry = m[rightmost][topmost];
    const tr_separator = tr_entry[1];
    const V0 = mountain_verticals(m);
    const BRij = parent(m, V0, [rightmost, topmost]);
    const width = rightmost - BRij[0];
    const top_verticals = V0[BRij[0]].slice(0, BRij[1]);
    top_verticals.push(V0[rightmost][topmost]);

    if (tr_separator === 0) {
        m[rightmost].pop();
    } else {
        const new_tr_separator = tr_separator - 1;
        if (
            vertical_compare(
                vertical_increase(V0[BRij[0]][BRij[1] - 1] ?? [], new_tr_separator),
                V0[rightmost][topmost - 1] ?? [],
            ) <= 0
        )
            m[rightmost].pop();
        else m[rightmost][topmost][1] = new_tr_separator;
    }
    m[rightmost] = m[rightmost].concat(m[BRij[0]].slice(BRij[1]));
    const V = mountain_verticals(m);
    const magma_checks_list: number[][] = [];
    for (let i = BRij[0] + 1; i <= rightmost; i++) {
        magma_checks_list[i] = [];
        for (let j = 0; j < m[i].length; j++) {
            let working: [number, number] = [i, j];
            while (working[0] > BRij[0]) {
                if (m[working[0]].length <= working[1]) --working[1];
                working = parent(m, V, working);
            }
            magma_checks_list[i][j] =
                working[0] === BRij[0] &&
                working[1] <= BRij[1] &&
                !vertical_compare(V[working[0]][working[1] - 1] ?? [], V[i][j - 1] ?? [])
                    ? working[1]
                    : -1;
        }
    }
    for (let n = 1; n <= index; n++) {
        const refs = get_references(m, top_verticals);
        refs[-1] = -1;
        for (let dx = 1; dx <= width; dx++) {
            const x = BRij[0] + dx;
            const source_magmas = magma_checks_list[x];
            const target_column: Column = [];
            m[x].forEach((entry, y) => {
                const value = entry[0];
                if (~source_magmas[y]) {
                    const BR_index = source_magmas[y];
                    for (let j = refs[BR_index - 1] + 1; j <= refs[BR_index]; j++) {
                        if (j === refs[BR_index]) target_column.push([value + width * n, entry[1]]);
                        else target_column.push([value + width * n, m[BRij[0] + width * n][j][1]]);
                    }
                } else {
                    target_column.push([value + (value > BRij[0] ? width * n : 0), entry[1]]);
                }
            });
            m[x + width * n] = target_column;
        }
    }
    if (shorter) m.pop();
    if (shorter) data_shorter.set(data_key + '"' + index, m);
    else data.set(data_key + '"' + index, m);
    return m;
}

function infinity_FS(n: number): Expr {
    return [[], [[1, n]]];
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
    if (is_infinity(om)) return om;

    const depthMap = calc_ancestor_depths(om);
    const dm = deepcopy(om);
    for (let i = 0; i < dm.length; i++) {
        const column = dm[i];
        for (let j = 0; j < column.length; j++) {
            const entry = column[j];
            entry[0] = depthMap[i][j] + 1;
        }
    }
    return dm;
}

function convert_from_layer(dm: Expr): Expr {
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
                let j0 = find_index_below_row(V[i1], j === 0 ? [0] : V[i][j - 1].concat([0]));
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
function compute_mountain_diagram(expr: Expr, current_equiv?: string): MountainDiagramData | undefined {
    if (is_infinity(expr) || expr.length === 0) return undefined;

    const m = expr;
    const m_display = current_equiv === 'layer' ? convert_to_layer(expr) : expr;
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
            entries[i][vj] = entry_display(m_display[i][j]);
            const [pi, pj] = parent(m, V, [i, j]);
            const pvj = pj === 0 ? 0 : vertical_index.get(V[pi][pj - 1])!;
            left_legs[i][vj] = [pi, pvj];
        }
    }

    return { sorted_verticals, heights, line_heights, entries, left_legs };
}

const draw_diagram_control: DiagramControl<Expr, DiagramData> = {
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

export const omega_MN: NotationDefinition<Expr> = {
    id: 'omega-mn',
    name: 'ω mountain notation (ωMN)',
    simple_name: 'ωMN',
    display: { plain: mountain_display, from_display: mountain_from_display },
    display_equiv: {
        layer: {
            plain: (m) => mountain_display(convert_to_layer(m)),
            from_display: (str) => convert_from_layer(mountain_from_display(str)),
        },
    },
    is_limit: mountain_is_limit,
    compare: mountain_compare,
    draw_diagram: draw_diagram_control,
    ...MN_FS_variants(expand, is_infinity, infinity_FS, mountain_is_limit, mountain_display),
    init: () => [[[[Infinity] as any]], [[]], []],
};
