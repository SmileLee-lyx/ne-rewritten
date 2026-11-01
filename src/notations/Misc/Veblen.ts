import { bind2, boolean_compare, lex_compare, tuple_lex_compare_by } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { FS_default_LNZ_variant, merge_sum } from '@/notations/notation_utils.ts';
import { display as display_bm } from '@/notations/BM-like/BM.ts';
import { display_OCN_IR, merge_sum as merge_ocn_sum, type OCNDisplayIR } from '@/notations/OCN/OCN_utils.ts';
import { category_veblen } from '@/notations/Misc/categories.ts';

type VeblenList = [VeblenList, Expr][];
// 0: 0
// 1: sum
// 2: φ
type Expr = [0] | [1, Expr[]] | [2, VeblenList, Expr];

const INFINITY: Expr = Infinity as any;

function is_infinity(e: Expr) {
    return e === INFINITY;
}

type DisplayType = 'plain' | 'html' | 'latex';

function display_list_impl(l: VeblenList, d: (e: Expr) => string): string {
    function impl_list(l: VeblenList): string {
        if (l.length === 0) return '';
        if (list_is_finite(l[0][0])) {
            const max = list_to_nat(l[0][0]);
            const values = Array<Expr>(max + 1).fill(zero());
            for (let [p, v] of l) values[list_to_nat(p)] = v;
            return values.map(d).toReversed().join(',');
        }
        return l.map(impl_list_entry).join(',');
    }

    function impl_list_entry([p, v]: VeblenList[number]): string {
        if (p.length === 0) return d(v) + '@0';
        if (p.length === 1 && p[0][0].length === 0) return d(v) + '@' + d(p[0][1]);
        return d(v) + '@(' + impl_list(p) + ')';
    }

    return impl_list(l);
}

function is_finite(e: Expr): boolean {
    if (e[0] === 0) return true;
    if (e[0] === 2) return is_one(e);
    return is_one(e[1][0]);
}

function to_nat(e: Expr): number {
    return prim_list(e).length;
}

function from_nat(n: number): Expr {
    return from_prim_list(Array<Expr>(n).fill(one()));
}

function list_is_finite(l: VeblenList): boolean {
    return l.length === 0 || (l.length === 1 && l[0][0].length === 0 && is_finite(l[0][1]));
}

function list_to_nat(l: VeblenList): number {
    if (l.length === 0) return 0;
    return to_nat(l[0][1]);
}

function list_from_nat(n: number): VeblenList {
    if (n === 0) return [];
    return [[[], from_nat(n)]];
}

function add_tail_to_list(l: VeblenList, tail: Expr): VeblenList {
    let new_l: VeblenList = [];
    for (let [p, v] of l) {
        if (!list_is_finite(p)) new_l.push([p, v]);
        else new_l.push([list_from_nat(list_to_nat(p) + 1), v]);
    }
    if (!is_zero(tail)) new_l.push([[], tail]);
    return new_l;
}

function display(e: Expr, type: DisplayType): string {
    const is_latex = type === 'latex';
    if (is_infinity(e)) return is_latex ? '\\mathrm{Limit}' : 'Limit';

    function impl(e: Expr): string {
        switch (e[0]) {
            case 0:
                return '0';
            case 1:
                return merge_sum(e[1].map(impl));
            case 2:
                const phi = is_latex ? '\\varphi ' : 'φ';
                if (e[1].length === 0) {
                    if (is_zero(e[2])) return '1';
                    if (is_one(e[2])) return is_latex ? '\\omega' : 'ω';
                    if (type === 'html') {
                        return 'ω<sup>' + impl(e[2]) + '</sup>';
                    } else if (type === 'latex') {
                        return '\\omega^{' + impl(e[2]) + '}';
                    }
                    return phi + '(' + impl(e[2]) + ')';
                }
                let l = add_tail_to_list(e[1], e[2]);
                return phi + '(' + display_list_impl(l, impl) + ')';
            default:
                throw new Error('Unreachable');
        }
    }

    return impl(e);
}

function display_separate(e: Expr, type: DisplayType): string {
    const is_latex = type === 'latex';
    if (is_infinity(e)) return is_latex ? '\\mathrm{Limit}' : 'Limit';

    function impl(e: Expr): string {
        switch (e[0]) {
            case 0:
                return '0';
            case 1:
                return merge_sum(e[1].map(impl));
            case 2:
                const phi = is_latex ? '\\varphi ' : 'φ';
                if (e[1].length === 0) {
                    if (is_zero(e[2])) return '1';
                    if (is_one(e[2])) return is_latex ? '\\omega' : 'ω';
                    if (type === 'html') {
                        return 'ω<sup>' + impl(e[2]) + '</sup>';
                    } else if (type === 'latex') {
                        return '\\omega^{' + impl(e[2]) + '}';
                    }
                    return phi + '(' + impl(e[2]) + ')';
                }
                return phi + '(' + display_list_impl(e[1], impl) + ';' + impl(e[2]) + ')';
            default:
                throw new Error('Unreachable');
        }
    }

    return impl(e);
}

// ============ from_display: accepts both display (plain) and display_separate styles ============

type IndexSpec = { kind: 'nat'; n: number } | { kind: 'scalar'; e: Expr } | { kind: 'list'; l: VeblenList };

interface VItem {
    v: Expr;
    idx: IndexSpec | null;
}

function omega_of(): Expr {
    return [2, [], one()];
}

