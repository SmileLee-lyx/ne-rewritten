/**
 * e0MN(e0 Mountain Notation)记号定义。
 *
 * 由 `other-notation/e0MN.js`(原作者 test_alpha0 的 NER 自定义记号脚本)改写而来:
 * 函数命名与算法逻辑与原文件严格一致, 仅补充类型标注;
 * 唯一的行为性改动是按项目风格把极限哨兵由字符串 `'Limit'` 改为 `Infinity as any`,
 * 并把原 `makeLimit` 换成本项目的 `infinity_FS`(见下方说明)。
 */
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import type { ColorSpec, Diagram, Element, ExtraText } from '@/core/diagram_types.ts';
import { draw_mountain_diagram, type MountainNode, type MountainShape } from '@/notations/draw_mountain_diagram.ts';
import type { MountainViewSource } from '@/notations/mountain_view.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';

// Ord = [{ exp: Ord, coeff: positive integer }]; zero = []。
type Term = { exp: Ord; coeff: number };
type Ord = Term[];
type Entry = { a: number; x: Ord };
type Column = Entry[];
type Expr = Column[];

const INFINITY: Expr = Infinity as any;

function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

/** 极限的基本列: 第 index 项为 ()(1:ω^^index)(原文件由 `makeLimit` 构造, 现按项目风格并入此处)。 */
function infinity_FS(index: number): Expr {
    return [[], [{ a: 1, x: omegaTower(index) }]];
}

function cloneOrd(a: Ord): Ord {
    return a.map((t) => ({ exp: cloneOrd(t.exp), coeff: t.coeff }));
}

function cloneCol(c: Column): Column {
    return c.map((e) => ({ a: e.a, x: cloneOrd(e.x) }));
}

function cloneExpr(e: Expr): Expr {
    return e.map(cloneCol);
}

function ordNat(n: number): Ord {
    if (!Number.isSafeInteger(n) || n < 0) throw Error(`Natural number expected: ${n}`);
    return n ? [{ exp: [], coeff: n }] : [];
}

function ordOne(): Ord {
    return ordNat(1);
}

function isZero(a: Ord): boolean {
    return a.length === 0;
}

function isOne(a: Ord): boolean {
    return a.length === 1 && isZero(a[0].exp) && a[0].coeff === 1;
}

function isPositive(a: Ord): boolean {
    return a.length > 0;
}

function ordCompare(a: Ord, b: Ord): number {
    for (let i = 0, n = Math.min(a.length, b.length); i < n; i++) {
        const c = ordCompare(a[i].exp, b[i].exp);
        if (c) return c;
        if (a[i].coeff !== b[i].coeff) return a[i].coeff > b[i].coeff ? 1 : -1;
    }
    return Math.sign(a.length - b.length);
}

function ordEq(a: Ord, b: Ord): boolean {
    return ordCompare(a, b) === 0;
}

function ordIsSuccessor(a: Ord): boolean {
    return isPositive(a) && isZero(a[a.length - 1].exp);
}

function ordIsStandard(a: Ord): boolean {
    return (
        Array.isArray(a) &&
        a.every(
            (t, i) =>
                Number.isSafeInteger(t.coeff) &&
                t.coeff > 0 &&
                ordIsStandard(t.exp) &&
                (!i || ordCompare(a[i - 1].exp, t.exp) > 0),
        )
    );
}

// Ordinal addition and the right difference beta-alpha defined by alpha+gamma=beta.
// These operate on standard Cantor-normal-form e0 ordinals.
function ordAdd(a: Ord, b: Ord): Ord {
    if (!b.length) return cloneOrd(a);
    const lead = b[0].exp;
    let i = 0;
    while (i < a.length && ordCompare(a[i].exp, lead) > 0) i++;
    const out = cloneOrd(a.slice(0, i));
    if (i < a.length && ordEq(a[i].exp, lead)) {
        out.push({ exp: cloneOrd(lead), coeff: a[i].coeff + b[0].coeff });
        for (let j = 1; j < b.length; j++) out.push({ exp: cloneOrd(b[j].exp), coeff: b[j].coeff });
    } else {
        for (const t of b) out.push({ exp: cloneOrd(t.exp), coeff: t.coeff });
    }
    return out;
}

