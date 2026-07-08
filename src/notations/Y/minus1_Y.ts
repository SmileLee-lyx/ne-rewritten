import { lex_compare, number_compare } from '@/utils.ts';
import { sequence_display, sequence_from_display } from '@/notations/Y/Omega_Y.ts';
import { NotationDefinition } from '@/notation-definition.ts';

type Expr = number[];

function INFINITY(): Expr {
    return [Infinity];
}

function is_infinity(e: Expr): boolean {
    return '' + e === 'Infinity';
}

function is_limit(e: Expr): boolean {
    return is_infinity(e) || (e.length > 0 && e[e.length - 1] > 1);
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, number_compare);
}

function root(a: Expr): number {
    if (is_infinity(a)) return -1;
    if (a.length === 0) return -1;
    let result = a.length - 2;
    while (result >= 0 && a[result] >= a[a.length - 1]) result--;
    return result;
}

function infinity_FS(index: number): Expr {
    return [1, index + 1];
}

function FS(a: Expr, index: number): Expr {
    if (is_infinity(a)) return infinity_FS(index);
    if (a.length === 0) return a;
    if (a[a.length - 1] === 1) return a.slice(0, a.length - 1);

    let r = root(a);
    let result = a.slice(0, a.length - 1);
    let dup = a.slice(r, a.length - 1);
    dup[0] = a[a.length - 1] - 1;
    for (let i = 0; i < index; i++) result.push(...dup);
    return result;
}

export const Minus1_Y: NotationDefinition<Expr> = {
    id: '-1y',
    name: '(-1)-Y sequence',
    simple_name: '(-1)Y',
    category_id: 'category-y',
    display: { plain: sequence_display, from_display: sequence_from_display },
    compare,
    is_limit,
    FS,
    credit_text_id: 'credit.community_y',

    init: () => [INFINITY(), [1], []],
};
