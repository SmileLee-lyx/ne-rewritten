import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import { resolve_display, resolve_display_name, resolve_name } from '@/notation-definition.ts';
import { create_t, type Language } from '@/composables/use_i18n.ts';
import { series11242, IPD, SRD } from '@/notations/11242/index.ts';
import { category_11242 } from '@/notations/11242/categories.ts';
import { seriesName } from '@/notations/11242/text.ts';

const VIEW_LABELS: Record<string, { zh: string; en: string }> = {
    '计数序列 / Counting sequence': { zh: '计数序列', en: 'Counting sequence' },
    '邻接列表 / Adjacency list': { zh: '邻接列表', en: 'Adjacency list' },
    '三角矩阵 / Triangular matrix': { zh: '三角矩阵', en: 'Triangular matrix' },
    '弧线图 / Arc diagram': { zh: '弧线图', en: 'Arc diagram' },
    '层级列表 / Height list': { zh: '层级列表', en: 'Height list' },
    '山脉图 / Mountain diagram': { zh: '山脉图', en: 'Mountain diagram' },
    '树形图 / Tree diagram': { zh: '树形图', en: 'Tree diagram' },
    '行高差 / Row-height differences': { zh: '行高差', en: 'Row-height differences' },
};

describe('11242 localized display integration', () => {
    it('resolves catalog names and descriptions using the application language', () => {
        const zh = create_t('zh');
        const en = create_t('en');
        expect(resolve_name(category_11242.name, zh)).toBe('11242系列');
        expect(resolve_name(category_11242.name, en)).toBe('11242 family');
        expect(resolve_name(category_11242.simple_name, zh)).toBe('11242系列');
        expect(resolve_name(category_11242.simple_name, en)).toBe('11242 family');
        for (const notation of series11242) {
            expect(resolve_name(notation.name, zh)).toBe(notation.name);
            expect(resolve_name(notation.name, en)).toBe(notation.name);
            expect(resolve_display_name(notation.display, zh)).toBe('列表');
            expect(resolve_display_name(notation.display, en)).toBe('List');
            const descriptions = Array.isArray(notation.description) ? notation.description : [notation.description];
            for (const description of descriptions) {
                const chinese = resolve_name(description, zh)!;
                const english = resolve_name(description, en)!;
                expect(chinese).not.toBe(english);
                for (const text of [chinese, english]) {
                    expect(text).not.toMatch(/^11242\./);
                    expect(text).not.toContain(' / ');
                }
            }
        }
    });

    it('translates view names while preserving existing saved view identifiers', () => {
        for (const notation of series11242) {
            for (const [id, view] of Object.entries(notation.display_equiv!)) {
                expect(VIEW_LABELS[id]).toBeDefined();
                expect(resolve_display_name(view, create_t('zh'))).toBe(VIEW_LABELS[id].zh);
                expect(resolve_display_name(view, create_t('en'))).toBe(VIEW_LABELS[id].en);
            }
            expect(notation.display_equiv![seriesName('view.count')]).toBeDefined();
        }
    });

    it('updates labels on language changes without changing the selected view or rendered expression', () => {
        const language = ref<Language>('zh');
        const saved_id = '计数序列 / Counting sequence';
        const view = SRD.display_equiv![saved_id];
        const t = (id: string) => create_t(language.value)(id);
        const label = computed(() => resolve_display_name(view, t));
        const category_label = computed(() => resolve_name(category_11242.name, t));
        const rendered_html = resolve_display(view).html([[]]);
        expect(label.value).toBe('计数序列');
        expect(category_label.value).toBe('11242系列');
        language.value = 'en';
        expect(label.value).toBe('Counting sequence');
        expect(category_label.value).toBe('11242 family');
        expect(SRD.display_equiv![saved_id]).toBe(view);
        expect(resolve_display(view).html([[]])).toBe(rendered_html);
        language.value = 'zh';
        expect(label.value).toBe('计数序列');
        expect(category_label.value).toBe('11242系列');
    });

    it('renders a complete IPD tree with literal labels and no unresolved text placeholders', () => {
        const view = resolve_display(IPD.display_equiv![seriesName('view.trees')]);
        const html = view.html('[][0:1/.][1:1/^][2:1/^(.)]');
        expect(html).toContain('<svg');
        expect(html).toContain('紫框');
        expect(html).toContain('第 3 列');
        expect(html).not.toMatch(/11242\.(diagram|view)|\{\{\w+\}\}/);
    });

    it('reports a drawing budget failure instead of returning a partial matrix', () => {
        const matrix = resolve_display(SRD.display_equiv![seriesName('view.matrix')]);
        const html = matrix.html(Array.from({ length: 257 }, () => []));
        expect(html).toContain('预算');
        expect(html).not.toContain('<svg');
    });
});
