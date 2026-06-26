import { lex_compare, NotationDefinition } from '@/utils.ts';

type Expr = Expr[];

function INFINITY(): Expr {
    return [Infinity] as any;
}

function is_infinity(e: Expr): boolean {
    return '' + e === 'Infinity';
}

function is_limit(e: Expr): boolean {
    return is_infinity(e) || (e.length > 0 && e[e.length - 1].length > 0);
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, compare);
}

function root(a: Expr): number {
    if (is_infinity(a)) return -1;
    if (a.length === 0) return -1;
    let result = a.length - 2;
    while (result >= 0 && compare(a[result], a[a.length - 1]) >= 0) result--;
    return result;
}

function infinity_FS(index: number): Expr {
    if (index === 0) return [[]];
    return [[], infinity_FS(index - 1)];
}

function FS(a: Expr, index: number): Expr {
    if (is_infinity(a)) return infinity_FS(index);
    if (a.length === 0) return a;
    if (a[a.length - 1].length === 0) return a.slice(0, -1);

    if (is_limit(a[a.length - 1])) {
        return [...a.slice(0, -1), FS(a[a.length - 1], index)];
    }

    let r = root(a);
    let result = a.slice(0, -1);
    let dup = a.slice(r, -1);
    dup[0] = a[a.length - 1].slice(0, -1);
    for (let i = 0; i < index; i++) result.push(...dup);
    return result;
}

function display(a: Expr, top_level: boolean = true): string {
    if (is_infinity(a)) return 'Limit';
    if (top_level) return a.map((t) => display(t, false)).join(',');
    if (a.every((t) => t.length === 0)) return '' + a.length;
    return '(' + display(a, true) + ')';
}

export const T_Minus1_Y: NotationDefinition<Expr> = {
    id: 't--1y',
    name: 'Transfinite (-1)-Y',
    simple_name: 'T(-1)Y',
    display: { plain: display },
    compare,
    is_limit,
    FS,
    init: () => [INFINITY(), []],
};
