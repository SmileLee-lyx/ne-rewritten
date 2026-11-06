import type { Diagram } from '@/core/diagram_types.ts';
export type E0Ord = { exp: E0Ord; coeff: number }[];
export type E0Expr = { a: number; x: E0Ord }[][] | 'Limit';
export interface CountOptions {
    maxMs?: number;
    maxWork?: number;
    disableFast?: boolean;
    disableFiniteBatch?: boolean;
    stats?: Record<string, number>;
}
export function createE0Core(strong?: boolean): {
    plain(expr: E0Expr): string;
    html(expr: E0Expr): string;
    latex(expr: E0Expr): string;
    parse(text: string): E0Expr;
    rowPlain(expr: E0Expr): string;
    rowHtml(expr: E0Expr): string;
    rowLatex(expr: E0Expr): string;
    rowParse(text: string): E0Expr;
    fs(expr: E0Expr, index: number): E0Expr;
    fsShort(expr: E0Expr, index: number): E0Expr;
    compare(a: E0Expr, b: E0Expr): number;
    isLimit(expr: E0Expr): boolean;
    counts(expr: E0Expr, options?: CountOptions): string;
    exactCounts(expr: E0Expr, options?: CountOptions): bigint[];
    countResult(expr: E0Expr, options?: CountOptions): { values: (bigint | null)[]; complete: boolean };
    draw(expr: E0Expr): Diagram | undefined;
    ordPlain(ord: E0Ord): string;
    ordCompare(a: E0Ord, b: E0Ord): number;
    down(expr: E0Expr): E0Expr;
};
