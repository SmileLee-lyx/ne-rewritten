import {
    compute_mountain_layout,
    type MountainLayoutOptions,
    type MountainShape,
} from '@/notations/draw_mountain_diagram.ts';

/**
 * HTML 山脉图所需的数据:与画布版共用同一份"形状 + 布局选项",但只保留纯结构,
 * 不含任何像素、也不含 invert_vertical(HTML 版固定按行标小者在上绘制)。
 */
export interface MountainViewSource<V = any> {
    shape: MountainShape<V>;
    layout: MountainLayoutOptions<V>;
    /** 行标是否按 HTML 渲染(对应画布版的 display_html_row_label)。 */
    display_html_row_label?: boolean;
    /** 格子文字是否按 HTML 渲染(对应画布版的 display_html_entry)。 */
    display_html_entry?: boolean;
}

/**
 * HTML 山脉图中的一个格子(仅非空格子会被列出)。
 *
 * 腿的几何不放这里, 而是由 build_mountain_view 汇总成 MountainView.segments(线段列表)。
 */
export interface MountainViewCell {
    /** 行下标(即 MountainView.rows 的下标)。 */
    row: number;
    /** 该格文字。 */
    text: string;
    /** 左腿落点 [列, 行];无左腿时为 undefined。 */
    leg?: [number, number];
}

/**
 * 一条腿的线段, 坐标为"格坐标":第 col 列、第 row 行的格子中心是 (col + 0.5, row + 0.5)。
 * 渲染层只需按这些坐标画直线, 无需任何角度/长度换算。
 */
export interface MountainViewSegment {
    /** 'left' = 左腿(两段折线:斜段 + 竖段), 'right' = 右腿(同列相邻两格之间的竖线)。 */
    kind: 'left' | 'right';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/** HTML 山脉图:表格渲染所需的全部信息。 */
export interface MountainView {
    /** 行标,自上而下(行标小者在上);undefined 表示该行不显示行标。 */
    rows: (string | undefined)[];
    /** 列数。 */
    cols: number;
    /** cells[col] 为该列的非空格子(按行下标升序)。 */
    cells: MountainViewCell[][];
    /** 腿的全部线段(格坐标)。 */
    segments: MountainViewSegment[];
    display_html_row_label: boolean;
    display_html_entry: boolean;
}

/**
 * 连接端偏移(以"行"为单位):线的端点自格中心向内收进这么多, 免得压住格内文字。
 * 与画布版的 connector_offset(默认 10px / 行高 40px)同量级。
 */
const CONNECTOR_OFFSET = 0.25;

/** 由记号给出的形状与布局选项算出 HTML 山脉图的结构(含腿的线段)。 */
export function build_mountain_view<V>(source: MountainViewSource<V>): MountainView {
    const data = compute_mountain_layout(source.shape, source.layout);

    const cells: MountainViewCell[][] = data.entries.map((column, col) => {
        const result: MountainViewCell[] = [];
        for (let row = 0; row < column.length; row++) {
            const text = column[row];
            if (text === undefined) continue;
            const leg = data.left_legs[col][row];
            result.push(leg === undefined ? { row, text } : { row, text, leg: [leg[0], leg[1]] });
        }
        return result;
    });

    const segments: MountainViewSegment[] = [];

    for (let col = 0; col < cells.length; col++) {
        const column = cells[col];

        // 右腿:同列相邻两个非空格子之间的一段竖线(画布版即"连到同列下方首个存在的节点")。
        // 行号小的在上方, 故自本格中心的**上方**收进一段, 到上一格中心的**下方**收进一段。
        for (let index = 1; index < column.length; index++) {
            const x = col + 0.5;
            segments.push({
                kind: 'right',
                x1: x,
                y1: column[index].row + 0.5 - CONNECTOR_OFFSET,
                x2: x,
                y2: column[index - 1].row + 0.5 + CONNECTOR_OFFSET,
            });
        }

        // 左腿:自本格中心上方(与右腿同一个连接点)斜向"父列、上一行"的中心下方, 再沿父列竖直到落点行。
        for (const cell of column) {
            if (!cell.leg) continue;
            const [pi, pvj] = cell.leg;
            const x = col + 0.5;
            const xm = pi + 0.5;
            const ym = cell.row - 0.5 + CONNECTOR_OFFSET;
            segments.push({ kind: 'left', x1: x, y1: cell.row + 0.5 - CONNECTOR_OFFSET, x2: xm, y2: ym });
            const dy = pvj + 0.5 - ym;
            if (Math.abs(dy) > CONNECTOR_OFFSET) {
                segments.push({
                    kind: 'left',
                    x1: xm,
                    y1: ym,
                    x2: xm,
                    y2: dy > 0 ? pvj + 0.5 - CONNECTOR_OFFSET : pvj + 0.5 + CONNECTOR_OFFSET,
                });
            }
        }
    }

    return {
        rows: data.sorted_verticals,
        cols: cells.length,
        cells,
        segments,
        display_html_row_label: source.display_html_row_label ?? false,
        display_html_entry: source.display_html_entry ?? false,
    };
}
