<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { Diagram } from '@/core/diagram_types.ts';
import { css } from '@/core/diagram_utils.ts';

const props = defineProps<{ diagram: Diagram }>();
const canvas = ref<HTMLCanvasElement>();

function draw() {
    const cvs = canvas.value;
    if (!cvs) return;
    const d = props.diagram;
    if (d.width === 0 && d.height === 0) return;
    cvs.width = d.width;
    cvs.height = d.height;
    const ctx = cvs.getContext('2d')!;
    ctx.clearRect(0, 0, d.width, d.height);

    for (const el of d.elements) {
        if (el.type === 'line') {
            ctx.beginPath();
            ctx.moveTo(el.x1, el.y1);
            ctx.lineTo(el.x2, el.y2);
            if (el.stroke && el.stroke_color) ctx.strokeStyle = css(el.stroke_color);
            if (el.width) ctx.lineWidth = el.width;
            ctx.stroke();
        } else if (el.type === 'circle') {
            ctx.beginPath();
            ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2);
            if (el.fill && el.fill_color) {
                ctx.fillStyle = css(el.fill_color);
                ctx.fill();
            }
            if (el.stroke && el.stroke_color) {
                ctx.strokeStyle = css(el.stroke_color);
                ctx.lineWidth = el.width ?? 1;
                ctx.stroke();
            }
        } else if (el.type === 'text') {
            ctx.fillStyle = el.fill_color ? css(el.fill_color) : '#000';
            ctx.font = (el.size ?? 14) + 'px monospace';
            ctx.textAlign = el.align ?? 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.text, el.x, el.y);
        }
    }
}

watch(() => props.diagram, draw, { deep: true });
onMounted(draw);

function extra_style(t: Diagram['extra_text'][number]) {
    const style: Record<string, string> = {
        position: 'absolute' as const,
        left: t.x + 'px',
        top: t.y + 'px',
        fontSize: (t.size ?? 12) + 'px',
        color: t.color ? css(t.color) : '#000',
        fontFamily: 'inherit',
        lineHeight: '1',
        whiteSpace: 'pre' as const,
        pointerEvents: 'none' as const,
    };
    if (t.align === 'left') {
        style.transform = 'translate(0,-0.3em)';
    } else if (t.align === 'center') {
        style.transform = 'translate(-50%,-0.3em)';
        style.textAlign = 'center';
    } else if (t.align === 'right') {
        style.transform = 'translate(-100%,-0.3em)';
        style.textAlign = 'right';
    }
    return style;
}
</script>

<template>
    <div class="diagram-wrapper" :style="{ position: 'relative', display: 'inline-block' }">
        <canvas ref="canvas" class="diagram-canvas" />
        <template v-for="(t, i) in diagram.extra_text" :key="i">
            <span v-if="t.display_html" :style="extra_style(t)" v-html="t.text"></span>
            <span v-else :style="extra_style(t)">{{ t.text }}</span>
        </template>
    </div>
</template>

<style scoped>
.diagram-canvas {
    display: block;
    margin: 4px 0;
}
</style>
