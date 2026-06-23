import type { Diagram, Rgba } from '@/core/diagram_types';

/**
 * 山脉图中间数据——计算层产出，绘制层消费。
 *
 * heights[vj] 为该行距最底行的像素距离（heights[0] = 0）。
 * line_heights[] 为各水平网格线的像素距离（同样从最底行起算）。
 */
export interface MountainDiagramData {
    /** 各行标号（仅用于左侧显示文本），vj 即为此数组下标。 */
    sorted_verticals: string[];
    /** 各水平网格线距最底行的像素距离。 */
    line_heights: number[];
    /** 各行距最底行的像素距离（heights[0] = 0）。 */
    heights: number[];
    /** [col][vj] → 节点显示文字，undefined 表示该格无节点。 */
    entries: (string | undefined)[][];
    /** [col][vj] → 左腿指向 (pi, pvj)，undefined 表示无左腿。 */
    left_legs: ([number, number] | undefined)[][];
}

export interface MountainDiagramOptions {
    /** 列宽（默认 30）。 */
    W?: number;
    /** 行标列宽（默认 50）。 */
    WV?: number;
    /** 连接端偏移（默认 10）。 */
    H_off?: number;
    /** 边缘留白（默认 10）。 */
    padding?: number;
    /** 字号（默认 14）。 */
    text_size?: number;
    /** 是否上下翻转。 */
    invert_vertical?: boolean;
}

/**
 * 根据 MountainDiagramData 绘制山脉图。
 * 负责：网格线、行标签、节点文字、右腿、左腿折线。
 */
export function draw_mountain_diagram(data: MountainDiagramData, opts?: MountainDiagramOptions): Diagram | undefined {
    const { W = 30, WV = 50, H_off = 10, padding = 10, text_size = 14, invert_vertical = false } = opts ?? {};

    const { sorted_verticals, heights, line_heights, entries, left_legs } = data;
    const cols = entries.length;
    if (cols === 0) return undefined;

    const height_last = heights[heights.length - 1] + padding;
    const total_height = height_last + padding;
    const width = WV + cols * W;
    const calc_cy = (vj: number) => (invert_vertical ? padding + heights[vj] : height_last - heights[vj]);
    const h_off_vec = invert_vertical ? -H_off : H_off;

    const elements: Diagram['elements'] = [];
    const lines: Diagram['elements'] = [];
    const extra_text: Diagram['extra_text'] = [];
    const black: Rgba = { r: 0, g: 0, b: 0 };
    const gray: Rgba = { r: 200, g: 200, b: 200 };

    // 水平网格线
    for (const h of line_heights) {
        const y = invert_vertical ? h + padding : height_last - h;
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

    // 行标（左侧）
    for (let vj = 0; vj < sorted_verticals.length; vj++) {
        extra_text.push({
            text: sorted_verticals[vj],
            x: WV / 2,
            y: calc_cy(vj),
            size: text_size,
            color: black,
            align: 'center',
        });
    }

    // 节点及连线
    for (let i = 0; i < cols; i++) {
        for (let vj = 0; vj < sorted_verticals.length; vj++) {
            const text = entries[i][vj];
            if (text === undefined) continue;

            const cx = WV + W * i + W / 2;
            const cy = calc_cy(vj);

            // 右腿：连接到同列下方首个存在的节点
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
                const p_cx = WV + W * pi + W / 2;
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
                size: text_size,
                color: black,
                align: 'center',
            });
        }
    }

    elements.unshift(...lines);
    return { width, height: total_height, elements, extra_text };
}
