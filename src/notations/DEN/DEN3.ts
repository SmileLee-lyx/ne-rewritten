import { boolean_compare, lex_compare, number_compare } from '@/utils.ts';
import { draw_diagram_control as den2_diagram_control, type Expr as DEN2_Expr, type DiagramData } from './DEN2.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';

const data: any = {};
const data_alter: any = {};

var toShort = (expr: any) =>
    expr.map((row: any) =>
        row
            .slice(1, -row[0])
            .concat([row[row.length - 1]])
            .map((x: any) => x[0]),
    );
var seqseq_compare = (m1: any, m2: any): number => {
    if (m1.length === 0) {
        return m2.length === 0 ? 0 : -1;
    }
    if (m2.length === 0) return 1;
    var cmp = lex_compare(m1[0], m2[0], number_compare);
    if (cmp) return cmp;
    return seqseq_compare(m1.slice(1), m2.slice(1));
};
/** 记号极限特殊值 (display 为 'Limit'): 形如 [Infinity]。 */
function INFINITY(): any {
    return [Infinity];
}

function is_infinity(e: any): boolean {
    return '' + e === 'Infinity';
}

var compare = (expr1: any, expr2: any): number => {
    if (is_infinity(expr1) || is_infinity(expr2)) return boolean_compare(is_infinity(expr1), is_infinity(expr2));
    return seqseq_compare(toShort(expr1), toShort(expr2));
};
var display = (expr: any) =>
    is_infinity(expr)
        ? 'Limit'
        : expr
              .map(
                  (row: any) =>
                      '(' +
                      row
                          .slice(1)
                          .map((x: any) => (x[1] ? '*' : '') + x[0])
                          .join(',') +
                      ')' +
                      row[0],
              )
              .join('');

function from_display(str: string): any {
    const result: any[] = [];
    let i = 0;
    const s = str;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function parse_digits(): number {
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        return parseInt(s.substring(start, i), 10);
    }

    function parse_entry(): any {
        skip_spaces();
        let marked = false;
        if (i < s.length && s[i] === '*') {
            marked = true;
            i++;
            skip_spaces();
        }
        return marked ? [parse_digits(), true] : [parse_digits()];
    }

    // 一行: '(' 条目列表 ')' step; 每行的 row[0] 是 step, row[1..] 是 entry
    function parse_row(): any {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;
        skip_spaces();
        const entries: any[] = [];
        if (i < s.length && s[i] !== ')') {
            while (true) {
                entries.push(parse_entry());
                skip_spaces();
                if (i < s.length && s[i] === ',') {
                    i++;
                    continue;
                }
                break;
            }
        }
        if (i >= s.length || s[i] !== ')') error();
        i++;
        skip_spaces();
        return [parse_digits()].concat(entries);
    }

    // 'Limit' 只允许作为整串输入 (带或不带前后空格)
    skip_spaces();
    if (s.slice(i, i + 5) === 'Limit') {
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY();
    }
    while (i < s.length) {
        skip_spaces();
        if (i >= s.length) break;
        if (s[i] !== '(') error();
        result.push(parse_row());
    }
    return result;
}
var values = (row: any) => [row[0]].concat(row.slice(1).map((x: any) => x[0]));
var isNonzero = (expr: any) => expr.length > 0;
var pleasantUntil = (rows: any, t: any): any => {
    var tcheck = values(t).slice(1 + t[0]),
        tmax = tcheck[0],
        tmin = tcheck[tcheck.length - 1],
        scheck: any,
        i1: any,
        i2: any;
    for (var n = 0; n < rows.length; n++) {
        scheck = values(rows[n]).slice(1);
        i1 = scheck.findIndex((x: any) => x < tmax);
        i2 = (function (arr: any, pred: any) {
            for (var i = arr.length - 1; i >= 0; i--) {
                if (pred(arr[i])) return i;
            }
            return -1;
        })(scheck, (x: any) => x > tmin);
        if (~i1 && ~i2 && i1 <= i2 && scheck.slice(i1, i2 + 1).some((x: any) => !tcheck.includes(x))) return n;
    }
    return -1;
};
var isLimit = (expr: any): any => {
    if (is_infinity(expr)) return true;
    if (expr.length === 0) return false;
    var active = expr[expr.length - 1];
    if (!active[1 + active[0]]?.[0]) return false;
    return pleasantUntil(expr.slice(active[1 + active[0]][0] - 1, -1), active) === -1;
};
var cut = (expr: any) => expr.slice(0, -1).map((row: any) => [row[0]].concat(row.slice(1).map((x: any) => x.slice())));
var seqFrom = (expr: any, i: any, j: any): any => {
    var row = expr[i],
        val = row[j][0],
        threshold = row[j + row[0]]?.[0] ?? 0,
        idx: any,
        record: any = [[i + 1, j], [val]];
    if (!threshold) return;
    while (val > threshold) {
        row = expr[val - 1];
        idx = 1 + row[0];
        record[record.length - 1][1] = idx;
        val = row[idx]?.[0];
        record.push([val]);
    }
    if (val !== threshold) return;
    return record.slice(1, -1);
};
var apv = (s: any, t: any) =>
    s.map((x: any) =>
        x < t[t.length - 1] ? x : x >= t[1 + t[0]] ? x - t[1 + t[0]] + t[1] : t[t.lastIndexOf(x) - t[0]],
    );