function from_display(str: string): Expr {
    return new VParser(str).parse_top();
}

/** 独立的递归下降解析器实例 (便于对子串(如复合索引)复用同一套函数) */
class VParser {
    private t: string;
    private i: number;

    constructor(text: string) {
        this.t = text;
        this.i = 0;
    }

    private error(): never {
        throw new Error('Illegal input string: ' + this.t);
    }

    private skip(): void {
        while (this.i < this.t.length && this.t[this.i] === ' ') this.i++;
    }

    private digits(): number {
        this.skip();
        const s = this.i;
        while (this.i < this.t.length && this.t[this.i] >= '0' && this.t[this.i] <= '9') this.i++;
        if (s === this.i) this.error();
        return parseInt(this.t.substring(s, this.i), 10);
    }

    // 读取当前 '(' 起、与之配对的 ')' (含) 之前的内容, 消费到 ')' 之后
    private read_parens(): string {
        this.skip();
        if (this.i >= this.t.length || this.t[this.i] !== '(') this.error();
        let depth = 0;
        let j = this.i;
        for (; j < this.t.length; j++) {
            const c = this.t[j];
            if (c === '(') depth++;
            else if (c === ')') {
                depth--;
                if (depth === 0) break;
            }
        }
        if (j >= this.t.length) this.error();
        const inner = this.t.substring(this.i + 1, j);
        this.i = j + 1;
        return inner;
    }

    // 序数加法按文本顺序吸收右侧较大素项之前的较小项，相等项保留。
    private ordinal(): Expr {
        const atoms: Expr[] = [];
        while (true) {
            this.skip();
            for (const atom of this.prime_atoms()) {
                while (atoms.length > 0 && compare(atoms[atoms.length - 1], atom) < 0) atoms.pop();
                atoms.push(atom);
            }
            this.skip();
            if (this.i < this.t.length && this.t[this.i] === '+') {
                this.i++;
                continue;
            }
            break;
        }
        return from_prim_list(atoms);
    }

    // 素项(0/n/ω/φ(…))加可选系数后缀: 'ω2' = ω+ω, 'φ(2)3' = φ(2) 重复 3 次
    // 返回扁平素项序列 (n 为 n 个 1; 系数为 m 个该素项)
    private prime_atoms(): Expr[] {
        this.skip();
        if (this.i >= this.t.length) this.error();
        const c = this.t[this.i];
        if (c >= '0' && c <= '9') {
            const n = this.digits();
            return Array<Expr>(n).fill(one());
        }
        let prime: Expr;
        if (c === 'ω' || c === 'w') {
            // 'w' 视作 'ω'
            this.i++;
            prime = omega_of();
        } else if (c === 'φ' || c === 'f') {
            // 'f' 视作 'φ'
            this.i++;
            this.skip();
            if (this.i >= this.t.length || this.t[this.i] !== '(') this.error();
            this.i++;
            prime = this.phi_body();
        } else {
            this.error();
        }
        let mult = 1;
        if (this.i < this.t.length && this.t[this.i] >= '0' && this.t[this.i] <= '9') {
            const s = this.i;
            while (this.i < this.t.length && this.t[this.i] >= '0' && this.t[this.i] <= '9') this.i++;
            mult = parseInt(this.t.substring(s, this.i), 10);
        }
        return Array<Expr>(mult).fill(prime);
    }

    // '@' 之后的索引
    private index_spec(): IndexSpec {
        this.skip();
        if (this.i >= this.t.length) this.error();
        if (this.t[this.i] === '(') {
            const inner = this.read_parens();
            return { kind: 'list', l: new VParser(inner).index_list() };
        }
        const e = this.ordinal(),
            n = this.natural_value(e);
        return n >= 0 ? { kind: 'nat', n } : { kind: 'scalar', e };
    }

    // 索引列表文本: 项可以是 "值" 或 "值@索引"(索引递归), 无独立 tail;
    // 语义等同 separate 模式: 无标号项按从右偏移 0,1,… 编号
    index_list(): VeblenList {
        const items: VItem[] = [];
        while (true) {
            this.skip();
            if (this.i >= this.t.length) break;
            const v = this.ordinal();
            this.skip();
            let idx: IndexSpec | null = null;
            if (this.i < this.t.length && this.t[this.i] === '@') {
                this.i++;
                idx = this.index_spec();
            }
            items.push({ v, idx });
            this.skip();
            if (this.i < this.t.length && this.t[this.i] === ',') {
                this.i++;
                continue;
            }
            if (this.i >= this.t.length) break;
            this.error();
        }
        const n = items.length;
        const l: VeblenList = [];
        for (let k = 0; k < n; k++) {
            const it = items[k];
            if (it.idx === null) {
                const off = n - 1 - k;
                l.push([list_from_nat(off), it.v]);
            } else if (it.idx.kind === 'nat') {
                l.push([list_from_nat(it.idx.n), it.v]);
            } else if (it.idx.kind === 'scalar') {
                l.push([this.scalar_prefix(it.idx.e, false), it.v]);
            } else {
                l.push([it.idx.l, it.v]);
            }
        }
        return this.normalize_list(l);
    }

    // 若 e 是纯自然数(0 或若干 '1' 之和)返回其值, 否则 -1
    private natural_value(e: Expr): number {
        if (is_zero(e)) return 0;
        if (is_one(e)) return 1;
        if (e[0] === 1 && e[1].every(is_one)) return e[1].length;
        return -1;
    }

