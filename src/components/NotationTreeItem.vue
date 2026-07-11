<script setup lang="ts" generic="T">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import type { TreeNode } from '@/core/tree.ts';
import { find_next, find_prev } from '@/core/tree.ts';
import type { TreeNodeExtra } from '@/core/extra.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { expand_item } from '@/core/expander.ts';
import { focus_node, focus_node_input, set_last_focus } from '@/composables/use_focus_tracker.ts';
import { use_diagram } from '@/composables/use_diagram.ts';
import { use_expand_dialog } from '@/composables/use_expand_dialog.ts';
import { use_latex } from '@/composables/use_latex.ts';
import { use_multi_select } from '@/composables/use_multi_select.ts';
import RenderLatex from '@/components/RenderLatex.vue';
import { NotationDefinition, resolve_display } from '@/notation-definition.ts';

const props = defineProps<{
    node: TreeNode<T>;
    notation: NotationDefinition<T>;
    tier?: number;
}>();

const input_ref = ref<HTMLInputElement | null>(null);
const resize_span = ref<HTMLSpanElement | null>(null);
const tooltip = ref(false);
const tooltipFS = ref<string[]>([]);
const focused = ref(false);
const { show: show_diagram, hide: hide_diagram, dispatch_action: dispatch_diagram_action } = use_diagram();
const { show: show_latex_viewer, hide: hide_latex_viewer } = use_latex();

if (!props.node.extraData) props.node.extraData = {};
const ed = props.node.extraData as TreeNodeExtra;
if (!Array.isArray(ed.analysis)) ed.analysis = [];

const saved_analysis = ref<string | undefined>(undefined);

const analysis0 = computed({
    get: () => ed.analysis![0] ?? '',
    set: (v: string) => {
        ed.analysis![0] = v;
    },
});

const settings = inject(SETTINGS_KEY)!;
const t = inject(I18N_KEY)!;
const multi = use_multi_select();
const node_path = props.node.path ?? '' + props.node.index;
const equiv_name = computed(() => settings.equiv_active[props.notation.id] ?? '');
const resolved_equiv = computed(() => {
    if (!equiv_name.value) return null;
    const spec = props.notation.display_equiv?.[equiv_name.value];
    if (!spec) return null;
    return resolve_display(spec);
});
const resolved_original = computed(() => resolve_display(props.notation.display));

const expr_display = computed(() => {
    const d = resolved_equiv.value ?? resolved_original.value;
    return settings.display_mode === 'html' ? d.html : settings.display_mode === 'latex' ? d.latex : d.plain;
});
const expr_display_original = computed(() => {
    const d = resolved_original.value;
    return settings.display_mode === 'html' ? d.html : settings.display_mode === 'latex' ? d.latex : d.plain;
});

watch(analysis0, () => {
    if (focused.value && settings.show_latex) {
        const el = input_ref.value;
        if (el) {
            const r = el.getBoundingClientRect();
            show_latex_viewer(analysis0.value, r.left, 60 + r.height);
        }
    } else {
        hide_latex_viewer();
    }
});

onMounted(() => {
    input_ref.value?.setAttribute('data-tree-path', node_path);
    const span = resize_span.value;
    let ro: ResizeObserver | undefined;
    if (span) {
        ro = new ResizeObserver(() => {
            if (document.body.contains(span)) {
                settings.input_width = span.offsetWidth;
            }
        });
        ro.observe(span);
    }
    onUnmounted(() => ro?.disconnect());
    if (ed.focus_on_mounted) {
        const el = input_ref.value;
        if (el) {
            el.focus({ preventScroll: true });
            const rect = el.getBoundingClientRect();
            const top = window.scrollY + rect.top - 60;
            window.scrollTo({ top, behavior: 'smooth' });
        }
        ed.focus_on_mounted = false;
    }
});

function on_enter() {
    if (!props.notation.is_limit(props.node.expr)) return;
    const n_max = 3;
    tooltipFS.value = [];
    for (let n = 0; n <= n_max; n++) {
        tooltipFS.value.push(`${n}: ${expr_display.value(props.notation.FS(props.node.expr, n))}`);
    }
    tooltip.value = true;
}