function ordRightDiff(a: Ord, b: Ord): Ord {
    const cmp = ordCompare(a, b);
    if (cmp > 0) throw Error('Ordinal right difference requires the second ordinal to be at least the first');
    if (!cmp) return [];
    let i = 0;
    while (i < a.length && i < b.length && ordEq(a[i].exp, b[i].exp) && a[i].coeff === b[i].coeff) i++;
    if (i === a.length) return cloneOrd(b.slice(i));
    if (i >= b.length) throw Error('Ordinal right difference does not exist');
    const ec = ordCompare(a[i].exp, b[i].exp);
    if (ec < 0) return cloneOrd(b.slice(i));
    if (ec === 0 && a[i].coeff < b[i].coeff) {
        return [{ exp: cloneOrd(b[i].exp), coeff: b[i].coeff - a[i].coeff }, ...cloneOrd(b.slice(i + 1))];
    }
    throw Error('Ordinal right difference does not exist');
}

// e0 fundamental sequence, following cases 1--6 recursively.
function ordFS(src: Ord, m: number): Ord {
    if (!Number.isSafeInteger(m) || m < 0) throw Error('FS index must be a non-negative integer');
    if (!src.length) return [];

    const a = cloneOrd(src),
        last = a[a.length - 1];
    if (isZero(last.exp)) {
        // cases 1, 2
        if (last.coeff === 1) a.pop();
        else last.coeff--;
        return a;
    }

    const exp = cloneOrd(last.exp),
        coeff = last.coeff;
    a.pop();
    if (coeff > 1) a.push({ exp, coeff: coeff - 1 });
    const nextExp = ordFS(exp, m);
    if (ordIsSuccessor(exp)) {
        // cases 3, 4
        if (m) a.push({ exp: nextExp, coeff: m });
    } else {
        // cases 5, 6
        a.push({ exp: nextExp, coeff: 1 });
    }
    return a;
}

function omegaPower(exp: Ord): Ord {
    return [{ exp: cloneOrd(exp), coeff: 1 }];
}

function omegaTower(n: number): Ord {
    if (!Number.isSafeInteger(n) || n < 0) throw Error('Tower height must be a non-negative integer');
    let r = ordOne();
    while (n--) r = omegaPower(r);
    return r;
}

// In rfl: visible positive integers inside e0 shift iff q > cutoff.
function shiftOrdNumbers(a: Ord, cutoff: number, d: number): Ord {
    return a.map((t) => {
        if (isZero(t.exp)) return { exp: [], coeff: t.coeff > cutoff ? t.coeff + d : t.coeff };
        return {
            exp: isOne(t.exp) ? cloneOrd(t.exp) : shiftOrdNumbers(t.exp, cutoff, d),
            coeff: t.coeff !== 1 && t.coeff > cutoff ? t.coeff + d : t.coeff,
        };
    });
}

// ---------- e0 parser / display ----------
function normalizeOmega(s: string): string {
    return s.replace(/omega/gi, 'ω').replace(/w/g, 'ω');
}

function parseOrd(text: string, allowZero = false): Ord {
    const s = normalizeOmega(String(text)).replace(/\s+/g, '');
    const tower = s.match(/^ω\^\^(\d+)$/);
    if (tower) return omegaTower(Number(tower[1]));
    let i = 0;

    const fail = (msg: string): never => {
        throw Error(`Illegal e0 expression "${text}": ${msg} at position ${i}`);
    };
    const number = (): number => {
        const start = i;
        while (/\d/.test(s[i] || '')) i++;
        if (start === i) fail('number expected');
        const n = Number(s.slice(start, i));
        if (!Number.isSafeInteger(n)) fail('number is too large');
        return n;
    };

    function expr(end?: string): Ord {
        if (s[i] === '0' && (i + 1 === s.length || (end && s[i + 1] === end))) {
            i++;
            return [];
        }
        const out: Ord = [];
        while (i < s.length && (!end || s[i] !== end)) {
            out.push(term());
            if (s[i] !== '+') break;
            i++;
            if (i >= s.length || (end && s[i] === end)) fail('term expected after "+"');
        }
        return out;
    }

    function exponent(): Ord {
        if (i >= s.length) fail('exponent expected');
        const open = s[i];
        if (open === '{' || open === '(') {
            const close = open === '{' ? '}' : ')';
            i++;
            if (s[i] === close) {
                i++;
                return [];
            }
            const e = expr(close);
            if (s[i] !== close) fail(`missing "${close}"`);
            i++;
            return e;
        }
        if (/\d/.test(s[i])) return ordNat(number());
        if (s[i] === 'ω') return [term()];
        return fail('bad exponent');
    }

    function term(): Term {
        if (i >= s.length) fail('term expected');
        if (/\d/.test(s[i])) {
            const n = number();
            if (n <= 0) fail('positive integer expected');
            return { exp: [], coeff: n };
        }
        if (s[i] !== 'ω') fail('term must start with a positive integer or ω');
        i++;
        let exp: Ord = ordOne();
        if (s[i] === '^') {
            i++;
            exp = exponent();
        }
        let coeff = 1;
        if (/\d/.test(s[i] || '')) {
            coeff = number();
            if (coeff <= 0) fail('positive coefficient expected');
        }
        return { exp, coeff };
    }

    if (!s) fail('empty expression');
    if (s === '0') {
        if (allowZero) return [];
        fail('row label must be positive');
    }
    const out = expr();
    if (i !== s.length) fail(`unexpected character "${s[i]}"`);
    if (!allowZero && !out.length) fail('row label must be positive');
    return out;
}