    // 标量索引 → 前缀: 纯自然数按自然槽位编码(plain 偏移 -1; sep/索引列表不偏移), 否则复杂标量 [([], e)]
    private scalar_prefix(e: Expr, plain: boolean): VeblenList {
        const n = this.natural_value(e);
        if (n >= 0) {
            if (n === 0) {
                if (plain) this.error();
                return list_from_nat(0);
            }
            return list_from_nat(plain ? n - 1 : n);
        }
        const pref: VeblenList = [[[], e]];
        return pref;
    }

    // 地址的子表达式已经递归归约；先检验原槽位严格递减，再删除全部零值条目。
    private normalize_list(l: VeblenList): VeblenList {
        for (let k = 1; k < l.length; k++) {
            if (list_lex_compare(l[k - 1][0], l[k][0]) <= 0) this.error();
        }
        return l.filter(([, v]) => !is_zero(v));
    }

    // 先确定原始槽号与尾参数，再删除零项并正规化整个 φ。
    private assemble(entriesSrc: { prefix: VeblenList; v: Expr }[], tail: Expr): Expr {
        const l = this.normalize_list(entriesSrc.map((e) => [e.prefix, e.v]));
        return normalized_phi(l, tail);
    }

    // φ( 内部 (已消费 '(')
    private phi_body(): Expr {
        const items: VItem[] = [];
        let tail: Expr | null = null;
        while (true) {
            this.skip();
            if (this.i >= this.t.length) this.error();
            if (this.t[this.i] === ')') {
                this.i++;
                break;
            }
            const v = this.ordinal();
            this.skip();
            let idx: IndexSpec | null = null;
            if (this.i < this.t.length && this.t[this.i] === '@') {
                this.i++;
                idx = this.index_spec();
            }
            items.push({ v, idx });
            this.skip();
            if (this.i < this.t.length && this.t[this.i] === ',') {
                this.i++;
                continue;
            }
            if (this.i < this.t.length && this.t[this.i] === ';') {
                this.i++;
                tail = this.ordinal();
                this.skip();
                if (this.i >= this.t.length || this.t[this.i] !== ')') this.error();
                this.i++;
                break;
            }
            if (this.i < this.t.length && this.t[this.i] === ')') {
                this.i++;
                break;
            }
            this.error();
        }
        return this.build_phi(items, tail);
    }

    private build_phi(items: VItem[], semiTail: Expr | null): Expr {
        const src: { prefix: VeblenList; v: Expr }[] = [];
        if (semiTail !== null) {
            // separate 形式: ';' 后为 tail; 各项按自然索引(右起)或无标号项偏移
            const n = items.length;
            for (let k = 0; k < n; k++) {
                const it = items[k];
                if (it.idx === null) {
                    const off = n - 1 - k; // 右起 0
                    src.push({ prefix: list_from_nat(off), v: it.v });
                } else if (it.idx.kind === 'nat') {
                    src.push({ prefix: list_from_nat(it.idx.n), v: it.v });
                } else if (it.idx.kind === 'scalar') {
                    src.push({ prefix: this.scalar_prefix(it.idx.e, false), v: it.v });
                } else {
                    src.push({ prefix: it.idx.l, v: it.v });
                }
            }
            return this.assemble(src, semiTail);
        }

        // 普通形式: 末项为 tail (无标号, 或 '@0'); 无末项时 tail = 0
        let body: VItem[] = items;
        let tail: Expr;
        if (items.length === 0) {
            tail = zero();
        } else {
            const last = items[items.length - 1];
            const lastIsTail =
                last.idx === null ||
                (last.idx.kind === 'nat' && last.idx.n === 0) ||
                (last.idx.kind === 'list' && last.idx.l.length === 0);
            if (lastIsTail) {
                tail = last.v;
                body = items.slice(0, -1);
            } else {
                tail = zero();
            }
        }
        // 无标号项只允许出现在尾部
        let bareSeen = false;
        for (const it of body) {
            if (it.idx === null) bareSeen = true;
            else if (bareSeen) this.error();
        }
        const m = body.length;
        for (let k = 0; k < m; k++) {
            const it = body[k];
            if (it.idx === null) {
                // 普通自然槽: 距最右 tail 的偏移 offset+1 = 槽号, 前缀 nat(槽-1)
                const off = m - 1 - k + 1; // >= 1
                src.push({ prefix: list_from_nat(off - 1), v: it.v });
            } else if (it.idx.kind === 'nat') {
                if (it.idx.n === 0) this.error();
                src.push({ prefix: list_from_nat(it.idx.n - 1), v: it.v });
            } else if (it.idx.kind === 'scalar') {
                src.push({ prefix: this.scalar_prefix(it.idx.e, true), v: it.v });
            } else {
                const prefix = it.idx.l;
                if (list_is_finite(prefix)) {
                    const n = list_to_nat(prefix);
                    if (n === 0) this.error();
                    src.push({ prefix: list_from_nat(n - 1), v: it.v });
                } else {
                    src.push({ prefix, v: it.v });
                }
            }
        }
        return this.assemble(src, tail);
    }

    // 顶层: Limit | 序号 (可为 '+' 和/merge 系数)
    parse_top(): Expr {
        this.skip();
        if (this.t.slice(this.i, this.i + 5) === 'Limit') {
            this.i += 5;
            this.skip();
            if (this.i !== this.t.length) this.error();
            return INFINITY;
        }
        if (this.i >= this.t.length) this.error();
        const result = this.ordinal();
        this.skip();
        if (this.i !== this.t.length) this.error();
        return result;
    }
}

