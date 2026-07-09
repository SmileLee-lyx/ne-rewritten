import { DisplayMap, DisplaySet, lex_compare, number_compare } from '@/utils.ts';
import { Y_FS_variants } from '@/notations/notation_utils.ts';
import { draw_mountain_diagram, type MountainDiagramData } from '@/notations/draw_mountain_util.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import type { NotationCategoryDefinition } from '@/core/notation_category.ts';

type Expr = number[];
type Vertical = number[];

interface Entry {
    value: number;
    x: number;
    y: Vertical;
    left_up: Entry[];
    right_up?: Entry;
    left_down?: Entry;
    right_down?: Entry;
}

type Mountain = Entry[][];

function INFINITY(): number[] {
    return [Infinity];
}

function is_infinity(expr: number[]) {
    return '' + expr === 'Infinity';
}

export function sequence_display(expr: Expr): string {
    return is_infinity(expr) ? 'Limit' : '' + expr;
}

export function is_limit(seq: Expr): boolean {
    return seq[seq.length - 1] > 1;
}

export const sequence_from_display = (str: string): Expr => {
    if (str === 'Limit') return INFINITY();
    const result = str.split(',').map((s) => parseInt(s.trim(), 10));
    if (result.find(Number.isNaN) !== undefined) throw new Error('Illegal omega-Y sequence');
    return result;
};

function seq_compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, number_compare);
}

const from_sequence = (seq: Expr): Mountain => {
    const mountain: Mountain = [];
    for (let i = 0; i < seq.length; i++) {
        const bottom: Entry = { value: seq[i], x: i, y: [1], left_up: [] };
        const phantom: Entry = { x: i, y: [], left_up: [], value: undefined! };
        bottom.right_down = phantom;
        phantom.right_up = bottom;
        if (i > 0) {
            bottom.left_down = mountain[i - 1][1];
            mountain[i - 1][1].left_up.push(bottom);
        }
        mountain[i] = [bottom, phantom];
    }
    return mountain;
};

function to_sequence(mountain: Mountain): Expr {
    return mountain.map((col) => col[col.length - 2].value);
}

function vertical_compare(a: Vertical, b: Vertical): number {
    if (a.length > b.length) return 1;
    if (a.length < b.length) return -1;
    for (let i = a.length; i >= 0; i--) {
        if (a[i] > b[i]) return 1;
        if (a[i] < b[i]) return -1;
    }
    return 0;
}

function same_row(entry1: Entry, entry2: Entry) {
    return !vertical_compare(entry1.y, entry2.y);
}

function vertical_increase(y: Vertical, d: number) {
    const c = y.slice();
    c[d] = (c[d] ?? 0) + 1;
    c.fill(0, 0, d);
    return c;
}

function dimension_difference(c1: Vertical, c2: Vertical) {
    let d = Math.max(c1.length, c2.length);
    while (d--) {
        if (c1[d] !== c2[d]) return d;
    }
    return d;
}

function create_entry(parent: Entry, entry: Entry) {
    const new_entry: Entry = {
        value: entry.value - parent.value,
        x: entry.x,
        y: vertical_increase(entry.y, dimension_difference(parent.y, entry.y) + 1),
        left_up: [],
    };
    new_entry.right_down = entry;
    entry.right_up = new_entry;
    new_entry.left_down = parent;
    parent.left_up.push(new_entry);
    return new_entry;
}

function draw_mountain(mountain: Mountain): Mountain {
    for (const column of mountain) {
        while (true) {
            const entry = column[0];
            if (entry.value === 1) break;
            let parent = entry;
            while (true) {
                let up = parent.left_down!;
                while (up.right_up && vertical_compare(up.right_up.y, parent.y) <= 0) up = up.right_up;
                parent = up;
                if (parent.value < entry.value) break;
            }
            column.unshift(create_entry(parent, entry));
        }
    }
    return mountain;
}

function find_lower(column: Entry[], y: Vertical) {
    let i1 = 0,
        i2 = column.length - 1;
    while (i1 < i2) {
        const i = Math.floor((i1 + i2) / 2);
        if (vertical_compare(column[i].y, y) < 0) i2 = i;
        else i1 = i + 1;
    }
    return column[i2];
}

function find_higher_equal(column: Entry[], y: Vertical) {
    let i1 = 0,
        i2 = column.length - 1;
    while (i1 < i2) {
        const i = Math.ceil((i1 + i2) / 2);
        if (vertical_compare(column[i].y, y) >= 0) i1 = i;
        else i2 = i - 1;
    }
    return column[i1];
}