type OrdDisplayMode = 'plain' | 'html' | 'latex';

function ordTo(a: Ord, mode: OrdDisplayMode): string {
    if (!a.length) return '0';
    return a
        .map((t) => {
            if (isZero(t.exp)) return String(t.coeff);
            let q = mode === 'latex' ? '\\omega' : 'ω';
            if (!isOne(t.exp)) {
                const e = ordTo(t.exp, mode);
                q += mode === 'html' ? `<sup>${e}</sup>` : `^{${e}}`;
            }
            return q + (t.coeff === 1 ? '' : t.coeff);
        })
        .join('+');
}

function ordToPlain(a: Ord): string {
    return ordTo(a, 'plain');
}

function ordToHTML(a: Ord): string {
    return ordTo(a, 'html');
}

function ordToLatex(a: Ord): string {
    return ordTo(a, 'latex');
}

function towerIndex(a: Ord): number {
    if (isOne(a)) return 0;
    if (a.length !== 1 || a[0].coeff !== 1 || isZero(a[0].exp)) return -1;
    const k = towerIndex(a[0].exp);
    return k < 0 ? -1 : k + 1;
}

// ---------- e0MN parse / display ----------
function entryCompare(p: Entry, q: Entry): number {
    return p.a === q.a ? ordCompare(p.x, q.x) : p.a > q.a ? 1 : -1;
}

function arrayLexCompare<T>(a: T[], b: T[], cmp: (x: T, y: T) => number): number {
    for (let i = 0, n = Math.min(a.length, b.length); i < n; i++) {
        const c = cmp(a[i], b[i]);
        if (c) return c;
    }
    return Math.sign(a.length - b.length);
}

function colCompare(a: Column, b: Column): number {
    return arrayLexCompare(a, b, entryCompare);
}

function exprCompare(a: Expr, b: Expr): number {
    return a === INFINITY ? (b === INFINITY ? 0 : 1) : b === INFINITY ? -1 : arrayLexCompare(a, b, colCompare);
}

function isLegalColumn(c: Column, colNo: number): boolean {
    return c.every(
        (e, i) =>
            Number.isSafeInteger(e.a) &&
            e.a > 0 &&
            e.a < colNo &&
            isPositive(e.x) &&
            (!i || (c[i - 1].a > e.a && ordCompare(c[i - 1].x, e.x) < 0)),
    );
}

function isLegalExpr(e: Expr): boolean {
    return Array.isArray(e) && e.every((c: Column, i: number) => Array.isArray(c) && isLegalColumn(c, i + 1));
}

function isLimitExpr(e: Expr): boolean {
    return is_infinity(e) || (isLegalExpr(e) && !!e.length && !!e[e.length - 1].length);
}

function predecessor(e: Expr): Expr {
    return e.length ? cloneExpr(e.slice(0, -1)) : [];
}

function exprLimitIndex(e: Expr): number {
    return e.length === 2 && !e[0].length && e[1].length === 1 && e[1][0].a === 1 ? towerIndex(e[1][0].x) : -1;
}