function zero(): Expr {
    return [0];
}

function one(): Expr {
    return [2, [], zero()];
}

function is_zero(e: Expr): boolean {
    return e[0] === 0;
}

function is_one(e: Expr) {
    return e[0] === 2 && e[1].length === 0 && is_zero(e[2]);
}

function infinity_FS(index: number): Expr {
    let list: VeblenList = [];
    for (let i = 0; i < index; i++) {
        list = [[list, one()]];
    }
    return [2, list, zero()];
}

function is_limit(e: Expr): boolean {
    if (is_infinity(e)) return true;
    if (e[0] === 0) return false;
    else if (e[0] === 1) return is_limit(e[1][e[1].length - 1]);
    return e[1].length !== 0 || !is_zero(e[2]);
}

function list_is_limit(l: VeblenList): boolean {
    if (l.length === 0) return false;
    const [p, v] = l[l.length - 1];
    return p.length > 0 || is_limit(v);
}

function prim_list(a: Expr): Expr[] {
    switch (a[0]) {
        case 0:
            return [];
        case 1:
            return a[1];
        case 2:
            return [a];
    }
}

function from_prim_list(a: Expr[]): Expr {
    if (a.length === 0) return [0];
    if (a.length === 1) return a[0];
    return [1, a];
}

function count_unbounded(l: VeblenList, bound: Expr): number {
    let result = 0;
    for (let [p, v] of l) {
        result += count_unbounded(p, bound);
        if (compare(v, bound) >= 0) result++;
    }
    return result;
}

function bounded_by(l: VeblenList, bound: Expr): boolean {
    return count_unbounded(l, bound) === 0;
}

function list_lex_compare(a: VeblenList, b: VeblenList): number {
    return lex_compare(a, b, tuple_lex_compare_by([list_lex_compare, compare]));
}

function compare(a: Expr, b: Expr): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }

    if (a[0] === 0 || b[0] === 0) {
        return boolean_compare(!is_zero(a), !is_zero(b));
    }
    if (a[0] === 1 || b[0] === 1) {
        return lex_compare(prim_list(a), prim_list(b), compare);
    }
    let list_cmp = list_lex_compare(a[1], b[1]);
    if (list_cmp === 0) return compare(a[2], b[2]);
    if (list_cmp < 0) [a, b] = [b, a];

    // in standard form, now (a < b) iff b contains an ordinal >= a

    return list_cmp * (bounded_by(b[1], a) && compare(b[2], a) < 0 ? 1 : -1);
}

function get_abnormal(l: VeblenList, current?: VeblenList): Expr | undefined {
    if (current === undefined) current = l;
    if (current.length === 0) return undefined;

    const [p, v] = current[current.length - 1];
    if (v[0] !== 2) return undefined;
    if (is_one(v)) return get_abnormal(l, p);

    if (list_lex_compare(l, v[1]) < 0 && count_unbounded(l, v) === 1) return v;
    return undefined;
}

function is_normal_tail(l: VeblenList, v: Expr): boolean {
    if (v[0] !== 2) return true;
    return list_lex_compare(l, v[1]) >= 0 || !bounded_by(l, v);
}

function normalized_phi(l: VeblenList, v: Expr): Expr {
    if (!is_normal_tail(l, v)) return v;
    if (is_zero(v)) {
        let abnormal = get_abnormal(l);
        if (abnormal !== undefined) return abnormal;
    }
    return [2, l, v];
}

function normalize(e: Expr): Expr {
    if (e[0] !== 2) throw new Error('illegal argument');
    return normalized_phi(e[1], e[2]);
}

const MARK: Expr = Symbol('mark') as any;

function replace_mark(template: Expr, value: Expr): Expr {
    function impl(t: Expr): Expr {
        if (t === MARK) return value;

        switch (t[0]) {
            case 0:
                return [0];
            case 1:
                return [1, t[1].map(impl)];
            case 2:
                return [2, impl_list(t[1]), impl(t[2])];
        }
    }

    function impl_list(l: VeblenList): VeblenList {
        const result = l.map(impl_entry);
        if (result.length > 0 && is_zero(result[result.length - 1][1])) result.pop();
        return result;
    }

    function impl_entry([p, v]: VeblenList[number]): VeblenList[number] {
        return [impl_list(p), impl(v)];
    }

    return impl(template);
}

type FS_Type = 'plain' | 'iterate';

function prev_list(l: VeblenList): VeblenList {
    const [p, v] = l[l.length - 1];
    const v_prev = FS(v, 0);
    if (is_zero(v_prev)) return l.slice(0, -1);
    return [...l.slice(0, -1), [p, v_prev]];
}

function create_template_list(l: VeblenList, index: number): [VeblenList, FS_Type] {
    const [p, v] = l[l.length - 1];
    if (is_limit(v)) return [[...l.slice(0, -1), [p, FS(v, index)]], 'plain'];
    const v_prev = FS(v, 0);
    let new_l = l.slice(0, -1);
    if (!is_zero(v_prev)) new_l.push([p, v_prev]);

    if (!list_is_limit(p)) {
        new_l.push([prev_list(p), MARK]);
        return [new_l, 'iterate'];
    }
    const [new_p, type] = create_template_list(p, index);
    new_l.push([new_p, one()]);
    return [new_l, type];
}

