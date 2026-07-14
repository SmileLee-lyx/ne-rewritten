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

export type NotationDisplaySpec<T> =
    | NotationDisplay<T>
    | {
          plain: NotationDisplay<T>;
          html?: NotationDisplay<T>;
          latex?: NotationDisplay<T>;
          from_display?: (str: string) => T;
          name_id?: string;
      };

export interface ResolvedDisplaySpec<T> {
    plain: NotationDisplay<T>;
    html: NotationDisplay<T>;
    latex: NotationDisplay<T>;
    from_display?: (str: string) => T;
    name_id?: string;
}

export function resolve_display<T>(spec: NotationDisplaySpec<T>): ResolvedDisplaySpec<T> {
    if (typeof spec === 'function') {
        const html = spec;
        const latex = (a: T) => html_to_latex(html(a));
        return { plain: spec, html, latex };
    }
    const html_fn = spec.html ?? spec.plain;
    const latex_fn = spec.latex ?? ((a: T) => html_to_latex(html_fn(a)));
    return {
        plain: spec.plain,
        html: html_fn,
        latex: latex_fn,
        from_display: spec.from_display,
        name_id: spec.name_id,
    };
}

export type DiagramAction = {
    type: 'scroll';
    direction: 'up' | 'down' | 'left' | 'right';
    step: number;
};

export interface DiagramControl<T, DataType> {
    default_data: DataType;
    draw_diagram: (expr: T, data: DataType) => Diagram | undefined;
    handle_action?: (data: DataType, action: DiagramAction) => DataType | null;
}

export interface NotationDefinition<T> {
    id: string;
    name: string;
    simple_name?: string;
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

    /** Key into the i18n table for credit text displayed below the notation tree. */
    credit_text_id?: string;

    /** Debug helpers — not consumed by the app but accessible at runtime. */
    debug?: Record<string, any>;
}
