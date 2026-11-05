import { afterEach, describe, expect, it } from 'vitest';
import { computed, reactive } from 'vue';
import { create_t } from '@/composables/use_i18n.ts';
import { cached_display } from '@/core/display_cache.ts';
import { resolve_display, resolve_name } from '@/notation-definition.ts';
import { series11242, IPD, SRD, e0MN } from '@/notations/11242/index.ts';
import { category_11242 } from '@/notations/11242/categories.ts';
import { seriesMessages, setSeriesLanguageSource, type SeriesLanguage } from '@/notations/11242/i18n.ts';

afterEach(() => setSeriesLanguageSource(() => 'zh'));

describe('11242 bilingual interface', () => {
    it('resolves every catalog entry, category, description and view name in both languages', () => {
        for (const lang of ['zh', 'en'] as const) {
            const t = create_t(lang);
            for (const [key, value] of Object.entries(seriesMessages)) {
                expect(t(`11242.${key}`)).toBe(value[lang]);
                expect(value[lang]).not.toBe('');
                expect([...value.zh.matchAll(/\{\{\w+\}\}/g)].map((m) => m[0]).sort()).toEqual(
                    [...value.en.matchAll(/\{\{\w+\}\}/g)].map((m) => m[0]).sort(),
                );
            }
            expect(resolve_name(category_11242.name, t)).toBe(lang === 'en' ? '11242 family' : '11242系列');
            for (const notation of series11242) {
                const descriptions = Array.isArray(notation.description)
                    ? notation.description
                    : [notation.description];
                for (const description of descriptions) {
                    const text = resolve_name(description, t)!;
                    expect(text).not.toContain('11242.description.');
                    // Usernames remain exactly as attributed in both languages.
                    if (lang === 'en') expect(text.replace(/@[^\s]+/g, '')).not.toMatch(/\p{Script=Han}/u);
                }
                const views = [notation.display, ...Object.values(notation.display_equiv!)];
                const names = views.map((view) => resolve_name(resolve_display(view).name, t));
                expect(new Set(names).size).toBe(names.length);
                if (lang === 'en') expect(names.join(' ')).not.toMatch(/\p{Script=Han}/u);
            }
        }
    });

    it('changes IPD tree legends and accessible labels on already parsed expressions', () => {
        let lang: SeriesLanguage = 'zh';
        setSeriesLanguageSource(() => lang);
        const view = resolve_display(IPD.display_equiv!['树形图']);
        const expr = '[][0:1/.][1:1/^][2:1/^(.)]';
        expect(view.html(expr)).toContain('紫框');
        lang = 'en';
        const english = view.html(expr);
        expect(english).toContain('purple frames');
        expect(english).toContain('Column 2 (zero-based)');
        expect(english).not.toMatch(/\p{Script=Han}/u);
        lang = 'zh';
        expect(view.html(expr)).toContain('紫框');
    });

    it('keeps mathematics and stored view IDs unchanged when switching languages', () => {
        for (const notation of series11242) {
            const display = resolve_display(notation.display);
            const expr = notation.FS(notation.init()[0], 3);
            const counts = resolve_display(notation.display_equiv!['计数序列']);
            setSeriesLanguageSource(() => 'zh');
            const before = [display.plain(expr), display.plain(notation.FS(expr, 2)), counts.plain(expr)];
            const ids = Object.keys(notation.display_equiv!);
            setSeriesLanguageSource(() => 'en');
            expect([display.plain(expr), display.plain(notation.FS(expr, 2)), counts.plain(expr)]).toEqual(before);
            expect(Object.keys(notation.display_equiv!)).toEqual(ids);
        }
    });

    it('uses the active language for parse errors and drawing limits', () => {
        setSeriesLanguageSource(() => 'en');
        expect(() => resolve_display(SRD.display).from_display!('bad')).toThrow('Enter a parent list');
        expect(() => resolve_display(IPD.display).from_display!('[][9:0/0]')).toThrow('parent column');
        expect(() => resolve_display(e0MN.display).from_display!('()(1:!)')).toThrow('positive integer or ω');
        const matrix = resolve_display(SRD.display_equiv!['三角矩阵']);
        expect(matrix.html(Array.from({ length: 257 }, () => []))).toContain('drawing budget');
        setSeriesLanguageSource(() => 'zh');
        expect(() => resolve_display(SRD.display).from_display!('bad')).toThrow('请输入父项列表');
    });

    it('updates cached diagram text on language switches without losing the expression', () => {
        const settings = reactive({ language: 'zh' as SeriesLanguage });
        setSeriesLanguageSource(() => settings.language);
        const view = resolve_display(IPD.display_equiv!['树形图']);
        const expr = '[][0:1/.]';
        let renders = 0;
        const displayed = computed(() =>
            cached_display(
                '11242-i18n-test',
                'tree',
                'html',
                expr,
                () => {
                    renders++;
                    return view.html(expr);
                },
                settings.language,
            ),
        );
        expect(displayed.value).toContain('紫框');
        settings.language = 'en';
        expect(displayed.value).toContain('purple frames');
        settings.language = 'zh';
        expect(displayed.value).toContain('紫框');
        expect(renders).toBe(2);
    });
});