function create_template(l: VeblenList, index: number): [Expr, FS_Type] {
    if (!list_is_limit(l)) {
        const l_prev = prev_list(l);
        return [[2, l_prev, MARK], 'iterate'];
    }

    const [tl, type] = create_template_list(l, index);
    if (type === 'plain') return [[2, tl, MARK], 'plain'];
    else return [[2, tl, zero()], 'iterate'];
}

function FS(a: Expr, index: number): Expr {
    if (is_infinity(a)) return infinity_FS(index);

    if (a[0] === 0) return zero();
    if (a[0] === 1) {
        const tail_FS = FS(a[1][a[1].length - 1], index);
        return from_prim_list([...a[1].slice(0, -1), ...prim_list(tail_FS)]);
    }
    if (is_limit(a[2])) {
        const tail_FS = FS(a[2], index);
        return normalized_phi(a[1], tail_FS);
    }
    if (a[1].length === 0) {
        if (is_zero(a[2])) return zero();
        let tail_FS = FS(a[2], 0);
        let result: Expr = normalized_phi([], tail_FS);
        return from_prim_list(Array<Expr>(index).fill(result));
    }

    let initial_value: Expr;
    if (is_zero(a[2])) initial_value = zero();
    else initial_value = [1, [normalized_phi(a[1], FS(a[2], 0)), one()]];

    const [t, type] = create_template(a[1], index);
    if (type === 'plain') return normalize(replace_mark(t, initial_value));
    if (index === 0) return initial_value;
    let current = normalize(replace_mark(t, initial_value));
    for (let i = 1; i < index; i++) current = replace_mark(t, current);
    return current;
}

// note-11: extended_phi_bocf_bms_implementation_11.md。
// Ω-CNF 的系数仍是 φ Expr；ψ 森林只作为转换中间值，不改变记号内部表示。
type OmegaCnf = VeblenList;
export type PsiNode = [0 | 1, PsiForest];
export type PsiForest = PsiNode[];

const MAX_BUCHHOLZ_SIZE = 100_000;
const MAX_BUCHHOLZ_WORK = 1_000_000;
const MAX_BUCHHOLZ_DEPTH = 512;
const PSI_ONE: PsiNode = [0, []];
const PSI_OMEGA: PsiNode = [0, [PSI_ONE]];
const PSI_BIG_OMEGA: PsiNode = [1, []];
const BHO_MATRIX = [[], [1, 1], [2, 2]];
const BHO_IR: OCNDisplayIR = {
    type: 'psi',
    arg: {
        type: 'constant',
        display: 'ε',
        display_latex: '\\varepsilon ',
        sub: { type: 'sum', terms: [{ type: 'Omega' }, { type: 'number', value: 1 }] },
    },
};

function check_buchholz_size(size: number): void {
    if (!Number.isSafeInteger(size) || size > MAX_BUCHHOLZ_SIZE) {
        throw new RangeError('Veblen BOCF/BMS materialization resource limit exceeded');
    }
}

function check_buchholz_depth(depth: number): void {
    if (depth > MAX_BUCHHOLZ_DEPTH) throw new RangeError('Veblen BOCF/BMS nesting resource limit exceeded');
}

function append_ordinal_parts(result: Expr[], b: Expr): void {
    for (const term of prim_list(b)) {
        while (result.length && compare(result[result.length - 1], term) < 0) result.pop();
        check_buchholz_size(result.length + 1);
        result.push(term);
    }
}

function ordinal_add(a: Expr, b: Expr): Expr {
    const result = prim_list(a).slice();
    append_ordinal_parts(result, b);
    return from_prim_list(result);
}

// 左侧去掉一个 1：无限序数（包括 ω+1）保持原样。
function drop_left_one(a: Expr): Expr {
    const parts = prim_list(a);
    return parts.length && is_one(parts[0]) ? from_prim_list(parts.slice(1)) : a;
}

function left_difference(a: Expr, b: Expr): Expr {
    if (is_zero(b)) return a;
    const parts = prim_list(a);
    if (!parts.length || compare(parts[0], b) < 0) throw new Error('No ordinal left difference');
    return compare(parts[0], b) === 0 ? from_prim_list(parts.slice(1)) : a;
}

function embed_countable(a: Expr): OmegaCnf {
    return is_zero(a) ? [] : [[[], a]];
}

function omega_cnf_add(a: OmegaCnf, b: OmegaCnf): OmegaCnf {
    const result = a.slice();
    for (const [p, c] of b) {
        while (result.length && list_lex_compare(result[result.length - 1][0], p) < 0) result.pop();
        if (result.length && list_lex_compare(result[result.length - 1][0], p) === 0) {
            const [q, d] = result.pop()!;
            result.push([q, ordinal_add(d, c)]);
        } else {
            check_buchholz_size(result.length + 1);
            result.push([p, c]);
        }
    }
    return result;
}

function omega_cnf_drop_left_one(a: OmegaCnf): OmegaCnf {
    return a.length === 1 && !a[0][0].length ? embed_countable(drop_left_one(a[0][1])) : a;
}

function multiply_left_omega(a: OmegaCnf): OmegaCnf {
    const unit = embed_countable(one());
    return a.map(([p, c]) => [omega_cnf_add(unit, p), c]);
}

function divide_left_omega(a: OmegaCnf): [OmegaCnf, Expr] {
    const last = a[a.length - 1],
        has_tail = last && !last[0].length;
    return [
        (has_tail ? a.slice(0, -1) : a).map(([p, c]) => [omega_cnf_drop_left_one(p), c]),
        has_tail ? last[1] : zero(),
    ];
}