function y_slice(column: Entry[], low_equal: Vertical, high: Vertical) {
    let i1 = 0,
        i2 = column.length - 1;
    while (i1 < i2) {
        const i = Math.floor((i1 + i2) / 2);
        if (vertical_compare(column[i].y, high) < 0) i2 = i;
        else i1 = i + 1;
    }
    const start = i2;
    i1 = start;
    i2 = column.length - 1;
    while (i1 < i2) {
        const i = Math.floor((i1 + i2) / 2);
        if (vertical_compare(column[i].y, low_equal) < 0) i2 = i;
        else i1 = i + 1;
    }
    return column.slice(start, i2);
}

function collect_usual(working_entry: Entry, collection: Entry[] = []) {
    for (const e of working_entry.left_up) {
        const child = e.right_down!;
        if (collection.includes(child)) continue;
        if (same_row(working_entry, child)) {
            collection.push(child);
            collect_usual(child, collection);
        }
    }
    return collection;
}

function collect1D(working_entry: Entry, collection: Entry[] = []) {
    for (const child of working_entry.right_down!.left_up) {
        if (collection.includes(child)) continue;
        if (same_row(working_entry, child)) {
            collection.push(child);
            collect1D(child, collection);
        }
    }
    return collection;
}

function collect(working_entry: Entry) {
    if (
        vertical_compare(working_entry.y, [1]) > 0 &&
        dimension_difference(working_entry.y, working_entry.right_down!.y) === 0
    ) {
        return collect1D(working_entry);
    } else {
        return collect_usual(working_entry);
    }
}

function fill_magma_edge(mountain: Mountain, source_entry: Entry, left_leg_entry: Entry) {
    const target_x = source_entry.x - source_entry.left_down!.x + left_leg_entry.x;
    for (let d = dimension_difference(left_leg_entry.y, left_leg_entry.right_up!.y); d >= 0; --d) {
        const new_entry: Entry = {
            x: target_x,
            y: vertical_increase(left_leg_entry.y, d),
            left_up: [],
            value: undefined!,
        };
        new_entry.left_down = left_leg_entry;
        left_leg_entry.left_up.push(new_entry);
        mountain[target_x].push(new_entry);
    }
}

function copy_single_edge(
    mountain: Mountain,
    source_entry: Entry,
    x_offset: number,
    BR_x: number,
    target_y?: Vertical,
) {
    if (target_y === undefined) target_y = source_entry.y;
    const new_entry: Entry = {
        x: source_entry.x + x_offset,
        y: target_y.slice(),
        left_up: [],
        value: undefined!,
    };
    if (source_entry.y.length > 0) {
        let left_leg_entry: Entry;
        if (source_entry.left_down!.x >= BR_x) {
            left_leg_entry = find_lower(mountain[source_entry.left_down!.x + x_offset], new_entry.y);
        } else {
            left_leg_entry = source_entry.left_down!;
        }
        new_entry.left_down = left_leg_entry;
        left_leg_entry.left_up.push(new_entry);
    }
    mountain[source_entry.x + x_offset].push(new_entry);
}

