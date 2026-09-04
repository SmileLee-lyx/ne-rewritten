import { boolean_compare } from '@/utils.ts';

/** 记号极限的特殊值: aSAN 中无法由普通标准项表示的极限 ([1, ω])。 */
export function INFINITY(): any {
    return [1, Infinity];
}

export function is_infinity(a: any): boolean {
    return Array.isArray(a) && a.length === 2 && a[0] === 1 && a[1] === Infinity;
}

export var aSAN_compare = (a: any, b: any): number => {
    if (is_infinity(a) || is_infinity(b)) return boolean_compare(is_infinity(a), is_infinity(b));
    if (typeof a === 'number') {
        if (typeof b === 'number') return a > b ? 1 : a < b ? -1 : 0;
        a = [a];
    }
    if (typeof b === 'number') b = [b];
    if (a.length > b.length) return 1;
    if (a.length < b.length) return -1;
    var tmp: any, k: any;
    for (k = a.length; k--;) {
        tmp = aSAN_compare(a[k], b[k]);
        if (tmp !== 0) return tmp;
    }
    return 0;
};

export var aSAN_display = (a: any): string =>
    typeof a === 'number' ? '' + a : is_infinity(a) ? 'Limit' : '(' + a.map(aSAN_display).join() + ')';

export function aSAN_from_display(s: string): any {
    let i = 0;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function parse_number(): number {
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        return parseInt(s.substring(start, i), 10);
    }

    function parse_value(): any {
        skip_spaces();
        if (i >= s.length) error();
        if (s[i] === '(') {
            i++;
            const result: any[] = [];
            skip_spaces();
            if (i < s.length && s[i] === ')') {
                i++;
                return result;
            }
            while (true) {
                result.push(parse_value());
                skip_spaces();
                if (i >= s.length) error();
                if (s[i] === ',') {
                    i++;
                    continue;
                }
                if (s[i] === ')') {
                    i++;
                    return result;
                }
                error();
            }
        }
        if (s.slice(i, i + 5) === 'Limit') {
            i += 5;
            return INFINITY();
        }
        return parse_number();
    }

    skip_spaces();
    const result = parse_value();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

export var aSAN_base = (A: any): any => (typeof A === 'number' ? A : aSAN_base(A[0]));

export var aSAN_able = (a: any): boolean => typeof a !== 'number' && aSAN_base(a) === 1;

export var aSAN_semiable = (a: any): any => a !== 1;