function critical_class(b: OmegaCnf, lambda: Expr): number {
    if (!b.length) return compare(zero(), lambda);
    if (b.length === 1 && !b[0][0].length) return compare(b[0][1], lambda);
    if (bounded_by(b, lambda)) return -1;
    const [p, c] = b[b.length - 1],
        kind = critical_class(p, lambda);
    // 相等沿末尾单位系数地址递归传递，不能只检查 p = lambda。
    return bounded_by(b.slice(0, -1), lambda) && ((is_one(c) && kind === 0) || (kind < 0 && compare(c, lambda) === 0))
        ? 0
        : 1;
}

function compare_psi_node(a: PsiNode, b: PsiNode): number {
    return Math.sign(a[0] - b[0]) || compare_psi_forest(a[1], b[1]);
}

export function compare_psi_forest(a: PsiForest, b: PsiForest): number {
    return lex_compare(a, b, compare_psi_node);
}

function create_psi_standard_check(): (forest: PsiForest) => boolean {
    const checked = new WeakSet<PsiForest>();
    let operations = 0;
    function work(): void {
        if (++operations > MAX_BUCHHOLZ_WORK)
            throw new RangeError('Veblen BOCF/BMS validation resource limit exceeded');
    }
    function in_closure(forest: PsiForest, label: number, bound: PsiForest): boolean {
        for (const [i, child] of forest) {
            work();
            if (i >= label && (compare_psi_forest(child, bound) >= 0 || !in_closure(child, label, bound))) return false;
        }
        return true;
    }
    function is_standard(forest: PsiForest, depth: number = 0): boolean {
        check_buchholz_depth(depth);
        if (checked.has(forest)) return true;
        check_buchholz_size(forest.length);
        for (let k = 0; k < forest.length; k++) {
            work();
            const [label, child] = forest[k];
            if (
                !is_standard(child, depth + 1) ||
                !in_closure(child, label, child) ||
                (k > 0 && compare_psi_node(forest[k - 1], forest[k]) < 0)
            )
                return false;
        }
        checked.add(forest);
        return true;
    }
    return is_standard;
}

function require_countable_psi(forest: PsiForest): void {
    if (forest.some(([label]) => label !== 0) || !create_psi_standard_check()(forest)) {
        throw new Error('Outside the countable standard Buchholz domain');
    }
}

// 缓存属于单次转换，键为 AST；不使用可能发生碰撞的显示字符串。
function create_psi_conversion() {
    const arguments_cache = new WeakMap<Expr, OmegaCnf>();
    const decoded_cache = new WeakMap<PsiForest, OmegaCnf>();
    const encoded_cache = new WeakMap<OmegaCnf, PsiForest>();
    const values_cache = new WeakMap<OmegaCnf, Expr>();
    let operations = 0;
    function work(): void {
        if (++operations > MAX_BUCHHOLZ_WORK)
            throw new RangeError('Veblen BOCF/BMS conversion resource limit exceeded');
    }
    function decode_psi_zero(a: OmegaCnf): Expr {
        work();
        const cached = values_cache.get(a);
        if (cached) return cached;
        if (!a.length) return one();
        const [b, c] = a[a.length - 1],
            lambda = drop_left_one(decode_psi_zero(a.slice(0, -1)));
        const kind = critical_class(b, lambda),
            rho = kind < 0 ? lambda : kind === 0 ? one() : zero();
        const result = normalized_phi(b, drop_left_one(ordinal_add(rho, c)));
        values_cache.set(a, result);
        return result;
    }
    function list_parameters(b: OmegaCnf, result: Expr[]): void {
        for (const [p, c] of b) {
            work();
            result.push(c);
            list_parameters(p, result);
        }
    }
    function phi_to_argument(a: Expr): OmegaCnf {
        work();
        const cached = arguments_cache.get(a);
        if (cached) return cached;
        if (a[0] !== 2) throw new Error('Expected a principal φ expression');
        const b = a[1],
            alpha = a[2],
            parameters = [alpha];
        list_parameters(b, parameters);
        let prefix: OmegaCnf = [];
        for (const parameter of parameters)
            for (const term of prim_list(parameter)) {
                work();
                const candidate = phi_to_argument(term).filter(([p]) => list_lex_compare(p, b) > 0);
                if (list_lex_compare(candidate, prefix) > 0) prefix = candidate;
            }
        const lambda = drop_left_one(decode_psi_zero(prefix)),
            kind = critical_class(b, lambda);
        const c = kind < 0 ? left_difference(alpha, lambda) : kind === 0 ? alpha : ordinal_add(one(), alpha);
        const result = is_zero(c) ? prefix : omega_cnf_add(prefix, [[b, c]]);
        arguments_cache.set(a, result);
        return result;
    }
    function encode_unbounded(a: OmegaCnf): PsiForest {
        work();
        const cached = encoded_cache.get(a);
        if (cached) return cached;
        const result: PsiForest = [];
        for (const [p, c] of a) {
            if (!p.length) {
                for (const node of encode_countable(c)) {
                    check_buchholz_size(result.length + 1);
                    result.push(node);
                }
                continue;
            }
            for (const term of prim_list(c)) {
                if (term[0] !== 2) throw new Error('Expected a principal Ω-CNF coefficient');
                const logarithm = term[1].length ? term : term[2];
                const argument = omega_cnf_add(
                    multiply_left_omega(omega_cnf_drop_left_one(p)),
                    embed_countable(logarithm),
                );
                check_buchholz_size(result.length + 1);
                result.push([1, encode_unbounded(argument)]);
            }
        }
        encoded_cache.set(a, result);
        return result;
    }
    function encode_countable(a: Expr): PsiForest {
        work();
        check_buchholz_size(prim_list(a).length);
        return prim_list(a).map((p) => [0, encode_unbounded(phi_to_argument(p))]);
    }
    function decode_unbounded(forest: PsiForest): OmegaCnf {
        work();
        const cached = decoded_cache.get(forest);
        if (cached) return cached;
        let result: OmegaCnf = [];
        for (let k = 0; k < forest.length; k++) {
            work();
            const [label, child] = forest[k];
            // 标准森林的可数节点构成尾部，统一累加其主项，避免逐项复制长系数。
            if (label === 0) {
                result = omega_cnf_add(result, embed_countable(decode_countable(forest.slice(k))));
                break;
            }
            let end = k + 1;
            while (end < forest.length && compare_psi_node(forest[k], forest[end]) === 0) {
                work();
                end++;
            }
            const value = decode_unbounded(child),
                omega: OmegaCnf = [[embed_countable(one()), one()]];
            const [b, delta] = divide_left_omega(omega_cnf_add(omega, value));
            const coefficient = from_prim_list(Array<Expr>(end - k).fill(normalized_phi([], delta)));
            result = omega_cnf_add(result, [[b, coefficient]]);
            k = end - 1;
        }
        decoded_cache.set(forest, result);
        return result;
    }
    function decode_countable(forest: PsiForest): Expr {
        const result: Expr[] = [];
        for (const [, child] of forest) append_ordinal_parts(result, decode_psi_zero(decode_unbounded(child)));
        return from_prim_list(result);
    }
    return { encode_countable, decode_countable };
}