function expand_weak_magma(seq: Expr, index: number) {
    const mountain = draw_mountain(from_sequence(seq));
    const child = mountain[mountain.length - 1];
    let BR = child[0].left_down!;
    const width = mountain.length - 1 - BR.x;
    let top = mountain[BR.x];
    top = top.slice(
        top.findIndex((entry) => entry === BR),
        top.length - 1,
    );
    top.unshift(child[0]);
    const s = seq.slice();
    s[s.length - 1]--;
    const newMountain = draw_mountain(from_sequence(s));
    BR = newMountain[BR.x].find((entry) => same_row(entry, BR))!;
    const magma_entries: Entry[][] = [];
    for (let BR1 = BR; true; BR1 = BR1.right_down!) {
        collect_usual(BR1).forEach((entry) => {
            const dx = entry.x - BR.x;
            if (magma_entries[dx] === undefined) magma_entries[dx] = [];
            magma_entries[dx].push(entry);
        });
        if (!BR1.y.length) break;
    }
    for (let n = 1; n <= index; n++) {
        const ref = top.map((top_entry) => find_lower(newMountain[newMountain.length - 1], top_entry.y));
        for (let dx = 1; dx <= width; dx++) {
            const column: Entry[] = [];
            newMountain[BR.x + n * width + dx] = column;
            for (const magma_entry of magma_entries[dx]) {
                copy_single_edge(newMountain, magma_entry, n * width, BR.x);
                let source_entry = magma_entry;
                let target_y = find_higher_equal(ref, magma_entry.y).y;
                const target_y0 = target_y;
                while (!(source_entry.value <= 1 || magma_entries[dx].includes(source_entry.right_up!))) {
                    target_y = vertical_increase(
                        target_y,
                        dimension_difference(source_entry.y, source_entry.right_up!.y),
                    );
                    source_entry = source_entry.right_up!;
                    copy_single_edge(newMountain, source_entry, n * width, BR.x, target_y);
                }
                const left_leg_x = magma_entry.right_up!.left_down!.x + n * width;
                y_slice(newMountain[left_leg_x], magma_entry.y, target_y0).forEach((left_leg_entry) =>
                    fill_magma_edge(newMountain, magma_entry.right_up!, left_leg_entry),
                );
            }
            column.sort((entry1, entry2) => -vertical_compare(entry1.y, entry2.y));
            for (let i = 0; i < column.length - 1; i++) {
                column[i].right_down = column[i + 1];
                column[i + 1].right_up = column[i];
            }
            column[0].value = 1;
            column.slice(1, column.length - 1).forEach((entry) => {
                entry.value = entry.right_up!.value + entry.right_up!.left_down!.value;
            });
        }
    }
    return to_sequence(newMountain);
}

function expand_actual_magma(seq: Expr, index: number) {
    const mountain = draw_mountain(from_sequence(seq));
    const child = mountain[mountain.length - 1];
    const BR = child[0].left_down!;
    const width = mountain.length - 1 - BR.x;
    let top = mountain[BR.x];
    top = top.slice(
        top.findIndex((entry) => entry === BR),
        top.length - 1,
    );
    top.unshift(child[0]);
    const s = seq.slice();
    s[s.length - 1]--;
    const sMountain = draw_mountain(from_sequence(s));
    const newBR = sMountain[BR.x].find((entry) => same_row(entry, BR))!;
    const magma_entries: Entry[][] = [];
    for (let BR1 = newBR; true; BR1 = BR1.right_down!) {
        collect(BR1).forEach((entry) => {
            const dx = entry.x - BR1.x;
            if (magma_entries[dx] === undefined) magma_entries[dx] = [];
            magma_entries[dx].push(entry);
        });
        if (!BR1.y.length) break;
    }
    for (let n = 1; n <= index; n++) {
        const ref = top.map((top_entry) => find_lower(sMountain[sMountain.length - 1], top_entry.y));
        for (let dx = 1; dx <= width; dx++) {
            const column: Entry[] = [];
            sMountain[BR.x + n * width + dx] = column;
            for (const magma_entry of magma_entries[dx]) {
                copy_single_edge(sMountain, magma_entry, n * width, BR.x);
                let source_entry = magma_entry;
                let target_y = find_higher_equal(ref, magma_entry.y).y;
                const target_y0 = target_y;
                while (!(source_entry.value <= 1 || magma_entries[dx].includes(source_entry.right_up!))) {
                    target_y = vertical_increase(
                        target_y,
                        dimension_difference(source_entry.y, source_entry.right_up!.y),
                    );
                    source_entry = source_entry.right_up!;
                    copy_single_edge(sMountain, source_entry, n * width, BR.x, target_y);
                }
                if (!magma_entry.y.length) continue;
                const left_leg_x = magma_entry.left_down!.x + n * width;
                y_slice(sMountain[left_leg_x], magma_entry.y, target_y0).forEach((left_leg_entry) =>
                    fill_magma_edge(sMountain, magma_entry, left_leg_entry),
                );
            }
            column.sort((entry1, entry2) => -vertical_compare(entry1.y, entry2.y));
            for (let i = 0; i < column.length - 1; i++) {
                column[i].right_down = column[i + 1];
                column[i + 1].right_up = column[i];
            }
            column[0].value = 1;
            column.slice(1, column.length - 1).forEach((entry) => {
                entry.value = entry.right_up!.value + entry.right_up!.left_down!.value;
            });
        }
    }
    return to_sequence(sMountain);
}