function on_leave() {
    tooltip.value = false;
}

function do_expand(tier?: number, focus?: boolean) {
    const v = settings.variant;
    try {
        const child = expand_item(props.node, props.notation, v, tier ?? props.tier ?? 0, settings.max_find_fs);
        if (focus && child) focus_node_input(child);
    } catch (e) {
        alert('当前节点试展开次数过多, 可能基本列实现有误');
    }
}

function on_expr_mousedown(e: MouseEvent) {
    if (e.detail > 1) e.preventDefault(); // 阻止双击全选
}

function on_expr_click(e: MouseEvent) {
    if (e.ctrlKey) {
        e.preventDefault();
        multi.toggle(node_path, (resolved_equiv.value ?? resolved_original.value).plain(props.node.expr));
        return;
    }
    if (window.getSelection()?.toString()) return;
    do_expand(undefined, false);
}

function on_keydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.altKey) {
        if (!(e.ctrlKey && ['c', 'v', 'a', 'x', 'z'].includes(e.key.toLowerCase()))) {
            e.preventDefault();
        }
    }

    if (e.key === 'ArrowUp' && !e.ctrlKey) {
        e.preventDefault();
        const skip = e.shiftKey ? 1 : 0;
        const target = e.altKey ? find_prev_analysis(props.node, skip) : find_prev(props.node, skip);
        if (target) focus_node(target.path ?? '' + target.index);
    } else if (e.key === 'ArrowDown' && !e.ctrlKey) {
        e.preventDefault();
        const skip = e.shiftKey ? 1 : 0;
        const target = e.altKey ? find_next_analysis(props.node, skip) : find_next(props.node, skip);
        if (target) focus_node(target.path ?? '' + target.index);
    } else if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({
            type: 'scroll',
            direction: 'up',
            step: 1,
        });
    } else if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({
            type: 'scroll',
            direction: 'down',
            step: 1,
        });
    } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({
            type: 'scroll',
            direction: 'left',
            step: 1,
        });
    } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({
            type: 'scroll',
            direction: 'right',
            step: 1,
        });
    } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        do_expand(0, true);
    } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        do_expand(1, true);
    } else if (e.key.toLowerCase() === 'e' && e.ctrlKey) {
        e.preventDefault();
        const ed_expand = use_expand_dialog();
        ed_expand.open(ed.analysis![0] ?? '', settings.expand);
    } else if (e.key.toLowerCase() === 'd' && e.ctrlKey) {
        e.preventDefault();
        console.log('DEBUG expr:', props.node.expr);
        (window as any).expr = props.node.expr;
        (window as any).notation = props.notation;
    } else if (e.key.toLowerCase() === 'h' && e.ctrlKey) {
        e.preventDefault();
        ed.hide_child = !ed.hide_child;
    } else if (e.key.toLowerCase() === 'z' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (saved_analysis.value !== undefined) {
            e.preventDefault();
            ed.analysis![0] = saved_analysis.value;
            saved_analysis.value = undefined;
        }
    } else if (e.key === 'Delete' && settings.use_delete_to_clear) {
        e.preventDefault();
        if (ed.analysis?.[0] !== undefined) saved_analysis.value = ed.analysis[0];
        ed.analysis![0] = undefined as unknown as string;
    }
}

function has_analysis(node: TreeNode<T>): boolean {
    const ed = node.extraData as TreeNodeExtra | undefined;
    return ed?.analysis?.[0] !== undefined;
}

function find_prev_analysis(node: TreeNode<T>, skip: number): TreeNode<T> | undefined {
    let cur = find_prev(node, skip);
    while (cur && !has_analysis(cur)) {
        cur = find_prev(cur, skip);
    }
    return cur;
}

function find_next_analysis(node: TreeNode<T>, skip: number): TreeNode<T> | undefined {
    let cur = find_next(node, skip);
    while (cur && !has_analysis(cur)) {
        cur = find_next(cur, skip);
    }
    return cur;
}