export function encode_countable(expr: Expr): PsiForest {
    if (is_infinity(expr)) throw new Error('Limit is not a finite Buchholz expression');
    return create_psi_conversion().encode_countable(expr);
}

export function decode_countable(forest: PsiForest): Expr {
    require_countable_psi(forest);
    return create_psi_conversion().decode_countable(forest);
}

function psi_to_bocf_ir(forest: PsiForest): OCNDisplayIR {
    let nodes = 0;
    function impl(t: PsiForest, depth: number): OCNDisplayIR {
        check_buchholz_depth(depth);
        return merge_ocn_sum(
            t.map(([label, child]): OCNDisplayIR => {
                check_buchholz_size(++nodes);
                if (label === 0 && !child.length) return { type: 'number', value: 1 };
                if (label === 0 && compare_psi_forest(child, [PSI_ONE]) === 0) return { type: 'omega' };
                if (label === 1 && !child.length) return { type: 'Omega' };
                return {
                    type: 'psi',
                    sub: label === 1 ? { type: 'number', value: 1 } : undefined,
                    arg: impl(child, depth + 1),
                };
            }),
        );
    }
    return impl(forest, 0);
}

function display_bocf(expr: Expr, type: DisplayType): string {
    return display_OCN_IR(is_infinity(expr) ? BHO_IR : psi_to_bocf_ir(encode_countable(expr)), type);
}

function psi_to_bms(forest: PsiForest): number[][] {
    const result: number[][] = [];
    function visit(t: PsiForest, depth: number): void {
        check_buchholz_depth(depth);
        for (const [label, child] of t) {
            check_buchholz_size(result.length + 1);
            result.push(label ? [depth, label] : depth ? [depth] : []);
            visit(child, depth + 1);
        }
    }
    visit(forest, 0);
    return result;
}

function display_bms(expr: Expr): string {
    return display_bm(is_infinity(expr) ? BHO_MATRIX : psi_to_bms(encode_countable(expr)));
}

function from_bms(text: string): Expr {
    if (text.trim() === 'Limit') return INFINITY;
    const matrix: number[][] = [],
        column_pattern = /\(\s*(?:\d+(?:\s*,\s*\d+)*)?\s*\)/y;
    let offset = 0;
    while (offset < text.length) {
        while (offset < text.length && /\s/.test(text[offset])) offset++;
        if (offset === text.length) break;
        column_pattern.lastIndex = offset;
        const match = column_pattern.exec(text);
        if (!match) throw new Error('Invalid BMS column at ' + offset);
        const body = match[0].slice(1, -1).trim(),
            col = body ? body.split(',').map(Number) : [];
        if (col.some((n) => !Number.isSafeInteger(n) || n < 0))
            throw new Error('BMS entries must be nonnegative safe integers');
        while (col.length && col[col.length - 1] === 0) col.pop();
        check_buchholz_size(matrix.length + 1);
        matrix.push(col);
        offset = column_pattern.lastIndex;
    }
    // 必须在二标签检查之前识别唯一的 BHO 边界，且已验证完整文本和所有数字。
    if (
        matrix.length === 3 &&
        matrix.every((col, i) => col.length === BHO_MATRIX[i].length && col.every((n, j) => n === BHO_MATRIX[i][j]))
    )
        return INFINITY;
    const roots: PsiForest = [],
        stack: PsiNode[] = [];
    for (const col of matrix) {
        const depth = col[0] ?? 0,
            label = col[1] ?? 0;
        if (col.length > 2 || (label !== 0 && label !== 1)) throw new Error('Outside the two-label BMS domain');
        if (depth > stack.length) throw new Error('Invalid BMS preorder depth');
        check_buchholz_depth(depth);
        stack.length = depth;
        const node: PsiNode = [label, []];
        if (depth === 0) roots.push(node);
        else stack[depth - 1][1].push(node);
        stack.push(node);
    }
    return decode_countable(roots);
}