function expand_medium_magma(seq: Expr, index: number) {
    const mountain = draw_mountain(from_sequence(seq));
    const child = mountain[mountain.length - 1];
    let BR = child[0].left_down!;
    const width = mountain.length - 1 - BR.x;
    let top = mountain[BR.x];
    top = top.slice(
        top.findIndex((entry) => entry === BR),
        top.length - 1,
    );
    top.unshift(child[0]);
    const s = seq.slice();
    s[s.length - 1]--;
    const newMountain = draw_mountain(from_sequence(s));
    BR = newMountain[BR.x].find((entry) => same_row(entry, BR))!;
    const magma_entries: Entry[][] = [];
    for (let BR1 = BR; true; BR1 = BR1.right_down!) {
        collect_usual(BR1).forEach((entry) => {
            const dx = entry.x - BR.x;
            if (magma_entries[dx] === undefined) magma_entries[dx] = [];
            magma_entries[dx].push(entry);
        });
        if (!BR1.y.length) break;
    }
    for (let n = 1; n <= index; n++) {
        const ref = top.map((top_entry) => find_lower(newMountain[newMountain.length - 1], top_entry.y));
        for (let dx = 1; dx <= width; dx++) {
            const column: Entry[] = [];
            newMountain[BR.x + n * width + dx] = column;
            for (const magma_entry of magma_entries[dx]) {
                copy_single_edge(newMountain, magma_entry, n * width, BR.x);
                let source_entry = magma_entry;
                let target_y = find_higher_equal(ref, magma_entry.y).y;
                const target_y0 = target_y;
                while (!(source_entry.value <= 1 || magma_entries[dx].includes(source_entry.right_up!))) {
                    target_y = vertical_increase(
                        target_y,
                        dimension_difference(source_entry.y, source_entry.right_up!.y),
                    );
                    source_entry = source_entry.right_up!;
                    copy_single_edge(newMountain, source_entry, n * width, BR.x, target_y);
                }
                if (!magma_entry.y.length) continue;
                const left_leg_x = magma_entry.left_down!.x + n * width;
                y_slice(newMountain[left_leg_x], magma_entry.y, target_y0).forEach((left_leg_entry) =>
                    fill_magma_edge(newMountain, magma_entry, left_leg_entry),
                );
            }
            column.sort((entry1, entry2) => -vertical_compare(entry1.y, entry2.y));
            for (let i = 0; i < column.length - 1; i++) {
                column[i].right_down = column[i + 1];
                column[i + 1].right_up = column[i];
            }
            column[0].value = 1;
            column.slice(1, column.length - 1).forEach((entry) => {
                entry.value = entry.right_up!.value + entry.right_up!.left_down!.value;
            });
        }
    }
    return to_sequence(newMountain);
}

function expand_strong_magma(seq: Expr, index: number) {
    const mountain = draw_mountain(from_sequence(seq));
    const child = mountain[mountain.length - 1];
    let BR = child[0].left_down!;
    const width = mountain.length - 1 - BR.x;
    let top = mountain[BR.x];
    top = top.slice(
        top.findIndex((entry) => entry === BR),
        top.length - 1,
    );
    top.unshift(child[0]);
    const s = seq.slice();
    s[s.length - 1]--;
    const newMountain = draw_mountain(from_sequence(s));
    BR = newMountain[BR.x].find((entry) => same_row(entry, BR))!;
    const magma_entries: Entry[][] = [];
    for (let BR1 = BR; true; BR1 = BR1.right_down!) {
        if (BR1.y.length) {
            collect1D(BR1).forEach((entry) => {
                const dx = entry.x - BR.x;
                if (magma_entries[dx] === undefined) magma_entries[dx] = [];
                magma_entries[dx].push(entry);
            });
        } else {
            newMountain
                .slice(BR.x + 1)
                .forEach((column, dx1) => magma_entries[dx1 + 1].push(column[column.length - 1]));
            break;
        }
    }
    for (let n = 1; n <= index; n++) {
        const ref = top.map((top_entry) => find_lower(newMountain[newMountain.length - 1], top_entry.y));
        for (let dx = 1; dx <= width; dx++) {
            const column: Entry[] = [];
            newMountain[BR.x + n * width + dx] = column;
            for (const magma_entry of magma_entries[dx]) {
                copy_single_edge(newMountain, magma_entry, n * width, BR.x);
                let source_entry = magma_entry;
                let target_y = find_higher_equal(ref, magma_entry.y).y;
                const target_y0 = target_y;
                while (!(source_entry.value <= 1 || magma_entries[dx].includes(source_entry.right_up!))) {
                    target_y = vertical_increase(
                        target_y,
                        dimension_difference(source_entry.y, source_entry.right_up!.y),
                    );
                    source_entry = source_entry.right_up!;
                    copy_single_edge(newMountain, source_entry, n * width, BR.x, target_y);
                }
                if (!magma_entry.y.length) continue;
                const left_leg_x = magma_entry.left_down!.x + n * width;
                y_slice(newMountain[left_leg_x], magma_entry.y, target_y0).forEach((left_leg_entry) =>
                    fill_magma_edge(newMountain, magma_entry, left_leg_entry),
                );
            }
            column.sort((entry1, entry2) => -vertical_compare(entry1.y, entry2.y));
            for (let i = 0; i < column.length - 1; i++) {
                column[i].right_down = column[i + 1];
                column[i + 1].right_up = column[i];
            }
            column[0].value = 1;
            column.slice(1, column.length - 1).forEach((entry) => {
                entry.value = entry.right_up!.value + entry.right_up!.left_down!.value;
            });
        }
    }
    return to_sequence(newMountain);
}

