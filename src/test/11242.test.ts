import { describe, it, expect } from 'vitest';
import { resolve_display, resolve_name } from '@/notation-definition.ts';
import { create_t } from '@/composables/use_i18n.ts';
import { series11242, ARD, ARD2, RPD, SRD, e0MN, strongE0MN } from '@/notations/11242/index.ts';
import { category_11242, category_11242_ta0 } from '@/notations/11242/categories.ts';
import { createE0Core } from '@/notations/11242/e0-core.js';
import { triangleHtml } from '@/notations/11242/views.ts';
import { e0MN as originalE0 } from '@/notations/MN/e0MN.ts';
import { strong_e0MN as originalStrong } from '@/notations/MN/strong_e0MN.ts';
import fixtures from './fixtures/11242.json';

describe('11242 reference implementation parity', () => {
    for (const example of fixtures.cases) {
        const notation = series11242.find((n) => n.name === example.name)!;
        const display = resolve_display(notation.display);
        it(`${example.name}: ${example.input.slice(0, 100)}`, async () => {
            const input = display.from_display!(example.input);
            for (let n = 0; n < example.successors.length; n++) {
                if (example.successors[n] !== null) {
                    const actual = notation.FS(input, n),
                        expected = display.from_display!(example.successors[n]!);
                    expect(display.plain(actual)).toEqual(display.plain(expected));
                    if (notation.compare(input, notation.init().at(-1)) > 0)
                        expect(notation.compare(actual, input)).toBeLessThan(0);
                }
                if (example.short[n] !== null && notation.FS_short && !example.name.includes('e0MN')) {
                    expect(display.plain(notation.FS_short(input, n))).toEqual(
                        display.plain(display.from_display!(example.short[n]!)),
                    );
                }
            }
            if (example.counts) {
                const displayed = resolve_display(notation.display_equiv!['计数序列']).plain(input);
                const expected = example.counts.split(',');
                expect(displayed.split(',')).toHaveLength(expected.length);
                displayed.split(',').forEach((value, j) => {
                    if (value !== '?') expect(value).toBe(expected[j]);
                });
                if (displayed.includes('?') && notation.debug?.counts)
                    expect(notation.debug.counts(input, 5_000_000, 3000).join(',')).toBe(example.counts);
            }
            await Promise.resolve();
        });
    }
});

describe('11242 views and integration', () => {
    it('has one root category and a separate ta0 branch', () => {
        expect(category_11242.parent_id).toBeUndefined();
        expect(category_11242_ta0.parent_id).toBe(category_11242.id);
        expect(new Set(series11242.map((n) => n.id)).size).toBe(7);
        expect(series11242.filter((n) => n.category_id === category_11242.id)).toHaveLength(5);
    });
    for (const notation of series11242) {
        it(`${notation.name}: unique views, parse roundtrip, and complete figures`, () => {
            const display = resolve_display(notation.display);
            const expr = notation.FS(notation.FS(notation.init()[0], 3), 3);
            expect(notation.compare(display.from_display!(display.plain(expr)), expr)).toBe(0);
            const names = [
                display.name,
                ...Object.values(notation.display_equiv!).map((v) => resolve_display(v).name),
            ].map((name) => resolve_name(name, create_t('zh')));
            expect(new Set(names).size).toBe(names.length);
            for (const view of Object.values(notation.display_equiv!)) {
                const v = resolve_display(view);
                expect(v.plain(expr)).not.toContain('NaN');
                expect(v.html(expr)).not.toMatch(/undefined|NaN|快计数版|v0\./);
                if (v.from_display) expect(notation.compare(v.from_display(v.plain(expr)), expr)).toBe(0);
            }
        });
    }
    it('keeps completed count columns when the budget is exhausted', () => {
        for (const notation of [ARD, ARD2, RPD]) {
            const expr = notation.FS(notation.FS(null, 4), 3)!;
            const values = notation.debug!.counts(expr, 0);
            expect(values.length).toBe(expr.length);
            expect(values[0]).toBe(1n);
            expect(values).toContain(null);
        }
        for (const strong of [false, true]) {
            const core = createE0Core(strong),
                input = core.parse('()(1:1)(2:2)');
            expect(core.counts(input, { maxWork: 0 })).toBe('1,?,?');
        }
    });
    it('draws only the upper triangle with column numbers on the diagonal', () => {
        const html = triangleHtml({
            columns: 4,
            counts: '1,1,2,4',
            layers: ['0'],
            edges: [{ source: 3, parent: 1, layer: '0', value: '0' }],
        });
        expect(html.match(/<rect /g)).toHaveLength(10);
        expect(html).toContain('1,1,2,4');
        expect(html).not.toContain('k=');
        expect(html).toContain('>0</text>');
    });
    it('preserves default e0MN expansion in the upstream MN–ta0 entries', () => {
        for (const [local, original] of [
            [e0MN, originalE0],
            [strongE0MN, originalStrong],
        ] as const) {
            const localView = resolve_display(local.display),
                originalView = resolve_display(original.display);
            for (const example of fixtures.cases.filter((c) => c.name === local.name)) {
                if (/limit/i.test(example.input)) continue;
                const a = localView.from_display!(example.input),
                    b = originalView.from_display!(example.input);
                for (let n = 0; n < 4; n++) {
                    expect(localView.plain(local.FS(a, n))).toEqual(originalView.plain(original.FS(b, n)));
                    expect(localView.plain(local.FS_short!(a, n))).toEqual(
                        originalView.plain(original.FS_short!(b, n)),
                    );
                    expect(localView.plain(local.FS_alter!(a, n))).toEqual(
                        originalView.plain(original.FS_alter!(b, n)),
                    );
                }
            }
        }
    });
});