function splitTop(s: string, sep: string): string[] {
    const out: string[] = [];
    let start = 0,
        p = 0,
        b = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '(') p++;
        else if (ch === ')') p--;
        else if (ch === '{') b++;
        else if (ch === '}') b--;
        else if (ch === sep && !p && !b) {
            out.push(s.slice(start, i));
            start = i + 1;
        }
    }
    out.push(s.slice(start));
    return out;
}

function topColon(s: string): number {
    let p = 0,
        b = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '(') p++;
        else if (ch === ')') p--;
        else if (ch === '{') b++;
        else if (ch === '}') b--;
        else if (ch === ':' && !p && !b) return i;
    }
    return -1;
}

function parseColumn(s: string): Column {
    if (!s.trim()) return [];
    return splitTop(s, ';').map((piece) => {
        const colon = topColon(piece);
        if (colon < 0) throw Error(`Entry must have form a:x; got: ${piece}`);
        const aText = piece.slice(0, colon).trim(),
            xText = piece.slice(colon + 1).trim();
        if (!/^\d+$/.test(aText)) throw Error(`Left-leg column label must be a positive integer: ${aText}`);
        const a = Number(aText);
        if (!Number.isSafeInteger(a) || a <= 0)
            throw Error(`Left-leg column label must be a positive integer: ${aText}`);
        return { a, x: parseOrd(xText) };
    });
}

function parseExpr(text: string): Expr {
    const raw = String(text).trim();
    if (!raw || raw === '0' || raw === '∅') return [];
    if (/^Limit$/i.test(raw)) return INFINITY;
    const lim = raw.match(/^Limit\s*\[\s*(\d+)\s*\]$/i);
    if (lim) return infinity_FS(Number(lim[1]));

    const out: Expr = [];
    for (let i = 0; i < raw.length;) {
        while (/\s/.test(raw[i] || '')) i++;
        if (i >= raw.length) break;
        if (raw[i] !== '(') throw Error(`Expected "(" at position ${i} in e0MN expression`);
        let p = 0,
            b = 0,
            end = -1;
        for (let j = i; j < raw.length; j++) {
            const ch = raw[j];
            if (ch === '(') p++;
            else if (ch === ')') {
                p--;
                if (!p && !b) {
                    end = j;
                    break;
                }
            } else if (ch === '{') b++;
            else if (ch === '}') b--;
        }
        if (end < 0) throw Error('Unmatched "(" in e0MN expression');
        out.push(parseColumn(raw.slice(i + 1, end)));
        i = end + 1;
    }
    return out;
}

function colTo(c: Column, mode: OrdDisplayMode): string {
    if (!c.length) return mode === 'latex' ? '\\left(\\right)' : '()';
    const body = c.map((e) => `${e.a}:${ordTo(e.x, mode)}`).join(';');
    return mode === 'latex' ? `\\left(${body}\\right)` : `(${body})`;
}

function exprToPlain(e: Expr): string {
    return is_infinity(e) ? 'Limit' : e.map((c) => colTo(c, 'plain')).join('');
}

function exprToHTML(e: Expr): string {
    return is_infinity(e) ? 'Limit' : e.map((c) => colTo(c, 'html')).join('');
}

function exprToLatex(e: Expr): string {
    return is_infinity(e) ? '\\operatorname{Limit}' : e.map((c) => colTo(c, 'latex')).join('');
}

function exprToLimit(e: Expr, mode: OrdDisplayMode): string {
    if (is_infinity(e)) return mode === 'latex' ? '\\operatorname{Limit}' : 'Limit';
    const n = exprLimitIndex(e);
    if (n < 0) return mode === 'plain' ? exprToPlain(e) : mode === 'html' ? exprToHTML(e) : exprToLatex(e);
    return mode === 'latex' ? `\\operatorname{Limit}[${n}]` : `Limit[${n}]`;
}

// Equivalent display "行高差": keep the first row ordinal, then display the
// unique gamma with x_prev + gamma = x_cur.  In HTML/LaTeX gamma is a superscript.
function rowHeightEntry(a: number, delta: Ord, mode: OrdDisplayMode): string {
    if (isOne(delta)) return String(a);
    const d = ordTo(delta, mode);
    if (mode === 'html') return `${a}<sup>${d}</sup>`;
    if (mode === 'latex') return `${a}^{${d}}`;
    return `${a}:${d}`;
}

