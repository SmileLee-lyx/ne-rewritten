import { computed, reactive } from 'vue';
import { lex_compare, number_compare } from '@/utils.ts';

interface SelectionEntry {
    path: string;
    text: string;
}

const state = reactive({
    entries: [] as SelectionEntry[],
});

export function use_multi_select() {
    function toggle(path: string, text: string) {
        const idx = state.entries.findIndex((e) => e.path === path);
        if (idx !== -1) {
            state.entries.splice(idx, 1);
        } else {
            state.entries.push({ path, text });
        }
    }

    function is_selected(path: string): boolean {
        return state.entries.some((e) => e.path === path);
    }

    function clear() {
        state.entries.splice(0);
    }

    const count = computed(() => state.entries.length);
    const sorted = computed(() =>
        [...state.entries].sort((a, b) => {
            const pa = a.path.split(',').map(Number);
            const pb = b.path.split(',').map(Number);
            return lex_compare(pa, pb, number_compare);
        }),
    );
    const export_text = computed(() => sorted.value.map((e) => e.text).join('\n'));

    return { toggle, is_selected, clear, count, export_text, entries: state.entries as readonly SelectionEntry[] };
}
