import {
    entry_display as entry_display_nMN,
    from_display as from_display_nMN,
    from_display_simple as from_display_simple_nMN,
    INFINITY as INFINITY_nMN,
    is_infinity as is_infinity_nMN,
    MarkSpec,
    Mountain as Expr_nMN,
    mountain_display as display_nMN,
    mountain_display_marked as display_marked_nMN,
} from '@/notations/MN/SMN/n_MN.ts';
import {
    anti_lex_compare,
    boolean_compare,
    deepcopy,
    DisplayMap,
    DisplaySet,
    lex_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import { sequence_FS_variants } from '@/notations/notation_utils.ts';
import { draw_mountain_diagram, MountainDiagramData } from '@/notations/draw_mountain_util.ts';

type Expr = Column[];
type Column = Entry[];
type Entry = [number, number];
type Vertical = number[];

const INFINITY: Expr = Infinity as any;

function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

function infinity_FS(index: number): Expr {
    const result: Expr = [[]];
    for (let i = 1; i <= index; ++i) {
        result[i] = [];
        for (let j = 0; j < i; j++) {
            result[i].push([i - 1, 0]);
        }
        result[i].push([i - 1, 1]);
    }
    return result;
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    return expr.length > 0 && expr[expr.length - 1].length > 0;
}

function entry_compare(entry1: Entry, entry2: Entry): number {
    return tuple_lex_compare(entry1, entry2, [number_compare, number_compare]);
}

export function column_compare(col1: Column, col2: Column): number {
    return lex_compare(col1, col2, entry_compare);
}

function compare(expr1: Expr, expr2: Expr): number {
    if (is_infinity(expr1) || is_infinity(expr2)) {
        return boolean_compare(is_infinity(expr1), is_infinity(expr2));
    }
    return lex_compare(expr1, expr2, column_compare);
}

function to_nMN(expr: Expr): Expr_nMN {
    if (is_infinity(expr)) return INFINITY_nMN();
    return expr.map((col) => col.map((entry) => [entry[0] + 1, entry[1]]));
}

function from_nMN(m: Expr_nMN): Expr {
    if (is_infinity_nMN(m)) return INFINITY;
    return m.map((col) => col.map((entry) => [entry[0] - 1, entry[1]]));
}

function entry_display(entry: Entry): string {
    return entry_display_nMN([entry[0] + 1, entry[1]], false);
}

function display(expr: Expr, simple: boolean = false): string {
    return display_nMN(to_nMN(expr), simple);
}

function display_marked(expr: Expr, mark: MarkSpec): string {
    return display_marked_nMN(to_nMN(expr), mark);
}

function from_display(str: string): Expr {
    const m = from_display_nMN(str);
    try {
        return from_nMN(m);
    } catch (_) {
        throw new Error('Illegal input string: ' + str);
    }
}

function from_display_simple(str: string): Expr {
    const m = from_display_simple_nMN(str);
    try {
        return from_nMN(m);
    } catch (_) {
        throw new Error('Illegal input string: ' + str);
    }
}

function vertical_increase(v: Vertical, sep: number): Vertical {
    if (v.length <= sep) {
        const result = Array<number>(sep).fill(0);
        result.push(1);
        return result;
    }
    const result = v.slice();
    result[sep]++;
    result.fill(0, 0, sep);
    return result;
}

function column_verticals(col: Column): Vertical[] {
    let current: Vertical = [];
    const result: Vertical[] = [];
    for (let entry of col) {
        current = vertical_increase(current, entry[1]);
        result.push(current);
    }
    return result;
}

function expr_verticals(expr: Expr): Vertical[][] {
    return expr.map(column_verticals);
}

function vertical_compare(v1: Vertical, v2: Vertical): number {
    return anti_lex_compare(v1, v2, number_compare);
}

function find_index_below_row(V: Vertical[], v: Vertical): number {
    const working = [[], ...V];
    let l = 0,
        r = V.length;
    if (vertical_compare(v, working[r]) > 0) return r;
    while (l < r) {
        const mid = (l + r + 1) >> 1;
        const cmp = vertical_compare(v, working[mid]);
        if (cmp > 0) l = mid;
        else r = mid - 1;
    }
    return l;
}

function find_index_below_equal_row(V: Vertical[], v: Vertical): number {
    const working = [[], ...V];
    let l = 0,
        r = V.length;
    if (vertical_compare(v, working[r]) >= 0) return r;
    while (l < r) {
        const mid = (l + r + 1) >> 1;
        const cmp = vertical_compare(v, working[mid]);
        if (cmp >= 0) l = mid;
        else r = mid - 1;
    }
    return l;
}

type Position = [number, number];

function compute_parent(expr: Expr, V: Vertical[][], [i, j]: Position): Position {
    const entry = expr[i][j];
    const pi = entry[0];
    const v = V[i][j];
    const pj = find_index_below_row(V[pi], v);
    return [pi, pj];
}

function parents(expr: Expr, V: Vertical[][]): Position[][] {
    const result: Position[][] = [];
    for (let i = 0; i < expr.length; i++) {
        result[i] = [];

        for (let j = 0; j < expr[i].length; j++) {
            result[i][j] = compute_parent(expr, V, [i, j]);
        }
    }

    return result;
}

type RelColumn = RelEntry[];
type RelEntry = [boolean, number, number];

function to_rel_column(col: Column, r: number): RelColumn {
    return col.map(([v, s]) => (v >= r ? [true, v - r, s] : [false, v, s]));
}

function compare_rel_column(a: RelColumn, b: RelColumn) {
    return lex_compare(a, b, compare_rel_entry);
}

function compare_rel_entry(a: RelEntry, b: RelEntry): number {
    return tuple_lex_compare(a, b, [boolean_compare, number_compare, number_compare]);
}

// always upgrading
function compute_up_1mn(expr: Expr, P: Position[][], [Ri, Rj]: Position): boolean[] {
    const result: boolean[] = Array(expr.length);
    result.fill(false, 0, Ri);
    result.fill(true, Ri);

    return result;
}

function compute_up_2mn(expr: Expr, P: Position[][], [Ri, Rj]: Position): boolean[] {
    const right = expr.length - 1;

    const result: boolean[] = Array(expr.length);
    result.fill(false, 0, Ri);
    result[Ri] = true;

    for (let i = Ri + 1; i < expr.length; i++) {
        const col = expr[i];

        if (col.length <= Rj + 1) {
            result[i] = false;
            continue;
        }

        if (col.length >= Rj + 3) {
            result[i] = result[P[i][Rj + 1][0]];
            continue;
        }

        const is_finite = col[col.length - 1][1] === 0;
        if (is_finite) {
            result[i] = result[P[i][Rj + 1][0]];
            continue;
        }

        const p = P[i][Rj + 1][0];
        if (p !== Ri) {
            result[i] = result[p];
            continue;
        }

        // perform UP check
        do {
            const X_start = i;
            let Y_start = right;
            while (expr[Y_start].length !== Rj + 2) {
                Y_start = P[Y_start][Rj + 1][0];
            }

            if (Y_start <= X_start) {
                result[i] = X_start === Y_start;
                break;
            }

            for (let k = 1; Y_start + k < expr.length; k++) {
                const Xk = to_rel_column(expr[X_start + k], X_start);
                const Yk = to_rel_column(expr[Y_start + k], Y_start);
                const cmp = compare_rel_column(Xk, Yk);
                if (cmp !== 0) {
                    result[i] = cmp > 0;
                    break;
                }
            }

            if (result[i] === undefined) {
                result[i] = true;
                break;
            }
        } while (false);
    }

    return result;
}

function copy_column(col: Column, [Ri, Rj]: Position, offset: number, y_offset: number, up: boolean): Column {
    let result: Column = col.map(([v, s], j) => [v > Ri ? v + offset : v < Ri ? v : up || j <= Rj ? v + offset : v, s]);
    if (up && y_offset > 0) {
        result = [...result.slice(0, Rj), ...Array<Entry>(y_offset).fill([result[Rj][0], 0]), ...result.slice(Rj)];
    }
    return result;
}

function expand(expr: Expr, index: number, shorter: boolean): Expr {
    if (expr.length === 0) return expr;
    const right = expr.length - 1;
    if (expr[right].length === 0) return expr.slice(0, -1);
    const top = expr[right].length - 1;

    const V = expr_verticals(expr);
    const P = parents(expr, V);

    const [Ri, Rj] = P[right][top];

    const is_finite = expr[right][top][1] === 0;

    const up_list = is_finite ? compute_up_1mn(expr, P, [Ri, Rj]) : compute_up_2mn(expr, P, [Ri, Rj]);

    const result: Expr = expr.slice(0, -1);
    result.push(expr[right].slice(0, -1));
    result[right].push(...expr[Ri].slice(Rj));

    let y_offset = top - Rj;

    for (let w = 1; w <= index; w++) {
        for (let i = Ri + 1; i <= right; i++) {
            result.push(copy_column(result[i], [Ri, Rj], (right - Ri) * w, y_offset * w, up_list[i]));
        }
    }
    if (shorter) result.pop();
    return result;
}

export function convert_to_layer(om: Expr): Expr {
    if (is_infinity(om)) return om;

    const V = om.map(column_verticals);
    const depthMap: number[][] = [];

    for (let i = 0; i < om.length; i++) {
        depthMap[i] = [];
        for (let j = 0; j < om[i].length; j++) {
            const [pi, pj] = compute_parent(om, V, [i, j]);
            depthMap[i][j] = pj === om[pi].length ? 0 : 1 + depthMap[pi][pj];
        }
    }

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

export function convert_from_layer(dm: Expr): Expr {
    if (is_infinity(dm)) return dm;

    const om = deepcopy(dm);

    const V = om.map(column_verticals);

    for (let i = 0; i < om.length; i++) {
        const column = om[i];
        for (let j = 0; j < column.length; j++) {
            const entry = column[j];

            let i1 = i,
                j1 = j - 1;
            while (true) {
                if (i1 === 0) {
                    entry[0] = 0;
                    break;
                }
                if (j1 >= 0) {
                    [i1, j1] = compute_parent(om, V, [i1, j1]);
                } else {
                    i1 = i1 - 1;
                }
                let j0 = find_index_below_equal_row(V[i1], j === 0 ? [] : V[i][j - 1]);
                if (j0 === dm[i1].length || dm[i1][j0][0] < entry[0]) {
                    entry[0] = i1;
                    break;
                }
            }
        }
    }

    return om;
}

function compute_1Y_mountain(expr: Expr): number[][] {
    const V = expr_verticals(expr);
    const P = parents(expr, V);

    const result: number[][] = [];

    for (let i = 0; i < expr.length; i++) {
        result[i] = [1];
        for (let j = expr[i].length - 1; j >= 0; j--) {
            const [Pi, Pj] = P[i][j];
            result[i].unshift(result[i][0] + result[Pi][Pj]);
        }
    }

    return result;
}

function compute_1Y(expr: Expr): number[] {
    return compute_1Y_mountain(expr).map((col) => col[0]);
}

function display_as_1Y(expr: Expr): string {
    if (is_infinity(expr)) return '1,3,9';
    return '' + compute_1Y(expr);
}

function from_1Y(seq: number[]): Expr {
    const m_1y: number[][] = seq.map((x) => [x]);
    const result: Expr = [];
    for (let i = 0; i < seq.length; i++) {
        result[i] = [];
        let current = seq[i];
        while (current !== 1) {
            const j = result[i].length;
            let pi = j === 0 ? i - 1 : result[i][j - 1][0];
            let pj: number = -1;

            while (true) {
                if (result[pi].length === 0) {
                    pj = 0;
                    break;
                }

                const top_j = result[pi][result[pi].length - 1][1] > 0 ? result[pi].length - 1 : result[pi].length;
                pj = Math.min(j, top_j);

                if (m_1y[pi][pj] < current) {
                    break;
                } else {
                    pi = j === 0 ? pi - 1 : result[pi][pj - 1][0];
                }
            }

            result[i].push([pi, pj < j ? 1 : 0]);
            current -= m_1y[pi][pj];
            m_1y[i].push(current);
            if (pj < j && current !== 1) throw new Error('Illegal 1Y seq: ' + seq);
        }
    }
    return result;
}

function from_display_as_1Y(str: string): Expr {
    const seq_1Y = str.split(',').map(Number);
    if (!seq_1Y.every((x) => Number.isInteger(x) && x > 0)) throw new Error('Illegal 1Y seq: ' + str);
    if (seq_1Y.length > 0 && seq_1Y[0] !== 1) throw new Error('Illegal 1Y seq: ' + str);
    if (lex_compare(seq_1Y, [1, 3, 9], number_compare) === 0) return INFINITY;
    return from_1Y(seq_1Y);
}

function sep_display(sep: number, simple: boolean): string {
    if (simple && sep === 0) return '';
    return ','.repeat(sep + 1);
}

function vertical_display(v: Vertical): string {
    const result: number[] = [];
    for (let i = v.length - 1; i >= 0; i--) result.push(...Array<number>(v[i]).fill(i));
    return result.map((s) => sep_display(s, false)).join('/');
}

export function vertical_diff(v1: Vertical, v2: Vertical): number {
    if (v1.length !== v2.length) return v1.length - 1;
    for (let i = v1.length - 1; i >= 0; i--) {
        if (v1[i] !== v2[i]) return i;
    }

    return -1;
}

export interface DiagramData {
    current_equiv: string | undefined;
    invert_vertical?: boolean;
}

function compute_mountain_diagram(m: Expr, current_equiv?: string): MountainDiagramData | undefined {
    if (is_infinity(m) || m.length === 0) return undefined;

    const m_display = current_equiv?.includes('layer') ? convert_to_layer(m) : m;
    const is_y = current_equiv?.includes('1Y') === true;
    const m_1y = is_y ? compute_1Y_mountain(m) : [];
    const V = expr_verticals(m);
    const P = parents(m, V);

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
        entries[i][0] = is_y ? '' + m_1y[i][0] : '*';
        for (let j = 0; j < m[i].length; j++) {
            const vj = vertical_index.get(V[i][j])!;
            entries[i][vj] = is_y ? '' + m_1y[i][j + 1] : entry_display(m_display[i][j]);
            const [pi, pj] = P[i][j];
            if (pi !== -1) {
                const pvj = pj === 0 ? 0 : vertical_index.get(V[pi][pj - 1])!;
                left_legs[i][vj] = [pi, pvj];
            }
        }
    }

    return { sorted_verticals, heights, line_heights, entries, left_legs };
}

export const draw_diagram_control: DiagramControl<Expr, DiagramData> = {
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

export const UP2DBMS_v1: NotationDefinition<Expr> = {
    id: 'up2dbms-v1',
    name: 'UP2DBMS v1',
    description: [{ id: 'description.up2dbms-v1.1' }, { id: 'description.up2dbms-v1.2' }],
    category_id: 'category-upmn',
    display: {
        plain: (m) => display(m),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        layer: {
            plain: (m) => display(convert_to_layer(m)),
            from_display: (str) => convert_from_layer(from_display(str)),
            name: { id: 'display.layer' },
        },
        marked: {
            plain: (m) => display_marked(m, 'label'),
            html: (m) => display_marked(m, 'sub'),
            from_display: from_display,
            name: { id: 'display.index-marked' },
        },
        simple: {
            plain: (m) => display(m, true),
            from_display: from_display_simple,
            name: { id: 'display.index-simple' },
        },
        'layer simple': {
            plain: (m) => display(convert_to_layer(m), true),
            from_display: (s) => convert_from_layer(from_display_simple(s)),
            name: { id: 'display.layer-simple' },
        },
        UP1Y: {
            plain: display_as_1Y,
            from_display: from_display_as_1Y,
        },
    },
    draw_diagram: draw_diagram_control,
    ...sequence_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),
    is_limit,
    compare,
    credit_text_id: 'credit.upmn',

    init: () => [INFINITY, []],
};