function rowHeightColTo(c: Column, mode: OrdDisplayMode): string {
    if (!c.length) return mode === 'latex' ? '\\left(\\right)' : '()';
    let prev: Ord = [];
    const body = c
        .map((e, i) => {
            const delta = i ? ordRightDiff(prev, e.x) : cloneOrd(e.x);
            if (i && !ordEq(ordAdd(prev, delta), e.x))
                throw Error('Internal error: row-height difference is incorrect');
            prev = e.x;
            return rowHeightEntry(e.a, delta, mode);
        })
        .join(',');
    return mode === 'latex' ? `\\left(${body}\\right)` : `(${body})`;
}

function exprToRowHeightPlain(e: Expr): string {
    return is_infinity(e) ? 'Limit' : e.map((c) => rowHeightColTo(c, 'plain')).join('');
}

function exprToRowHeightHTML(e: Expr): string {
    return is_infinity(e) ? 'Limit' : e.map((c) => rowHeightColTo(c, 'html')).join('');
}

function exprToRowHeightLatex(e: Expr): string {
    return is_infinity(e) ? '\\operatorname{Limit}' : e.map((c) => rowHeightColTo(c, 'latex')).join('');
}

function parseRowHeightColumn(s: string): Column {
    if (!s.trim()) return [];
    let prev: Ord = [];
    return splitTop(s, ',').map((rawPiece, i) => {
        const piece = rawPiece.trim();
        if (!piece) throw Error('Empty entry in 行高差 column');
        const colon = topColon(piece);
        const aText = (colon < 0 ? piece : piece.slice(0, colon)).trim();
        if (!/^\d+$/.test(aText)) throw Error(`Left-leg column label must be a positive integer: ${aText}`);
        const a = Number(aText);
        if (!Number.isSafeInteger(a) || a <= 0)
            throw Error(`Left-leg column label must be a positive integer: ${aText}`);
        const delta = colon < 0 ? ordOne() : parseOrd(piece.slice(colon + 1).trim());
        const x = i ? ordAdd(prev, delta) : cloneOrd(delta);
        prev = x;
        return { a, x };
    });
}

function parseRowHeightExpr(text: string): Expr {
    const raw = String(text).trim();
    if (!raw || raw === '0' || raw === '∅') return [];
    if (/^Limit$/i.test(raw)) return INFINITY;
    const lim = raw.match(/^Limit\s*\[\s*(\d+)\s*\]$/i);
    if (lim) return infinity_FS(Number(lim[1]));

    const out: Expr = [];
    for (let i = 0; i < raw.length;) {
        while (/\s/.test(raw[i] || '')) i++;
        if (i >= raw.length) break;
        if (raw[i] !== '(') throw Error(`Expected "(" at position ${i} in 行高差 expression`);
        let p = 0,
            b = 0,
            end = -1;
        for (let j = i; j < raw.length; j++) {
            const ch = raw[j];
            if (ch === '(') p++;
            else if (ch === ')') {
                p--;
                if (!p && !b) {
                    end = j;
                    break;
                }
            } else if (ch === '{') b++;
            else if (ch === '}') b--;
        }
        if (end < 0) throw Error('Unmatched "(" in 行高差 expression');
        out.push(parseRowHeightColumn(raw.slice(i + 1, end)));
        i = end + 1;
    }
    return out;
}

// ---------- down / rfl / e0MN fundamental sequence ----------
function down(src: Expr): Expr {
    if (!isLimitExpr(src)) return predecessor(src);
    const e = cloneExpr(src),
        l = e.length,
        last = e[l - 1],
        n = last.length;
    const { a: an, x: xn } = last[n - 1],
        d = l - an;
    if (d <= 0) throw Error('Illegal e0MN expression: d <= 0');

    const source = e[an - 1];
    let s = 0;
    while (s < source.length && ordCompare(source[s].x, xn) < 0) s++;

    const newLast = last.slice(0, -1).map((z) => ({ a: z.a, x: cloneOrd(z.x) }));
    const xnL = ordFS(xn, l - 1); // exactly x_n[l-1]
    const omit = isOne(xn) || (n > 1 && ordCompare(xnL, last[n - 2].x) <= 0);
    if (!omit && isPositive(xnL)) newLast.push({ a: an, x: xnL });
    for (let j = s; j < source.length; j++) newLast.push({ a: source[j].a, x: cloneOrd(source[j].x) });
    e[l - 1] = newLast;
    return e;
}