interface DBMS_Entry {
    value: number;
    x: number;
    y: Vertical;
    left_up: DBMS_Entry[];
    right_up?: DBMS_Entry;
    left_down?: DBMS_Entry;
    right_down?: DBMS_Entry;
    sep?: number;
    depth?: number;
}

type DBMSType = 'DBMS' | "DBMS'" | 'ADBMS';
type DBMS_Mountain = DBMS_Entry[][];

function draw_dbms_mountain(m: Mountain, Asheep: boolean): DBMS_Mountain {
    let mountain: DBMS_Mountain = m;

    for (let col of mountain) {
        for (let j = col.length - 3; j >= 0; j--) {
            let entry = col[j];
            if (entry.y.length === 0) continue;
            entry.sep = dimension_difference(entry.y, entry.left_down!.y);
            let left_entry = entry.left_down!.right_up;
            if (Asheep && left_entry !== undefined && vertical_compare(left_entry.y, entry.y) !== 0)
                left_entry = undefined;
            entry.depth = 1 + (left_entry?.depth ?? 0);
        }
    }
    return mountain;
}

function to_dbms_display(seq: Expr, type: DBMSType): string {
    if ('' + seq === 'Infinity') return 'Limit';
    let mountain = draw_dbms_mountain(draw_mountain(from_sequence(seq)), type === 'ADBMS');

    let result = '';

    for (let col of mountain) {
        result += '(';
        for (let j = col.length - 3; j >= 0; j--) {
            let entry = col[j];
            switch (type) {
                case 'DBMS':
                    result += entry.depth + ','.repeat(entry.sep! + 1);
                    break;
                case "DBMS'":
                case 'ADBMS':
                    result += ','.repeat(entry.sep! + 1) + entry.depth;
                    break;
            }
        }
        if (type === 'DBMS') result += '0';
        result += ')';
    }

    return result;
}

function vertical_display(v: Vertical): string {
    return v.toReversed().join(',');
}

/** 行标 HTML 显示：ω 进制序数。例如 [0,0,1] → ω², [1,3,0,4] → ω³4+ω3+1。 */
function vertical_display_html(v: Vertical): string {
    if (v.length === 0) return '0';
    const parts: string[] = [];
    for (let i = v.length - 1; i >= 0; i--) {
        const c = v[i];
        if (c === 0) continue;
        if (i === 0) {
            parts.push('' + c);
        } else if (i === 1) {
            parts.push(c === 1 ? 'ω' : 'ω' + c);
        } else {
            parts.push(c === 1 ? `ω<sup>${i}</sup>` : `ω<sup>${i}</sup>${c}`);
        }
    }
    return parts.join('+');
}

interface YDiagramData {
    current_equiv: string | undefined;
    invert_vertical?: boolean;
}

