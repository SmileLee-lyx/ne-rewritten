import { describe, expect, it } from 'vitest';
import { resolve_display, resolve_name } from '@/notation-definition.ts';
import { series11242, IPD, SRD } from '@/notations/11242/index.ts';
import { category_11242 } from '@/notations/11242/categories.ts';
import { seriesName } from '@/notations/11242/text.ts';

describe('11242 standalone display integration', () => {
    it('resolves catalog text without an application translation dictionary', () => {
        expect(resolve_name(category_11242.name)).toContain('11242系列');
        expect(resolve_name(category_11242.name)).toContain('11242 family');
        for (const notation of series11242) {
            const descriptions = Array.isArray(notation.description) ? notation.description : [notation.description];
            for (const description of descriptions) {
                expect(typeof description).toBe('string');
                expect(resolve_name(description)).not.toContain('11242.description.');
            }
        }
    });

    it('uses the same stable label in raw-key selectors and display-name selectors', () => {
        for (const notation of series11242) {
            for (const [id, view] of Object.entries(notation.display_equiv!)) {
                expect(resolve_name(resolve_display(view).name)).toBe(id);
            }
            expect(notation.display_equiv![seriesName('view.count')]).toBeDefined();
        }
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
