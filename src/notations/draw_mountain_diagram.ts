import type { ColorSpec, Diagram } from '@/core/diagram_types.ts';
import { DisplayMap, DisplaySet } from '@/utils.ts';

/**
 * 山脉图中的一个节点。
 *
 * 节点出现在 shape 中即表示该格有节点;不在 shape 中的格子留空。
 */
export interface MountainNode<V> {
    /** 该节点所在的行高向量(记号自己的载体类型)。 */
    vertical: V;
    /** 该格显示的文字。 */
    text: string;
    /** 左腿折线的落点,写作 shape[i][j] 的下标;省略或越界表示无左腿。 */
    leg_target?: [number, number];
}

/** 山脉形状:shape[i] 为第 i 列的节点;列序即显示顺序(左→右),列内顺序任意。 */
export type MountainShape<V> = MountainNode<V>[][];

/** 绘制选项:只影响几何呈现,与布局无关。 */
export interface MountainDiagramOptions {
    /** 列宽（默认 30）。 */
    column_width?: number;
    /** 左侧行标列的宽度（默认 50）。 */
    row_label_width?: number;
    /** 连线两端的偏移（默认 10），使线与节点文字之间留出空隙。 */
    connector_offset?: number;
    /** 图上下的留白（默认 10）。 */
    outer_padding?: number;
    /** 字号（默认 14）。 */
    font_size?: number;
    /** 是否上下翻转。 */
    invert_vertical?: boolean;
    /** 行标是否按 HTML 显示。 */
    display_html_row_label?: boolean;
    /** 节点文字是否按 HTML 显示。 */
    display_html_entry?: boolean;
}

/**
 * 布局选项:调用方把记号自己的行高语义翻译成布局量。
 *
 * 行的排序、行标、像素行高与网格线、节点落位、左右腿的连接全部由本模块完成,
 * 调用方不必知道行下标(vj)、显示容器或任何像素计算。
 */
export interface MountainLayoutOptions<V> {
    /** 行高向量 → 显示字符串;同时作为值语义去重键,并作为 row_label 的默认值。 */
    vertical_display: (v: V) => string;
    /** 行高向量的次序,决定行的上下关系。 */
    vertical_compare: (a: V, b: V) => number;
    /** 相邻两行之间的分割线数量(纯布局量,0 表示两行紧邻且无分割线)。 */
    separator_count: (higher: V, lower: V) => number;
    /** 行标文字;返回 undefined 表示该行不显示标号。默认为 vertical_display。 */
    row_label?: (v: V, index: number) => string | undefined;
    /** 额外强制纳入排序、但没有节点落在其上的行高向量。 */
    extra_verticals?: V[];
    /** 单行基准高度(默认 40)。 */
    row_height?: number;
    /** 每条额外分割线的高度增量(默认 5)。 */
    row_gap?: number;
}

/** 布局结果:稠密的格子数据,行下标 vj 即排序后的行号。 */
interface MountainLayoutData {
    /** 各行标号(仅用于左侧显示文本),undefined 表示不显示该行标号。 */
    sorted_verticals: (string | undefined)[];
    /** 各水平网格线距最底行的像素距离。 */
    line_heights: number[];
    /** 各行距最底行的像素距离(heights[0] = 0)。 */
    heights: number[];
    /** [列][vj] → 节点显示文字,undefined 表示该格无节点。 */
    entries: (string | undefined)[][];
    /** [列][vj] → 左腿指向 (pi, pvj),undefined 表示无左腿。 */
    left_legs: ([number, number] | undefined)[][];
}

const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_ROW_GAP = 5;

/** 由形状与布局选项算出稠密格子数据。 */
function compute_mountain_layout<V>(shape: MountainShape<V>, layout: MountainLayoutOptions<V>): MountainLayoutData {
    const { vertical_display, vertical_compare, separator_count, row_label } = layout;
    const row_height = layout.row_height ?? DEFAULT_ROW_HEIGHT;
    const row_gap = layout.row_gap ?? DEFAULT_ROW_GAP;

    // 收集全部行高向量并按记号给定的次序排序,行下标即排序结果的下标。
    const vertical_set = new DisplaySet<V>(vertical_display);
    for (const v of layout.extra_verticals ?? []) vertical_set.add(v);
    for (const column of shape) for (const node of column) vertical_set.add(node.vertical);
    const sorted = vertical_set.values().sort(vertical_compare);

    const row_index = new DisplayMap<V, number>(vertical_display);
    for (let k = 0; k < sorted.length; k++) row_index.set(sorted[k], k);

    // 行标与像素行高。相邻两行之间画 separator_count 条分割线:
    // 第一条分割线由 row_height 自带,其余每条再撑开 row_gap,
    // 故两行中心相距 row_height + row_gap * (分割线数 - 1)。
    const sorted_verticals: (string | undefined)[] = sorted.map((v, k) =>
        row_label ? row_label(v, k) : vertical_display(v),
    );
    const heights: number[] = [0];
    const line_heights: number[] = [];
    for (let k = 1; k < sorted.length; k++) {
        const separators = separator_count(sorted[k], sorted[k - 1]);
        heights.push(heights[k - 1] + row_height + row_gap * Math.max(separators - 1, 0));
        for (let j = 0; j < separators; j++) line_heights.push(heights[k - 1] + row_height / 2 + row_gap * j);
    }

    // 节点落位与左腿。同一列内两个节点不允许落在同一行。
    const entries: (string | undefined)[][] = shape.map(() =>
        new Array<string | undefined>(sorted.length).fill(undefined),
    );
    const left_legs: ([number, number] | undefined)[][] = shape.map(() =>
        new Array<[number, number] | undefined>(sorted.length).fill(undefined),
    );

    for (let i = 0; i < shape.length; i++) {
        for (const node of shape[i]) {
            const vj = row_index.get(node.vertical);
            if (vj === undefined) continue;
            if (entries[i][vj] !== undefined) throw new Error(`Duplicate row in column ${i}: row ${vj}`);
            entries[i][vj] = node.text;
        }
    }

    for (let i = 0; i < shape.length; i++) {
        for (const node of shape[i]) {
            const target = node.leg_target;
            if (target === undefined) continue;
            const target_node = shape[target[0]]?.[target[1]];
            if (target_node === undefined) continue; // 落点越界 = 无左腿
            const vj = row_index.get(node.vertical);
            const pvj = row_index.get(target_node.vertical);
            if (vj === undefined || pvj === undefined) continue;
            left_legs[i][vj] = [target[0], pvj];
        }
    }

    return { sorted_verticals, heights, line_heights, entries, left_legs };
}

