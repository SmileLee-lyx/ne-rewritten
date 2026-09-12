import {
    boolean_compare,
    deepcopy,
    lex_compare,
    number_compare,
    tuple_lex_compare,
    tuple_lex_compare_by,
} from '@/utils.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import { sequence_FS_variants } from '@/notations/notation_utils.ts';
import {
    DiagramData,
    draw_diagram_control as draw_diagram_control_nMN,
    from_display as from_display_nMN,
    from_display_simple as from_display_simple_nMN,
    INFINITY as INFINITY_nMN,
    is_infinity as is_infinity_nMN,
    MarkSpec,
    Mountain,
    mountain_display as display_nMN,
    mountain_display_marked as display_marked_nMN,
} from '@/notations/MN/SMN/n_MN.ts';
import { Diagram } from '@/core/diagram_types.ts';
import { UPMS } from '@/notations/BM-like/UPMS.ts';

type Expr = Column[];
type Column = Entry[];
type Entry = number;

const INFINITY: Expr = Infinity as any;

function is_infinity(e: Expr): boolean {
    return e === INFINITY;
}

function infinity_FS(index: number): Expr {
    return [[], Array.from({ length: index + 1 }, () => 0)];
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    return expr.length > 0 && expr[expr.length - 1].length > 0;
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, compare_column);
}

function compare_column(a: Column, b: Column) {
    return lex_compare(a, b, number_compare);
}

type RelEntry = [boolean, number];
type RelColumn = RelEntry[];

function compare_rel_column(a: RelColumn, b: RelColumn) {
    return lex_compare(a, b, compare_rel_entry);
}

function compare_rel_entry(a: RelEntry, b: RelEntry): number {
    return tuple_lex_compare(a, b, [boolean_compare, number_compare]);
}

function to_rel_column(col: Column, r: number): RelColumn {
    return col.map((v) => (v >= r ? [true, v - r] : [false, v]));
}

function compute_up(expr: Expr, r: number, b: number): boolean[] {
    const right = expr.length - 1;

    const result: boolean[] = Array(expr.length);
    result.fill(false, 0, r);
    result[r] = true;

    for (let i = r + 1; i < expr.length; i++) {
        for (let j = 0; j <= b; j++) {
            if (j >= expr.length) {
                result[i] = false;
            }
            if (j === b) {
                result[i] = result[b === 0 ? i - 1 : expr[i][b - 1]];
            }
            if (expr[i][j] < r) {
                result[i] = false;
                break;
            }
            if (expr[i][j] > r) {
                continue;
            }

            // perform UP check
            do {
                const X_start = i;
                let Y_start = right;
                while (expr[Y_start][j] !== r) Y_start = expr[Y_start][j];

                if (Y_start <= X_start) {
                    result[i] = X_start === Y_start;
                    break;
                }

                const X0 = expr[X_start].slice(j);
                const Y0 = expr[Y_start].slice(j);
                const cmp_0 = lex_compare(X0, Y0, number_compare);
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
            break;
        }
    }

    return result;
}

function copy_column(col: Column, r: number, offset: number, up: boolean): Column {
    return col.map((v) => (v > r ? v + offset : v < r ? v : up ? v + offset : v));
}

function expand(expr: Expr, index: number, shorter: boolean): Expr {
    if (expr.length === 0) return expr;
    const right = expr.length - 1;
    if (expr[right].length === 0) return expr.slice(0, -1);
    const top = expr[right].length - 1;
    const r = expr[right][top];

    const up_list = compute_up(expr, r, top);

    const result: Expr = expr.slice(0, -1);
    result.push([...expr[right].slice(0, -1), ...expr[r].slice(top)]);

    for (let w = 1; w <= index; w++) {
        for (let i = r + 1; i <= right; i++) {
            result.push(copy_column(result[i], r, (right - r) * w, up_list[i]));
        }
    }
    if (shorter) result.pop();
    return result;
}

function to_nMN(expr: Expr): Mountain {
    if (is_infinity(expr)) return INFINITY_nMN();
    return expr.map((col) => col.map((v) => [v + 1, 0]));
}

function from_nMN(m: Mountain): Expr {
    if (is_infinity_nMN(m)) return INFINITY;
    if (!m.every((col) => col.every((entry) => entry[1] === 0))) {
        throw new Error();
    }
    return m.map((col) => col.map((entry) => entry[0] - 1));
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

export function convert_to_layer(om: Expr): Expr {
    if (is_infinity(om)) return om;

    const depthMap: number[][] = [];

    for (let i = 0; i < om.length; i++) {
        depthMap[i] = [];
        for (let j = 0; j < om[i].length; j++) {
            const pi = om[i][j];
            depthMap[i][j] = j >= om[pi].length ? 0 : 1 + depthMap[pi][j];
        }
    }

    const dm = deepcopy(om);
    for (let i = 0; i < dm.length; i++) {
        const column = dm[i];
        for (let j = 0; j < column.length; j++) {
            column[j] = depthMap[i][j];
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

            let i1 = i;
            while (true) {
                if (i1 === 0) {
                    column[j] = 0;
                    break;
                }
                if (j > 0) {
                    i1 = om[i1][j - 1];
                } else {
                    i1 = i1 - 1;
                }
                if (j >= dm[i1].length || dm[i1][j] < entry) {
                    column[j] = i1;
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

function debug_verification(e: Expr): boolean {
    if (is_infinity(e)) return true;

    if (compare(e, convert_from_layer(convert_to_layer(e))) !== 0) return false;

    function to_upms(expr: Expr): number[][] {
        return convert_to_layer(expr).map((col) => col.map((v) => v + 1));
    }

    const e_upms = to_upms(e);
    const e2 = UP1MN.FS(e, 2);
    const e_upms2 = UPMS.FS(e_upms, 2);

    return UPMS.compare(to_upms(e2), e_upms2) === 0;
}

export const UP1MN: NotationDefinition<Expr> = {
    id: 'up1mn',
    name: 'UP1MN',
    description: [{ id: 'description.up1mn' }],
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
    credit_text_id: 'credit.up1mn',

    init: () => [INFINITY, []],
};