function caret_pixel_pos(input: HTMLInputElement, pos: number): number {
    const div = document.createElement('div');
    const s = getComputedStyle(input);
    div.style.font = s.font;
    div.style.padding = s.padding;
    div.style.border = s.border;
    div.style.letterSpacing = s.letterSpacing;
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre';
    div.textContent = input.value.slice(0, pos);
    const span = document.createElement('span');
    span.textContent = '|';
    div.appendChild(span);
    document.body.appendChild(div);
    const left = span.offsetLeft;
    document.body.removeChild(div);
    return left;
}

function on_focus(e: FocusEvent) {
    focused.value = true;
    set_last_focus(node_path);

    const el = e.target as HTMLInputElement;
    const r = el.getBoundingClientRect();
    const target_scroll = r.top + window.scrollY - 60;
    window.scrollTo({ top: target_scroll, behavior: 'smooth' });

    el.selectionStart = el.selectionEnd;
    const pixel_pos = caret_pixel_pos(el, el.selectionStart ?? 0);
    el.scrollLeft = pixel_pos - el.clientWidth / 2;

    const dc = props.notation.draw_diagram;
    if (dc && settings.show_diagram) {
        show_diagram(dc, props.node.expr, r.left, 60 + r.height, settings.equiv_active[props.notation.id] ?? undefined);
    } else {
        hide_diagram();
    }

    // trigger LaTeX for current value on focus (watcher fires on subsequent changes)
    if (focused.value && settings.show_latex) {
        show_latex_viewer(analysis0.value, r.left, 60 + r.height);
    } else {
        hide_latex_viewer();
    }
}

function on_blur() {
    focused.value = false;
    hide_diagram();
    hide_latex_viewer();
}
</script>

<template>
    <li class="tree-item">
        <div
            class="shown-item"
            :class="{
                analyzed: has_analysis(node),
                selected: multi.is_selected(node_path),
            }"
            @mousedown="on_expr_mousedown"
            @click="on_expr_click"
            @dblclick.prevent
            @mouseenter="on_enter"
            @mouseleave="on_leave"
        >
            <span
                v-if="node.children.length > 0"
                class="fold-icon"
                @mousedown.stop
                @click.stop="ed.hide_child = !ed.hide_child"
                >{{ ed.hide_child ? '▶' : '▼' }}</span
            >
            <span v-else class="fold-icon fold-icon--spacer"></span>
            <span
                ref="resize_span"
                class="input-resize"
                :style="{ width: settings.input_width + 'px' }"
                :class="{ 'input-hidden': !settings.show_input }"
                @mousedown.stop
            >
                <input
                    ref="input_ref"
                    type="text"
                    spellcheck="false"
                    v-model="analysis0"
                    @keydown="on_keydown"
                    @mousedown.stop
                    @focus="on_focus"
                    @blur="on_blur"
                />
            </span>
            <span v-if="equiv_name" class="expr-display equiv">
                <RenderLatex v-if="settings.display_mode === 'latex'" :latex="expr_display(node.expr)" />
                <span v-else v-html="expr_display(node.expr)" />
            </span>
            <span
                v-if="!equiv_name || !(settings.equiv_hide_original[props.notation.id] ?? true)"
                class="expr-display"
                :class="{ shifted: !!equiv_name }"
            >
                <RenderLatex v-if="settings.display_mode === 'latex'" :latex="expr_display_original(node.expr)" />
                <span v-else v-html="expr_display_original(node.expr)" />
            </span>
            <div v-if="tooltip" class="tooltip" @mousedown.stop>
                <RenderLatex v-if="settings.display_mode === 'latex'" :latex="expr_display(node.expr)" />
                <span v-else v-html="expr_display(node.expr)" />{{ t('notation-tree.fundamental-sequence') }}
                <div v-for="term in tooltipFS" :key="term">
                    <RenderLatex v-if="settings.display_mode === 'latex'" :latex="term" />
                    <span v-else v-html="term" />
                </div>
            </div>
        </div>
        <ul v-if="node.children.length > 0 && !ed.hide_child" class="nowrap tree-children">
            <NotationTreeItem
                v-for="child in node.children"
                :key="child.path ?? child.index"
                :node="child"
                :notation="notation"
                :tier="tier"
            />
        </ul>
    </li>
</template>