var ap = (s: any, t: any) => [s[0]].concat(apv(values(s).slice(1), values(t)).map((x: any) => [x]));
var copy = (raw: any, flag: any) => {
    var active = raw[raw.length - 1],
        expr = cut(raw);
    var begin = active[1 + active[0]][0];
    var a1 = active[active.length - 1][0];
    var end = ~flag ? active[1 + active[0]][0] + flag : raw.length + 1;
    var offset = raw.length - begin;
    expr = expr.concat(raw.slice(begin - 1, end - 1).map((row: any) => ap(row, active)));
    var row: any, targetrow: any, i: any, j: any, seq: any;
    for (i = begin - 1; i < end - 1; ++i) {
        row = raw[i];
        targetrow = expr[i + offset];
        for (j = 1; j < row.length; ++j) {
            if (!row[j][1]) continue;
            seq = seqFrom(expr, i + offset, j);
            if (!seq) continue;
            var nomove = seq.findIndex((x: any) => x[0] < begin);
            if (nomove === -1) {
                targetrow[j][1] = true;
                continue;
            }
            var y0 = seq[nomove][0];
            if (y0 < a1) {
                targetrow[j][1] = true;
                continue;
            }
            var k = 1 + active.slice(1).findIndex((x: any) => x[0] === y0);
            if (active[k - active[0]]?.[1] && !(targetrow[j + targetrow[0] - 1]?.[0] > a1)) targetrow[j][1] = true;
        }
    }
    return expr;
};
var compTo = (raw: any, r: any, Rec: any) => {
    var expr = raw.map((row: any) => [row[0]].concat(row.slice(1).map((x: any) => x.slice())));
    for (var i = raw[r].length - 1; i > 0; --i) {
        if (!raw[r][i][1]) continue;
        var bi = raw[r][i][0];
        var seq = seqFrom(expr, r, i);
        if (!seq) continue;
        var t = seq[seq.length - 1][0];
        var T = Rec[t - 1];
        if (!T) continue;
        for (var j = 0; j + 1 < seq.length; ++j)
            if (!expr[seq[j + 1][0] - 1].some((x: any) => x[0] === seq[j][0] + 1)) continue;
        var q = T.length;
        var entries = expr[r]
            .slice(1)
            .map((x: any) => x.slice())
            .concat(T.map((x: any) => [x]))
            .concat(
                Array(q)
                    .fill(0)
                    .map((x: any, uu: any) => [bi + 1 + uu, true]),
            );
        entries.sort((x: any, y: any) => y[0] - x[0]);
        expr[r] = [expr[r][0] + q].concat(entries);
    }
    return expr;
};
var compFrom = (raw: any, r: any, T: any) => {
    var expr = raw.slice(0, r).map((row: any) => [row[0]].concat(row.slice(1).map((x: any) => x.slice())));
    var q = T.length;
    var lr = raw[r].length < raw[r][0] * 2 + 1 ? raw[r][0] : raw[r][0] + 1;
    var cr =
        raw[r].length < raw[r][0] * 2 + 1
            ? raw[r].slice(1, -raw[r][0]).concat(raw[r].slice(1 + raw[r][0]))
            : raw[r].slice(1);
    for (var qq = 0; qq < q; ++qq) {
        var entries = cr
            .map((x: any) => x.slice())
            .concat(T.slice(0, 1 + qq).map((x: any) => [x]))
            .concat(
                Array(qq)
                    .fill(0)
                    .map((x: any, uu: any) => [raw[r][1][0] + 1 + uu]),
            );
        entries.sort((x: any, y: any) => y[0] - x[0]);
        expr[r + qq] = [lr + qq].concat(entries);
    }
    entries = raw[r]
        .slice(1)
        .map((x: any) => x.slice())
        .concat(T.map((x: any) => [x]))
        .concat(
            Array(q)
                .fill(0)
                .map((x: any, uu: any) => [raw[r][1][0] + 1 + uu]),
        );
    entries.sort((x: any, y: any) => y[0] - x[0]);
    expr[r + q] = [raw[r][0] + q].concat(entries);
    for (qq = 1; qq <= q; ++qq) for (var uu = 2; uu <= 1 + qq; ++uu) expr[r + qq][uu][1] = true;
    var m = (x: any, idx: any) => {
        if (!idx) return x;
        var xx = x.slice();
        xx[0] += xx[0] <= raw[r][1][0] ? 0 : q;
        return xx;
    };
    expr = expr.concat(raw.slice(r + 1).map((row: any) => row.map(m)));
    return expr;
};
var expand = (raw: any, FSterm: any, longer: any): any => {
    var active = raw[raw.length - 1];
    if (!active[1 + active[0]]?.[0]) return cut(raw);
    var flag = pleasantUntil(raw.slice(active[1 + active[0]][0] - 1, -1), active);
    var expr = raw;
    if (~flag) {
        expr = copy(expr, flag);
    } else {
        for (var n = 1; n <= FSterm; ++n) expr = copy(expr, flag);
        if (longer) {
            var len0 = expr.length;
            expr = copy(expr, 1);
        } else {
            expr = cut(expr);
        }
    }
    var Rec: any = [];
    for (var r = raw.length - 1; r < expr.length; ++r) {
        expr = compTo(expr, r, Rec);
        if (!(expr[r].length <= expr[r][0] * 2 + 1)) continue;
        var row = expr[r],
            pr = row[1 + row[0]][0];
        var T = [row[row[0]][0]];
        do {
            T.unshift(expr[T[0] - 1][2][0]);
        } while (T[0] > pr);
        T = T.slice(1, -1);
        if (T.length < 1) continue;
        Rec[r] = T;
        expr = compFrom(expr, r, T);
        r += T.length;
    }
    if (longer) while (expr.length > len0) expr = cut(expr);
    return expr;
};
var Limit_row = (n: any) =>
    Array(3 + n)
        .fill(0)
        .map((x: any, nn: any) => (3 <= nn && nn < 2 + n ? [nn, true] : [nn]))
        .concat([2])
        .reverse();