function add_psi_forests(a: PsiForest, b: PsiForest): PsiForest {
    const result = a.slice();
    for (const node of b) {
        while (result.length && compare_psi_node(result[result.length - 1], node) < 0) result.pop();
        check_buchholz_size(result.length + 1);
        result.push(node);
    }
    return result;
}

function multiply_psi_finite(forest: PsiForest, count: number): PsiForest {
    if (!count || !forest.length) return [];
    // 每次右加会吸收低于首主项的尾部；仅最后一次保留该尾部。
    let leading = 1;
    while (leading < forest.length && compare_psi_node(forest[leading], forest[0]) === 0) leading++;
    const copies = leading * count;
    check_buchholz_size(copies + forest.length - leading);
    return Array<PsiNode>(copies).fill(forest[0]).concat(forest.slice(leading));
}

class BocfParser {
    private offset = 0;
    private depth = 0;
    private is_standard = create_psi_standard_check();

    constructor(private text: string) {}

    private error(): never {
        throw new Error('Invalid BOCF input at ' + this.offset + ': ' + this.text);
    }

    private skip(): void {
        while (this.offset < this.text.length && /\s/.test(this.text[this.offset])) this.offset++;
    }

    private take(token: string): boolean {
        this.skip();
        if (!this.text.startsWith(token, this.offset)) return false;
        this.offset += token.length;
        return true;
    }

    private natural(): number {
        this.skip();
        const start = this.offset;
        while (this.offset < this.text.length && /[0-9]/.test(this.text[this.offset])) this.offset++;
        const value = Number(this.text.slice(start, this.offset));
        if (start === this.offset || !Number.isSafeInteger(value)) this.error();
        return value;
    }

    private atom(): PsiForest {
        this.skip();
        if (/[0-9]/.test(this.text[this.offset] ?? '')) {
            const n = this.natural();
            check_buchholz_size(n);
            return Array<PsiNode>(n).fill(PSI_ONE);
        }
        if (this.take('ω') || this.take('omega')) return [PSI_OMEGA];
        if (this.take('Ω') || this.take('Omega')) return [PSI_BIG_OMEGA];
        if (this.take('ψ') || this.take('psi')) {
            let label: 0 | 1 = 0;
            if (this.take('[')) {
                this.skip();
                const start = this.offset,
                    value = this.natural();
                if (this.offset - start !== 1 || (value !== 0 && value !== 1) || !this.take(']')) this.error();
                label = value;
            }
            if (!this.take('(')) this.error();
            const child = this.nested_sum();
            if (!this.take(')')) this.error();
            const forest: PsiForest = [[label, child]];
            // 每个 ψ 先检查 G 条件，后续吸收或乘零不能掩盖非法子项。
            if (!this.is_standard(forest)) throw new Error('Nonstandard Buchholz ψ expression');
            return forest;
        }
        if (this.take('(')) {
            const result = this.nested_sum();
            if (!this.take(')')) this.error();
            return result;
        }
        this.error();
    }

    private nested_sum(): PsiForest {
        check_buchholz_depth(++this.depth);
        const result = this.sum();
        this.depth--;
        return result;
    }

    private product(): PsiForest {
        const value = this.atom();
        return this.take('·') || this.take('*') ? multiply_psi_finite(value, this.natural()) : value;
    }

    private sum(): PsiForest {
        let result = this.product();
        while (this.take('+')) result = add_psi_forests(result, this.product());
        return result;
    }

    parse(): Expr {
        const result = this.sum();
        this.skip();
        if (this.offset !== this.text.length) this.error();
        return decode_countable(result);
    }
}

function from_bocf(text: string): Expr {
    if (/^(?:Limit|BHO|ψ\s*(?:\[\s*0\s*\]\s*)?\(\s*ε\s*\[\s*Ω\s*\+\s*1\s*\]\s*\))$/.test(text.trim())) return INFINITY;
    return new BocfParser(text).parse();
}

export const VeblenPhi: NotationDefinition<Expr> = {
    id: 'veblen-phi',
    name: "Extended Veblen's φ Function",
    simple_name: 'BHO φ',
    category_id: category_veblen.id,
    is_limit,
    ...FS_default_LNZ_variant(FS, compare, is_infinity, infinity_FS, is_limit, (e) => display(e, 'plain')),
    compare,
    display: {
        plain: bind2(display, 'plain'),
        html: bind2(display, 'html'),
        latex: bind2(display, 'latex'),
        from_display,
    },
    display_equiv: {
        separate: {
            plain: bind2(display_separate, 'plain'),
            html: bind2(display_separate, 'html'),
            latex: bind2(display_separate, 'latex'),
            from_display,
            name: { id: 'display.veblen-separate' },
        },
        bocf: {
            plain: (e) => display_bocf(e, 'plain'),
            html: (e) => display_bocf(e, 'html'),
            latex: (e) => display_bocf(e, 'latex'),
            from_display: from_bocf,
            name: 'BOCF',
        },
        bms: {
            plain: display_bms,
            html: display_bms,
            latex: display_bms,
            from_display: from_bms,
            name: 'BMS',
        },
    },
    init: () => [INFINITY, zero()],
};
