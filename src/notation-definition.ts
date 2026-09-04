import type { Diagram } from '@/core/diagram_types.ts';

export type NotationDisplay<T> = (a: T) => string;

/**
 * Convert a simple HTML representation (only `<sub>` and `<sup>` tags) to LaTeX.
 * `<sub>text</sub>` → `_{text}`, `<sup>text</sup>` → `^{text}`.
 * Escapes the 5 LaTeX special characters: `\`, `{`, `}`, `^`, `_`.
 * Handles nested tags correctly via recursive descent.
 */
export function html_to_latex(html: string): string {
    let i = 0;

    const ESCAPE: Record<string, string> = {
        '\\': '\\textbackslash ',
        '{': '\\{',
        '}': '\\}',
        '^': '\\^{}',
        _: '\\_',
        ω: '\\omega ',
        Ω: '\\Omega ',
        ψ: '\\psi ',
    };

    function read(end_tag?: string): string {
        let result = '';
        while (i < html.length) {
            if (end_tag && html.startsWith(end_tag, i)) {
                i += end_tag.length;
                break;
            }
            if (html.startsWith('<sub>', i)) {
                i += 5;
                result += '_{' + read('</sub>') + '}';
            } else if (html.startsWith('<sup>', i)) {
                i += 5;
                result += '^{' + read('</sup>') + '}';
            } else {
                const ch = html[i];
                result += ESCAPE[ch] ?? ch;
                i++;
            }
        }
        return result;
    }

    return read();
}

export type TextSpec = string | { id: string };

/** 解析 NameSpec: string 作为纯文本, { id } 按 i18n id 翻译。无 translate 时退回显示 id。 */
export function resolve_name(spec: TextSpec | undefined, translate?: (id: string) => string): string | undefined {
    if (spec === undefined) return undefined;
    if (typeof spec === 'string') return spec;
    return translate ? translate(spec.id) : spec.id;
}

export type NotationDisplaySpec<T> =
    | NotationDisplay<T>
    | {
          plain: NotationDisplay<T>;
          html?: NotationDisplay<T>;
          latex?: NotationDisplay<T>;
          from_display?: (str: string) => T;
          name?: TextSpec;
          name_id?: string;
      };

export interface ResolvedDisplaySpec<T> {
    plain: NotationDisplay<T>;
    html: NotationDisplay<T>;
    latex: NotationDisplay<T>;
    from_display?: (str: string) => T;
    name?: TextSpec;
}

export function resolve_display<T>(spec: NotationDisplaySpec<T>): ResolvedDisplaySpec<T> {
    if (typeof spec === 'function') {
        const html = spec;
        const latex = (a: T) => html_to_latex(html(a));
        return { plain: spec, html, latex };
    }
    const html_fn = spec.html ?? spec.plain;
    const latex_fn = spec.latex ?? ((a: T) => html_to_latex(html_fn(a)));

    let name = spec.name;
    if (!name && spec.name_id) name = { id: spec.name_id };

    return {
        plain: spec.plain,
        html: html_fn,
        latex: latex_fn,
        from_display: spec.from_display,
        name,
    };
}

/**
 * 解析 display spec (含 display_equiv 条目) 的表示法名称。
 * 优先使用推荐的 `name` 字段 (TextSpec: 字面量字符串, 或 `{ id }` i18n 键);
 * 遗留的 `name_id` 字段仅作兼容别名, 等价于 `name: { id: name_id }`。
 * 未定义名称时返回 undefined, 由调用方决定回退 (如直接显示等价记号字段名)。
 */
export function resolve_display_name<T>(
    spec: NotationDisplaySpec<T>,
    translate?: (id: string) => string,
): string | undefined {
    return resolve_name(resolve_display(spec).name, translate);
}

export type DiagramAction = {
    type: 'scroll';
    direction: 'up' | 'down' | 'left' | 'right';
    step: number;
};

export type DiagramControlSetting =
    | {
          type: 'boolean';
          name: TextSpec;
          field_name: string;
      }
    | {
          type: 'number';
          name: TextSpec;
          min?: number;
          max?: number;
          field_name: string;
      }
    | {
          type: 'info';
          name: TextSpec;
      };

export interface DiagramControl<T, DataType> {
    default_data: DataType;
    draw_diagram: (expr: T, data: DataType) => Diagram | undefined;
    settings?: DiagramControlSetting[];
    handle_action?: (data: DataType, action: DiagramAction) => DataType | null;
}

export interface NotationDefinition<T> {
    id: string;
    name: TextSpec;
    simple_name?: TextSpec;
    description?: TextSpec | TextSpec[];
    category_id?: string;
    display: NotationDisplaySpec<T>;
    display_equiv?: Record<string, NotationDisplaySpec<T>>;
    is_limit: (a: T) => boolean;
    compare: (a: T, b: T) => number;
    FS: (a: T, index: number) => T;
    FS_alter?: (a: T, index: number) => T;
    FS_short?: (a: T, index: number) => T;
    draw_diagram?: DiagramControl<T, any>;
    init: () => T[];

    /** Key(s) into the i18n table for credit text displayed below the notation tree. Each entry is rendered as a separate line. */
    credit_text_id?: string | string[];

    /** Debug helpers — not consumed by the app but accessible at runtime. */
    debug?: Record<string, any>;
}

export interface NotationCategoryGenerator {
    start: number;
    initial: number;
    create: (n: number) => NotationDefinition<any>;
}

export interface NotationCategoryDefinition {
    id: string;
    name: TextSpec;
    simple_name?: TextSpec;
    parent_id?: string;
    generator?: NotationCategoryGenerator;
}