function processRflCol(c: Column, cutoff: number, d: number): Column {
    return c.map((z) => ({
        a: z.a >= cutoff ? z.a + d : z.a,
        x: shiftOrdNumbers(z.x, cutoff, d),
    }));
}

function rfl(src: Expr): Expr {
    if (!isLimitExpr(src)) return predecessor(src);
    const l = src.length,
        an = src[l - 1][src[l - 1].length - 1].a,
        d = l - an;
    if (d <= 0) throw Error('Illegal e0MN expression: d <= 0');
    const out = down(src);
    for (let col = an + 1; col <= l; col++) out.push(processRflCol(src[col - 1], an, d));
    return out;
}

function FS(src: Expr, m: number): Expr {
    if (!Number.isSafeInteger(m) || m < 0) throw Error('FS index must be a non-negative integer');
    if (is_infinity(src)) return infinity_FS(m);
    if (!src.length) return [];
    if (!m || !isLimitExpr(src)) return predecessor(src);
    let r = cloneExpr(src);
    while (m--) r = rfl(r);
    return predecessor(r);
}

function shortExpansion(src: Expr): Expr {
    if (!isLimitExpr(src)) return predecessor(src);
    const l = src.length,
        last = src[l - 1],
        n = last.length;
    const { a: an, x: xn } = last[n - 1];
    const prev = n > 1 ? last[n - 2].x : [];
    const xnL = ordFS(xn, l - 1);
    const omit = isOne(xn) || (n > 1 && ordCompare(xnL, prev) <= 0);
    if (omit) return down(src);

    let s = 0,
        xnS = ordFS(xn, 0);
    while (ordCompare(xnS, prev) <= 0) {
        s++;
        if (!Number.isSafeInteger(s)) throw Error('No finite short-expansion index found');
        xnS = ordFS(xn, s);
    }

    const e = cloneExpr(src);
    e[l - 1] = last.slice(0, -1).map((z) => ({ a: z.a, x: cloneOrd(z.x) }));
    e[l - 1].push({ a: an, x: xnS });
    return e;
}

function FSShort(src: Expr, m: number): Expr {
    if (!Number.isSafeInteger(m) || m < 0) throw Error('FS index must be a non-negative integer');
    if (is_infinity(src)) return infinity_FS(m);
    if (!src.length) return [];
    if (!m || !isLimitExpr(src)) return predecessor(src);
    const short = shortExpansion(src);
    if (m === 1) return short;
    const first = FS(src, 1);
    return FS(src, exprCompare(short, first) === 0 ? m : m - 1);
}

// ---------- diagram ----------
// 原文件自带一套画布绘制; 现改为"只描述形状 + 交给项目共享的山脉图工具绘制"。
// 行高向量取该项的序数 x 本身(底行哨兵 '*' 取 [] = 零序数), 于是:
//   - 行的排序即 ordCompare, 行标即 ordToHTML(x);
//   - 同列相邻两格之间的右腿、以及"落到父列中低于本格的最新一行"的左腿,
//     与共享工具的右腿/左腿折线几何完全一致。
type Vertical = Ord;
type DiagramData = { invert_vertical?: boolean };

/**
 * 由表达式算出山脉图形状。
 *
 * 每列第 0 个节点是底行哨兵 '*'(行号 0), 其余每个项占它序数所对应的那一行(行号 1 起);
 * 左腿落点为父列(列标 a - 1)中严格低于本格行号的最大已占用行, 没有则落到底行 0。
 */
/** 任何一个"有项的列"都没有时不出图(与原实现一致: 空表达式与 `()` 都返回 undefined)。 */
function has_entries(expr: Expr): boolean {
    return expr.some((column) => column.length > 0);
}

