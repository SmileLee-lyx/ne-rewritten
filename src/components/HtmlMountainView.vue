<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MountainView, MountainViewCell } from '@/notations/mountain_view.ts';

const props = defineProps<{ view: MountainView }>();

/** 单行最小高度(仅样式;列宽交给浏览器按内容排版, 故不再有固定列宽)。 */
const ROW_H_EM = 2.3;
const table_style = { '--row-h': ROW_H_EM + 'em' };

/** 行 × 列的稠密查表:表格样式,空格子留空。 */
const grid = computed<(MountainViewCell | undefined)[][]>(() => {
    const rows: (MountainViewCell | undefined)[][] = props.view.rows.map(() =>
        new Array<MountainViewCell | undefined>(props.view.cols).fill(undefined),
    );
    props.view.cells.forEach((cells, col) => {
        for (const cell of cells) rows[cell.row][col] = cell;
    });
    return rows;
});

const col_indexes = computed(() => Array.from({ length: props.view.cols }, (_, i) => i));

/** 悬停提示:显示左腿落点(列/行均为 1 起)。 */
function cell_title(cell: MountainViewCell | undefined): string | undefined {
    if (!cell?.leg) return undefined;
    return `← c${cell.leg[0] + 1}, r${cell.leg[1] + 1}`;
}

// ============ 腿: 由实测的格子几何把"格坐标"换算成像素 ============

interface PixelLine {
    kind: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

const grid_ref = ref<HTMLElement>();
const lines = ref<PixelLine[]>([]);
const svg_w = ref(0);
const svg_h = ref(0);

/**
 * 读出各列中心与行距, 再把 MountainView.segments(格坐标:
 * 第 col 列第 row 行的格心为 (col + 0.5, row + 0.5))映射到像素。
 * 列宽随内容自适应, 故列心必须实测; 行高是统一的, 量一次即可。
 */
function measure() {
    const el = grid_ref.value;
    if (!el) return;
    const base = el.getBoundingClientRect();

    // 各列中心(取该列第一个格子)
    const centers_x: number[] = [];
    for (let col = 0; col < props.view.cols; col++) {
        const cell = el.querySelector<HTMLElement>(`td[data-col="${col}"]`);
        if (!cell) continue;
        const r = cell.getBoundingClientRect();
        centers_x[col] = r.left + r.width / 2 - base.left;
    }

    // 行距与首行中心(行高统一, 取行标列的第一个格子)
    const first = el.querySelector<HTMLElement>('th.mtn-row-label');
    const row_h = first ? first.getBoundingClientRect().height : 0;
    const y0 = first ? first.getBoundingClientRect().top - base.top : 0;

    const to_x = (x: number) => centers_x[Math.floor(x)] ?? 0;
    const to_y = (y: number) => {
        const row = Math.floor(y);
        return y0 + row * row_h + row_h / 2 + (y - row - 0.5) * row_h;
    };

    lines.value = props.view.segments.map((s) => ({
        kind: s.kind,
        x1: to_x(s.x1),
        y1: to_y(s.y1),
        x2: to_x(s.x2),
        y2: to_y(s.y2),
    }));
    svg_w.value = base.width;
    svg_h.value = base.height;
}

let observer: ResizeObserver | undefined;

onMounted(() => {
    measure();
    if (grid_ref.value) {
        observer = new ResizeObserver(() => measure());
        observer.observe(grid_ref.value);
    }
});

onBeforeUnmount(() => observer?.disconnect());

// 视图变化后需等 DOM 更新完再量测, 故用 flush: 'post'
watch(() => props.view, measure, { deep: true, flush: 'post' });
</script>

<template>
    <div class="mtn-scroll">
        <div ref="grid_ref" class="mtn-grid">
            <table class="mtn-table" :style="table_style">
                <tbody>
                    <!-- rows 自上而下即行标由小到大(HTML 版固定此方向, 与 invert_vertical 无关) -->
                    <tr v-for="(label, row) in view.rows" :key="row">
                        <th class="mtn-row-label" scope="row">
                            <span v-if="view.display_html_row_label" v-html="label ?? ''" />
                            <template v-else>{{ label }}</template>
                        </th>
                        <td
                            v-for="col in col_indexes"
                            :key="col"
                            class="mtn-cell"
                            :data-col="col"
                            :data-row="row"
                            :title="cell_title(grid[row][col])"
                        >
                            <span v-if="grid[row][col]" class="mtn-cell-text">
                                <span v-if="view.display_html_entry" v-html="grid[row][col]!.text" />
                                <template v-else>{{ grid[row][col]!.text }}</template>
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- 腿: 一层 SVG(像素坐标, 由 measure() 实测得出) -->
            <svg
                class="mtn-legs"
                :viewBox="`0 0 ${svg_w} ${svg_h}`"
                preserveAspectRatio="none"
                :width="svg_w"
                :height="svg_h"
                aria-hidden="true"
            >
                <line
                    v-for="(seg, i) in lines"
                    :key="i"
                    :class="'mtn-leg--' + seg.kind"
                    :x1="seg.x1"
                    :y1="seg.y1"
                    :x2="seg.x2"
                    :y2="seg.y2"
                />
            </svg>
        </div>
    </div>
</template>

<style scoped>
.mtn-scroll {
    overflow: auto;
    max-height: 100%;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-bg);
}

.mtn-grid {
    position: relative;
    width: max-content;
    font-size: 13px;
}

/*
 * Excel 风格表格: 列宽随内容自适应(不再固定), 只画右边与下边的细线。
 * 不做任何裁剪 —— HTML 版的目的就是完整显示, 长内容靠横向滚动查看。
 */
.mtn-table {
    border-collapse: separate;
    border-spacing: 0;
    font-family: Consolas, 'Courier New', monospace;
}

.mtn-row-label {
    position: sticky;
    left: 0;
    z-index: 3;
    height: var(--row-h);
    padding: 0 10px;
    text-align: right;
    color: var(--color-text);
    background: var(--color-bg-alt, var(--color-bg));
    border-right: 1px solid var(--color-border-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
    font-weight: 600;
    white-space: nowrap;
}

.mtn-cell {
    height: var(--row-h);
    min-width: 3.5em;
    padding: 0 10px;
    text-align: center;
    border-right: 1px solid var(--color-border-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
}

.mtn-cell-text {
    white-space: nowrap;
    color: var(--color-text);
}

/* 腿的覆盖层: 盖在格子上、行标列之下 */
.mtn-legs {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 2;
    pointer-events: none;
    overflow: visible;
}

.mtn-legs line {
    stroke: var(--color-text-secondary, var(--color-text-muted));
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
}
</style>
