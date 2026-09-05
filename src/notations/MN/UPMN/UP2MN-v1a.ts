import {
    boolean_compare,
    deepcopy,
    DisplayMap,
    DisplaySet,
    lex_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';
import { draw_mountain_diagram, MountainDiagramData } from '@/notations/draw_mountain_util.ts';
import { DiagramControl, NotationCategoryDefinition, NotationDefinition } from '@/notation-definition.ts';
import {
    Column,
    compare,
    convert_from_layer,
    convert_to_layer,
    draw_diagram_control,
    from_display,
    from_display_simple,
    is_limit,
    Mountain,
    mountain_display,
    mountain_display_marked,
    to_data_key,
    expand as MN_expand,
    column_verticals,
    parent,
    column_compare,
    Entry,
    subtract_1,
} from '@/notations/MN/SMN/n_MN.ts';

function INFINITY(): Mountain {
    return [[], [[1, 1]], [[2, 1]]];
}

function is_infinity(expr: Mountain): boolean {
    return compare(expr, INFINITY()) === 0;
}

function infinity_FS(index: number): Mountain {
    return MN_expand(INFINITY(), index);
}

function has_infinite(col: Column): boolean {
    return col.length > 0 && col[col.length - 1][1] > 0;
}

function finite_height(col: Column): number {
    return has_infinite(col) ? col.length - 1 : col.length;
}

function copy_column(col: Column, [Ri, Rj]: [number, number], offset: number, up: boolean, y_offset: number) {
    const result: Column = [];
    if (col.length === 0 && Rj === 0 && up) {
        for (let k = 0; k < y_offset; k++) {
            result.push([Ri + 1 + offset, 0]);
        }
    }
    for (let j = 0; j < col.length; j++) {
        const [v, s] = col[j];
        if (j === Rj && up) {
            for (let k = 0; k < y_offset; k++) {
                result.push([v + offset, 0]);
            }
        }
        if (v > Ri + 1 || (v === Ri + 1 && (up || j < Rj))) {
            result.push([v + offset, s]);
        } else {
            result.push([v, s]);
        }
    }
    return result;
}

function expand_a(m: Mountain, index: number, shorter: boolean = false): Mountain {
    if (is_infinity(m)) return infinity_FS(index);
    if (m.length === 0) return m;
    const right = m.length - 1;
    if (m[right].length === 0) return m.slice(0, -1);
    const top = m[right].length - 1;

    if (!has_infinite(m[right])) {
        return MN_expand(m, index, shorter);
    }

    const V = m.map(column_verticals);
    const [Ri, Rj] = parent(m, V, [right, top]);
    const offset = right - Ri;
    const y_offset = top === Rj ? 1 : top - Rj;

    const up: boolean[] = Array(m.length).fill(false);
    for (let i = Ri + 1; i < right; i++) {
        const col = m[i];
        if (!has_infinite(col)) {
            if (finite_height(col) <= Rj + 1) continue;
            const [p] = parent(m, V, [i, Rj]);
            up[i] = up[p];
            continue;
        }

        if (finite_height(col) < Rj) continue;
        if (finite_height(col) > Rj) {
            const [p] = parent(m, V, [i, Rj]);
            up[i] = up[p];
            continue;
        }

        const threshold_col: Column = [];
        for (let j = 0; j <= Rj; j++) threshold_col.push([i, 0]);
        threshold_col.push([Ri, 1]);

        const X_start = i;
        let X_end = i + 1;
        while (X_end < m.length && column_compare(m[X_end], threshold_col) >= 0) X_end++;
        if (X_end === m.length) {
            up[i] = true;
            continue;
        }

        const Y_end = m.length;
        let Y_start = right;
        while (finite_height(m[Y_start]) > Rj) {
            const [p] = parent(m, V, [Y_start, Rj]);
            Y_start = p;
        }

        let up_i: boolean | undefined = undefined;
        for (let k = 1; k + X_start < X_end && k + Y_start < Y_end; k++) {
            const X_col: Column = m[X_start + k].map(([v, s]) => [v >= X_start ? v + Y_start - X_start : v, s]);
            const Y_col: Column = m[Y_start + k];
            const cmp = column_compare(X_col, Y_col);
            if (cmp !== 0) {
                up_i = cmp > 0;
                break;
            }
        }
        up[i] = up_i ?? X_end - X_start >= Y_end - Y_start;
    }

    up[right] = true;

    const result: Mountain = subtract_1(m);
    for (let w = 1; w <= index; w++) {
        for (let i = Ri + 1; i <= right; i++) {
            result.push(copy_column(result[i], [Ri, Rj], offset * w, up[i], y_offset * w));
        }
    }

    if (shorter) result.pop();
    return result;
}

export const UP2MN_v1a: NotationDefinition<Mountain> = {
    id: 'UP2MN-v1a',
    name: 'UP2MN v1A',
    category_id: 'category-upmn',
    description: [
        { id: 'description.UP2MN-v1a.1' },
        { id: 'description.UP2MN-v1a.2' },
        { id: 'description.UP2MN-v1a.3' },
        { id: 'description.UP2MN-v1a.4' },
        { id: 'description.UP2MN-v1a.5' },
    ],
    display: {
        plain: (m) => mountain_display(m, false),
        from_display: from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        layer: {
            plain: (m) => mountain_display(convert_to_layer(m), false),
            from_display: (str) => convert_from_layer(from_display(str)),
            name: { id: 'display.layer' },
        },
        marked: {
            plain: (m) => mountain_display_marked(m, 'label'),
            html: (m) => mountain_display_marked(m, 'sub'),
            from_display: from_display,
            name: { id: 'display.index-marked' },
        },
        simple: {
            plain: (m) => mountain_display(m, true),
            from_display: from_display_simple,
            name: { id: 'display.index-simple' },
        },
        'layer simple': {
            plain: (m) => mountain_display(convert_to_layer(m), true),
            from_display: (s) => convert_from_layer(from_display_simple(s)),
            name: { id: 'display.layer-simple' },
        },
    },
    draw_diagram: draw_diagram_control,
    ...MN_FS_variants(expand_a, is_infinity, infinity_FS, is_limit, to_data_key),
    is_limit,
    compare,
    credit_text_id: 'credit.upmn',

    init: () => [INFINITY(), []],
};