function build_e0MN_mountain_source(expr: Expr): MountainViewSource<Vertical> | undefined {
    if (is_infinity(expr) || !has_entries(expr)) return undefined;

    // 行标 → 行号(0 为底行哨兵), 行标即该记号自身形式下的序数
    const rows: Ord[] = [];
    expr.forEach((column) =>
        column.forEach((z) => {
            if (!rows.some((r) => ordEq(r, z.x))) rows.push(cloneOrd(z.x));
        }),
    );
    rows.sort(ordCompare);

    // 预先算好每列: 行号 → 文字(含底行 '*'), 以及各项的行号与"最终成格"的下标
    const columns = expr.map((column) => {
        const texts = new Map<number, string>([[0, '*']]);
        const drawn_index = new Map<number, number>(); // 行号 → 该行最终成格项的下标
        const node_rows: number[] = [];
        column.forEach((z, i) => {
            const row = rows.findIndex((r) => ordEq(r, z.x)) + 1;
            texts.set(row, String(z.a));
            drawn_index.set(row, i);
            node_rows.push(row);
        });
        // 行号 → 该节点在本列 shape 中的下标(第 0 个节点是底行哨兵, 故从 1 起编号)
        const shape_index = new Map<number, number>([[0, 0]]);
        let next = 1;
        column.forEach((_, i) => {
            const row = node_rows[i];
            if (drawn_index.get(row) !== i) return;
            shape_index.set(row, next++);
        });
        return { texts, drawn_index, shape_index, node_rows };
    });

    /** 某列中严格低于 row 的最大已占用行, 不存在则 0。 */
    const below = (col: number, row: number): number => {
        for (let r = row - 1; r >= 0; r--) if (columns[col].texts.has(r)) return r;
        return 0;
    };

    const shape: MountainShape<Vertical> = expr.map((column, col) => {
        const { texts, drawn_index, node_rows } = columns[col];
        const nodes: MountainNode<Vertical>[] = [{ vertical: [], text: texts.get(0)! }];
        column.forEach((z, i) => {
            if (drawn_index.get(node_rows[i]) !== i) return; // 被遮盖的项不单独成格
            nodes.push({ vertical: z.x, text: String(z.a) });
        });
        column.forEach((z, i) => {
            const row = node_rows[i];
            const target_col = z.a - 1;
            if (drawn_index.get(row) !== i) return;
            if (row <= 0 || target_col < 0 || target_col >= col) return;
            const target_row = below(target_col, row);
            const target_shape_index = columns[target_col].shape_index.get(target_row);
            const self_index = columns[col].shape_index.get(row);
            if (target_shape_index === undefined || self_index === undefined) return;
            nodes[self_index].leg_target = [target_col, target_shape_index];
        });
        return nodes;
    });

    return {
        shape,
        layout: {
            // 仅作行去重键与默认行标: 必须单射(ordToHTML 会把 ω^0 也显示成 1, 故不用它)
            vertical_display: ordToLatex,
            vertical_compare: ordCompare,
            separator_count: () => 0,
            row_label: (v) => ordToHTML(v),
        },
        display_html_row_label: true,
    };
}

export const draw_diagram_control: DiagramControl<Expr, DiagramData> = {
    default_data: {},
    draw_diagram: (expr, data) => {
        const source = build_e0MN_mountain_source(expr);
        if (source === undefined) return undefined;
        return draw_mountain_diagram(source.shape, source.layout, {
            invert_vertical: data?.invert_vertical,
            display_html_row_label: source.display_html_row_label,
        });
    },
};

export const e0MN: NotationDefinition<Expr> = {
    id: 'e0mn',
    name: 'e0 Mountain Notation',
    simple_name: 'e0MN',
    category_id: 'category-ta0-mn',
    display: {
        plain: (e) => exprToPlain(e),
        html: (e) => exprToHTML(e),
        latex: (e) => exprToLatex(e),
        from_display: parseExpr,
        name: '原记号',
    },
    display_equiv: {
        行高差: {
            plain: (e) => exprToRowHeightPlain(e),
            html: (e) => exprToRowHeightHTML(e),
            latex: (e) => exprToRowHeightLatex(e),
            from_display: parseRowHeightExpr,
            name: '行高差',
        },
    },
    is_limit: isLimitExpr,
    compare: exprCompare,
    ...MN_FS_variants(FS, is_infinity, infinity_FS, isLimitExpr, exprToPlain, colCompare, shortExpansion),
    draw_diagram: draw_diagram_control,
    mountain_view: (expr) => build_e0MN_mountain_source(expr),
    credit_text_id: 'credit.e0mn',
    init: () => [INFINITY, [[]], []],
    debug: {
        parseOrd,
        ordFS,
        ordAdd,
        ordRightDiff,
        parseExpr,
        parseRowHeightExpr,
        exprToPlain,
        exprToRowHeightPlain,
        down,
        rfl,
        isLegalExpr,
        build_e0MN_mountain_source,
    },
};
