import { lex_compare } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';

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

function from_display(str: string): Expr {
    let i = 0;
    const s = str;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    // 逗号分隔的子项列表: 顶层表达式与括号内容共用同一语法; ')' 处结束, 由调用方消费
    function parse_list(): Expr {
        const result: Expr = [];
        skip_spaces();
        if (i >= s.length || s[i] === ')') return result;
        while (true) {
            result.push(parse_child());
            skip_spaces();
            if (i >= s.length || s[i] !== ',') break;
            i++;
            skip_spaces();
            if (i >= s.length || s[i] === ')') error();
        }
        return result;
    }

    function parse_child(): Expr {
        skip_spaces();
        if (i >= s.length) error();
        if (s[i] === '(') {
            i++;
            const inner = parse_list();
            skip_spaces();
            if (i >= s.length || s[i] !== ')') error();
            i++;
            return inner;
        }
        // 整数 k: 由 k 个空数组构成的子项 (display 中显示为计数)
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        const k = parseInt(s.substring(start, i), 10);
        return Array.from({ length: k }, () => []);
    }

    // 'Limit' 只允许作为整串输入 (带或不带前后空格)
    skip_spaces();
    if (s.slice(i, i + 5) === 'Limit') {
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY();
    }
    const result = parse_list();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

export const T_Minus1_Y: NotationDefinition<Expr> = {
    id: 't--1y',
    name: 'Transfinite -1Y',
    simple_name: 'T(-1)Y',
    category_id: 'category-y',
    display: { plain: display, from_display },
    compare,
    is_limit,
    FS,
    credit_text_id: 'credit.community_y',

    init: () => [INFINITY(), []],
};
