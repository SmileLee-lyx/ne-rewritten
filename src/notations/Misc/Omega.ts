import { number_compare } from '@/utils';
import { NotationDefinition } from '@/notation-definition.ts';

export type Expr = number;

export function is_infinity(a: Expr): boolean {
    return a === Infinity;
}

export function compare(a: Expr, b: Expr): number {
    return number_compare(a, b);
}

export function display(a: Expr): string {
    return a === Infinity ? 'ω' : '' + a;
}

export function from_display(s: string): Expr {
    s = s.trim().toLowerCase();
    if (s === 'ω' || s === 'w' || s === 'Infinity' || s === 'Limit') return Infinity;
    if (!/^-?\d+$/.test(s)) throw new Error(`Illegal input string: ${s}`);
    return parseInt(s, 10);
}

export const omega: NotationDefinition<Expr> = {
    id: 'omega',
    name: 'ω',
    display: { plain: display, from_display },
    is_limit: is_infinity,
    compare,
    FS: (a, i) => (is_infinity(a) ? i : a > 0 ? a - 1 : 0),

    init: () => [Infinity, 0],
};