/**
 * 绘制山脉图。
 *
 * 调用方只需描述每列有哪些节点、每格的文字、腿的落点,以及行高向量的显示/次序/分割线数量;
 * 其余(行标、像素行高与网格线、节点摆位、右腿与左腿折线)全部由本函数完成。
 */
export function draw_mountain_diagram<V>(
    shape: MountainShape<V>,
    layout: MountainLayoutOptions<V>,
    draw?: MountainDiagramOptions,
): Diagram | undefined {
    const {
        column_width = 30,
        row_label_width = 50,
        connector_offset = 10,
        outer_padding = 10,
        font_size = 14,
        invert_vertical = false,
        display_html_row_label = false,
        display_html_entry = false,
    } = draw ?? {};

    const { sorted_verticals, heights, line_heights, entries, left_legs } = compute_mountain_layout(shape, layout);
    const cols = entries.length;
    if (cols === 0) return undefined;

    const height_last = heights[heights.length - 1] + outer_padding;
    const total_height = height_last + outer_padding;
    const width = row_label_width + cols * column_width;
    const calc_cy = (vj: number) => (invert_vertical ? outer_padding + heights[vj] : height_last - heights[vj]);
    const h_off_vec = invert_vertical ? -connector_offset : connector_offset;

    const elements: Diagram['elements'] = [];
    const lines: Diagram['elements'] = [];
    const extra_text: Diagram['extra_text'] = [];
    const black: ColorSpec = { type: 'text' };
    const gray: ColorSpec = { type: 'gray' };

    // 水平网格线
    for (const h of line_heights) {
        const y = invert_vertical ? h + outer_padding : height_last - h;
        lines.push({
            type: 'line',
            x1: 0,
            y1: y,
            x2: width,
            y2: y,
            stroke: true,
            stroke_color: gray,
            width: 1,
        });
    }

    // 行标(左侧)
    for (let vj = 0; vj < sorted_verticals.length; vj++) {
        const label = sorted_verticals[vj];
        if (label === undefined) continue;
        extra_text.push({
            text: label,
            x: row_label_width / 2,
            y: calc_cy(vj),
            size: font_size,
            color: black,
            align: 'center',
            ...(display_html_row_label ? { display_html: true } : {}),
        });
    }

    // 节点及连线
    for (let i = 0; i < cols; i++) {
        for (let vj = 0; vj < sorted_verticals.length; vj++) {
            const text = entries[i][vj];
            if (text === undefined) continue;

            const cx = row_label_width + column_width * i + column_width / 2;
            const cy = calc_cy(vj);

            // 右腿:连接到同列下方首个存在的节点
            if (vj > 0) {
                let kv = vj - 1;
                while (kv > 0 && entries[i][kv] === undefined) kv--;
                if (entries[i][kv] !== undefined) {
                    const cy_below = calc_cy(kv);
                    lines.push({
                        type: 'line',
                        x1: cx,
                        y1: cy + h_off_vec,
                        x2: cx,
                        y2: cy_below - h_off_vec,
                        stroke: true,
                        stroke_color: black,
                        width: 1,
                    });
                }
            }

            // 左腿折线
            const leg = left_legs[i][vj];
            if (leg !== undefined && vj > 0) {
                const [pi, pvj] = leg;
                const p_cx = row_label_width + column_width * pi + column_width / 2;
                const cy_mid = calc_cy(vj - 1);
                const cy_target = calc_cy(pvj);

                // segment 1: (i, vj) → (pi, vj-1)
                lines.push({
                    type: 'line',
                    x1: cx,
                    y1: cy + h_off_vec,
                    x2: p_cx,
                    y2: cy_mid - h_off_vec,
                    stroke: true,
                    stroke_color: black,
                    width: 1,
                });
                // segment 2: (pi, vj-1) → (pi, pvj)
                lines.push({
                    type: 'line',
                    x1: p_cx,
                    y1: cy_mid - h_off_vec,
                    x2: p_cx,
                    y2: cy_target - h_off_vec,
                    stroke: true,
                    stroke_color: black,
                    width: 1,
                });
            }

            // 节点值
            extra_text.push({
                text,
                x: cx,
                y: cy,
                size: font_size,
                color: black,
                align: 'center',
                ...(display_html_entry ? { display_html: true } : {}),
            });
        }
    }

    elements.unshift(...lines);
    return { width, height: total_height, elements, extra_text };
}