var Limit = (n: any) =>
    [
        [1, [1], [0]],
        [1, [2], [1], [0]],
    ].concat(
        Array(n)
            .fill(0)
            .map((x: any, nn: any) => Limit_row(1 + nn)),
    );

/** 将 DEN3 的 Expr 转换为 DEN2 的 Expr。每行的 row[0] 是 step，row[1..] 即为 entry。 */
function den3_to_den2(expr: any[][]): DEN2_Expr {
    return expr.map((row) => [row[0], row.slice(1)]) as unknown as DEN2_Expr;
}

const diagram_control: DiagramControl<any, DiagramData> = {
    default_data: den2_diagram_control.default_data,
    settings: den2_diagram_control.settings,
    draw_diagram: (expr, data) => den2_diagram_control.draw_diagram(den3_to_den2(expr), data),
    handle_action: (data, action) => den2_diagram_control.handle_action!(data, action),
};

export const DEN3: NotationDefinition<any> = {
    id: 'den3',
    name: 'DEN3',
    category_id: 'category-den',
    display: { plain: display, from_display },
    is_limit: isLimit,
    compare,
    draw_diagram: diagram_control,
    FS: (m: any, FSterm: any) => {
        if (is_infinity(m)) return Limit(FSterm);
        if (!m.length) return [];
        return expand(m, FSterm, false);
    },
    FS_alter: (m: any, FSterm: any) => {
        if (is_infinity(m)) return Limit(FSterm);
        if (!m.length) return [];
        return expand(m, FSterm, true);
    },
    credit_text_id: 'credit.den23',

    init: () => [[Infinity], []],
};