function compute_y_mountain_diagram(seq: Expr, current_equiv: string | undefined): MountainDiagramData | undefined {
    if (is_infinity(seq) || seq.length === 0) return undefined;
    const mountain = draw_dbms_mountain(draw_mountain(from_sequence(seq)), current_equiv === 'ADBMS');

    const vertical_set = new DisplaySet<Vertical>(vertical_display);
    for (const col of mountain) for (const entry of col) vertical_set.add(entry.y);
    const sorted = vertical_set.values().sort(vertical_compare);
    const vertical_index = new DisplayMap<Vertical, number>(vertical_display);
    for (let i = 0; i < sorted.length; i++) vertical_index.set(sorted[i], i);

    const entries: (string | undefined)[][] = Array.from({ length: mountain.length }, () =>
        Array.from({ length: sorted.length }, () => undefined),
    );
    const left_legs: ([number, number] | undefined)[][] = Array.from({ length: mountain.length }, () =>
        Array.from({ length: sorted.length }, () => undefined),
    );

    for (let i = 0; i < mountain.length; i++) {
        for (let j = 0; j < mountain[i].length - 1; j++) {
            const entry = mountain[i][j];
            const vj = vertical_index.get(entry.y)!;
            if (current_equiv === 'DBMS') {
                entries[i][vj - 1] =
                    entry.right_up !== undefined
                        ? '' + entry.right_up.depth + ','.repeat(entry.right_up.sep! + 1)
                        : '0';
            } else if (current_equiv === 'ADBMS' || current_equiv === "DBMS'") {
                entries[i][vj - 1] = entry.sep !== undefined ? ','.repeat(entry.sep + 1) + entry.depth : '*';
            } else {
                entries[i][vj - 1] = '' + entry.value;
            }
            if (entry.left_down) {
                const pvj = vertical_index.get(entry.left_down.y)!;
                if (pvj !== 0) left_legs[i][vj - 1] = [entry.left_down.x, pvj - 1];
            }
        }
    }

    const H = 40,
        HS = 5;
    const heights: number[] = [0];
    const line_heights: number[] = [];
    for (let i = 2; i < sorted.length; i++) {
        const sep = dimension_difference(sorted[i], sorted[i - 1]);
        const d_height = H + HS * sep;
        heights.push(heights[i - 2] + d_height);
        for (let k = 0; k <= sep; k++) line_heights.push(heights[i - 2] + H / 2 + HS * k);
    }

    let vertical_names = sorted
        .slice(1)
        .map((v) => vertical_display_html(v.length === 1 ? (v[0] === 1 ? [] : [v[0] - 1]) : v));

    return { sorted_verticals: vertical_names, heights, line_heights, entries, left_legs };
}

const y_diagram_control: DiagramControl<Expr, YDiagramData> = {
    default_data: { current_equiv: undefined, invert_vertical: undefined },
    draw_diagram: (seq, data) => {
        const mountain = compute_y_mountain_diagram(seq, data.current_equiv);
        if (!mountain) return undefined;
        return draw_mountain_diagram(mountain, {
            invert_vertical: data.invert_vertical ?? false,
            display_html_vertical: true,
        });
    },
    handle_action: (data, action): YDiagramData | null => {
        if (action.type === 'scroll') {
            if (action.direction === 'down') return { ...data, invert_vertical: true };
            if (action.direction === 'up') return { ...data, invert_vertical: false };
        }
        return null;
    },
};

export const category_y_omega: NotationCategoryDefinition = {
    id: 'category-y-omega',
    name: 'ωY',
    parent_id: 'category-y',
};

function create_magma_notation(type: string, magma: (seq: Expr, index: number) => Expr): NotationDefinition<Expr> {
    return {
        id: 'omega-y-' + type,
        name: 'ω-Y (' + type + ' magma)',
        simple_name: 'ωY ' + type,
        category_id: 'category-y-omega',
        display: {
            plain: sequence_display,
            from_display: sequence_from_display,
        },
        display_equiv: {
            DBMS: (s) => to_dbms_display(s, 'DBMS'),
            DBMS_MN: (s) => to_dbms_display(s, "DBMS'"),
            ADBMS: (s) => to_dbms_display(s, 'ADBMS'),
        },
        is_limit,
        compare: seq_compare,
        draw_diagram: y_diagram_control,
        ...Y_FS_variants(magma, is_infinity, (index) => [1, index + 1], is_limit, sequence_display),
        credit_text_id: 'credit.yukito',

        init: () => [[Infinity], [1], []],
    };
}

export const omega_Y_weak: NotationDefinition<Expr> = create_magma_notation('weak', expand_weak_magma);

export const omega_Y_actual: NotationDefinition<Expr> = create_magma_notation('actual', expand_actual_magma);

export const omega_Y_medium: NotationDefinition<Expr> = create_magma_notation('medium', expand_medium_magma);

export const omega_Y_strong: NotationDefinition<Expr> = create_magma_notation('strong', expand_strong_magma);
