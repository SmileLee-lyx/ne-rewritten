import {
    DiagramData,
    draw_diagram_control as draw_diagram_control_nMN,
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
    lex_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import { Diagram } from '@/core/diagram_types.ts';
import { sequence_FS_variants } from '@/notations/notation_utils.ts';

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
        result[i] = [[i - 1, 1]];
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

function compute_up_1mn(expr: Expr, P: Position[][], [Ri, Rj]: Position): boolean[] {
    const right = expr.length - 1;

    const result: boolean[] = Array(expr.length);
    result.fill(false, 0, Ri);
    result[Ri] = true;

    if (Rj === 0) {
        result.fill(true, Ri);
        return result;
    }

    for (let i = Ri + 1; i < expr.length; i++) {
        const col = expr[i];

        if (col.length <= Rj) {
            result[i] = false;
            continue;
        }

        const p = P[i][Rj - 1][0];
        if (p !== Ri) {
            result[i] = result[p];
            continue;
        }

        // perform UP check
        do {
            const X_start = i;
            let Y_start = right;
            const j = col.findIndex((entry) => entry[0] === Ri);
            while (P[Y_start][j][0] !== Ri) {
                Y_start = P[Y_start][j][0];
            }

            if (Y_start <= X_start) {
                result[i] = X_start === Y_start;
                break;
            }

            const X0 = expr[X_start].slice(j);
            const Y0 = expr[Y_start].slice(j);
            const cmp_0 = column_compare(X0, Y0);
            if (cmp_0 !== 0) {
                result[i] = cmp_0 > 0;
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

function compute_up_2mn(expr: Expr, P: Position[][], [Ri, Rj]: Position): boolean[] {
    const right = expr.length - 1;

    const result: boolean[] = Array(expr.length);
    result.fill(false, 0, Ri);
    result[Ri] = true;

    for (let i = Ri + 1; i < expr.length; i++) {
        const col = expr[i];

        if (col.length <= Rj) {
            result[i] = false;
            continue;
        }

        if (col.length >= Rj + 2) {
            result[i] = result[P[i][Rj][0]];
            continue;
        }

        const is_finite = col[col.length - 1][1] === 0;
        if (is_finite) {
            result[i] = false;
            continue;
        }

        const p = P[i][Rj][0];
        if (p !== Ri) {
            result[i] = result[p];
            continue;
        }

        // perform UP check
        do {
            const X_start = i;
            let Y_start = right;
            while (expr[Y_start].length !== Rj + 1) {
                Y_start = P[Y_start][Rj][0];
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
    let result: Column = col.map(([v, s]) => [v > Ri ? v + offset : v < Ri ? v : up ? v + offset : v, s]);
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
    if (!is_finite && top === Rj) {
        result[right].push([Ri, 0]);
    }
    result[right].push(...expr[Ri].slice(Rj));

    let y_offset = is_finite ? 0 : Math.max(top - Rj, 1);

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

const draw_diagram_control: DiagramControl<Expr, DiagramData> = {
    default_data: draw_diagram_control_nMN.default_data,
    settings: draw_diagram_control_nMN.settings,
    draw_diagram(expr, data): Diagram | undefined {
        return draw_diagram_control_nMN.draw_diagram(to_nMN(expr), data);
    },
    handle_action: draw_diagram_control_nMN.handle_action,
};

export const UP2MN_v1b_plus: NotationDefinition<Expr> = {
    id: 'up2mn-v1b+',
    name: 'UP2MN v1B+',
    description: [{ id: 'description.up2mn-v1b-plus.1' }, { id: 'description.up2mn-v1b-plus.2' }],
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
    },
    draw_diagram: draw_diagram_control,
    ...sequence_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),
    is_limit,
    compare,
    credit_text_id: 'credit.upmn',

    init: () => [INFINITY, []],
};
