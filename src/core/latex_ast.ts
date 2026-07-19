/**
 * LaTeX AST & parser for simplified notation input.
 *
 * Tokens:
 *   - each letter is its own token
 *   - consecutive digits form one number token
 *   - each symbol is its own token
 *
 * Grammar (recursive descent):
 *   expr        → unit+
 *   unit        → base ( _ expr | [ expr ] | ^ expr )* func_app?
 *   base        → token | number | group | _ expr | ^ expr
 *   group       → '(' expr ')' | '{' expr '}'
 *   func_app    → '(' expr ')'      // only when no whitespace before '('
 *
 * Substitution rules (applied inside base):
 *   p → ψ, w → ω, W → Ω  (fixed, always on)
 *   ψ rule (toggleable): ψ followed by a letter/digit token absorbs it as subscript
 */

export interface TokenNode {
    kind: 'token';
    value: string;
}

export interface GroupNode {
    kind: 'group';
    open: '(' | '{';
    body: LatexExpr;
    close: ')' | '}';
}

export interface SubSupNode {
    kind: 'subsup';
    base: LatexNode;
    sub?: LatexExpr;
    sup?: LatexExpr;
}

export type LatexNode = TokenNode | GroupNode | SubSupNode;
export type LatexExpr = LatexNode[];

// ---- Utility ----

function is_letter_digit(s: string): boolean {
    return /^[a-zA-Z0-9]$/.test(s);
}

// ---- Tokenizer ----

export interface Token {
    /** The raw string of the token. */
    s: string;
    /** True if there was whitespace before this token. */
    leading_ws: boolean;
}

export const SUBSTITUTIONS: Record<string, string> = {
    p: 'ψ',
    w: 'ω',
    W: 'Ω',
};

export class Tokenizer {
    private s: string;
    private pos: number;
    private marks: number[];

    constructor(s: string) {
        this.s = s;
        this.pos = 0;
        this.marks = [];
    }

    /** Return the next token without consuming it, or null at end. */
    peek(): Token | null {
        const saved = this.pos;
        const t = this.advance();
        this.pos = saved;
        return t;
    }

    /** Consume and return the next token, or null at end. */
    advance(): Token | null {
        let ws = false;
        while (this.pos < this.s.length && /[ \t\r\n]/.test(this.s[this.pos])) {
            ws = true;
            this.pos++;
        }
        if (this.pos >= this.s.length) return null;

        const leading_ws = ws;
        const ch = this.s[this.pos];

        if (/\d/.test(ch)) {
            const start = this.pos;
            while (this.pos < this.s.length && /\d/.test(this.s[this.pos])) this.pos++;
            return { s: this.s.substring(start, this.pos), leading_ws };
        }

        // LaTeX command: \ followed by letters → single token
        if (ch === '\\') {
            this.pos++;
            if (this.pos < this.s.length && /[a-zA-Z]/.test(this.s[this.pos])) {
                const start = this.pos;
                while (this.pos < this.s.length && /[a-zA-Z]/.test(this.s[this.pos])) this.pos++;
                return { s: '\\' + this.s.substring(start, this.pos), leading_ws };
            }
            // lone backslash (not followed by a letter)
            return { s: '\\', leading_ws };
        }

        this.pos++;
        return { s: ch, leading_ws };
    }

    /** Whether there is whitespace between current position and the next token. */
    has_whitespace(): boolean {
        const t = this.peek();
        return t ? t.leading_ws : false;
    }

    /** Save current position. */
    mark(): void {
        this.marks.push(this.pos);
    }

    /** Restore to last saved position. */
    revert(): void {
        this.pos = this.marks.pop() ?? this.pos;
    }

    /** Discard last saved position. */
    commit(): void {
        this.marks.pop();
    }
}

// ---- Parser ----

export interface ParserOptions {
    psi_subscript: boolean;
    subscript_bracket: boolean;
    map_p: boolean;
    map_w: boolean;
    map_e: boolean;
    map_f: boolean;
    map_l: boolean;
    map_W: boolean;
}

export const DEFAULT_OPTIONS: ParserOptions = {
    psi_subscript: false,
    subscript_bracket: true,
    map_p: false,
    map_w: true,
    map_e: false,
    map_f: false,
    map_l: false,
    map_W: false,
};

/**
 * Result of parsing a single unit, carrying whether ψ rule was applied
 * so the caller can decide about function-application absorption.
 */
interface UnitResult {
    node: LatexNode;
    psi_absorbed: boolean;
}

/** Options for parse_unit. */
interface UnitOpts {
    /** Whether `^` is treated as a superscript operator. False in subscript/bracket content. */
    allow_hat: boolean;
    /** Whether `^` extends with rule 2 (letter then _/^/[). Only true inside superscripts. */
    hat_extend: boolean;
}

const UNIT_TOP: UnitOpts = { allow_hat: true, hat_extend: false };
const UNIT_SUP: UnitOpts = { allow_hat: true, hat_extend: true };
const UNIT_SUB: UnitOpts = { allow_hat: false, hat_extend: false };

export class Parser {
    private tk: Tokenizer;
    private opts: ParserOptions;

    constructor(tk: Tokenizer, opts?: Partial<ParserOptions>) {
        this.tk = tk;
        this.opts = { ...DEFAULT_OPTIONS, ...opts };
    }

    /** Apply substitution based on options. */
    private substitute(raw: string): string {
        if (raw === 'p' && this.opts.map_p) return 'ψ';
        if (raw === 'w' && this.opts.map_w) return 'ω';
        if (raw === 'W' && this.opts.map_W) return 'Ω';
        if (raw === 'e' && this.opts.map_e) return 'ε';
        if (raw === 'f' && this.opts.map_f) return 'φ';
        if (raw === 'L' && this.opts.map_l) return 'λ';
        return raw;
    }

    // ---- public entry ----

    /** expr → unit+ */
    parse_expr(): LatexExpr {
        const nodes: LatexExpr = [];
        while (true) {
            const t = this.tk.peek();
            if (!t) break;
            if (t.s === ')' || t.s === '}') break;
            const r = this.parse_unit(UNIT_TOP);
            if (r) nodes.push(r.node);
            else break;
        }
        return nodes;
    }

    // ---- unit ----

    /**
     * Parse one unit.
     */
    private parse_unit(opts: UnitOpts): UnitResult | null {
        // implicit empty base when _ or ^ starts the unit
        const pk = this.tk.peek();
        if (!pk) return null;

        if (pk.s === '_' || pk.s === '^') {
            const op = pk.s;
            this.tk.advance(); // consume _/^
            return this.parse_subsup_after_op(
                { kind: 'token', value: '' }, // empty base
                op,
            );
        }

        // ---- parse base ----
        const base_res = this.parse_base();
        if (!base_res) return null;
        let { node: current, psi_absorbed: psi_flag } = base_res;

        // ---- chain: _ / [ / ^ ----
        while (true) {
            const nxt = this.tk.peek();
            if (!nxt) break;

            if (nxt.s === '_') {
                this.tk.advance();
                const sub_res = this.parse_sub_content();
                current = {
                    kind: 'subsup',
                    base: current,
                    sub: sub_res,
                } satisfies SubSupNode;
                psi_flag = false; // operator reset
            } else if (nxt.s === '[' && this.opts.subscript_bracket) {
                this.tk.advance(); // consume [
                const sub_res = this.parse_bra_content();
                // consume matching ]
                const close = this.tk.peek();
                if (close && close.s === ']') {
                    this.tk.advance();
                    this.tk.commit();
                }
                current = {
                    kind: 'subsup',
                    base: current,
                    sub: sub_res,
                } satisfies SubSupNode;
                psi_flag = false;
            } else if (nxt.s === '^' && opts.allow_hat) {
                // ^ always reads one unit (or group); rule-2 extension and whether
                // subsequent operators apply to the sup vs the base is controlled by
                // the outer opts.hat_extend in the operator chain loop.
                this.tk.advance();
                const sup_res = this.parse_sup_content();
                current = this.merge_sup(current, sup_res);
                psi_flag = false;
            } else if (nxt.s === '^' && !opts.allow_hat) {
                break;
            } else {
                break;
            }
        }

        return { node: current, psi_absorbed: psi_flag };
    }

    // ---- base ----

    private parse_base(): UnitResult | null {
        const t = this.tk.peek();
        if (!t) return null;

        // group
        if (t.s === '(' || t.s === '{') {
            const group = this.parse_group(t.s);
            this.tk.commit();
            return { node: group, psi_absorbed: false };
        }

        // token (letter, digit, or symbol)
        return this.parse_token_base();
    }

    /**
     * Consume a letter / digit / symbol token, apply substitutions,
     * then check ψ rule.
     */
    private parse_token_base(): UnitResult | null {
        const t = this.tk.peek();
        if (!t) return null;

        // apply substitution (but not for LaTeX commands like \psi)
        const raw = t.s;
        const substituted = raw.startsWith('\\') ? raw : this.substitute(raw);

        // consume the token
        this.tk.advance();
        this.tk.commit();

        const token_node: TokenNode = { kind: 'token', value: substituted };

        // ψ rule: if the substituted value matches and option is on
        if (this.opts.psi_subscript && substituted === 'ψ') {
            const absorbed = this.parse_psi_chain();
            if (absorbed.length > 0) {
                return {
                    node: { kind: 'subsup', base: token_node, sub: absorbed } satisfies SubSupNode,
                    psi_absorbed: true,
                };
            }
        }

        return { node: token_node, psi_absorbed: false };
    }

    // ---- sub / sup content ----

    /**
     * Superscript content after `^`: read only ONE unit (with rule-2 extension) or a group.
     */
    private parse_sup_content(): LatexExpr {
        const nxt = this.tk.peek();
        if (!nxt) return [];
        if (nxt.s === '(' || nxt.s === '{') {
            const group = this.parse_group(nxt.s);
            return [group];
        }
        const r = this.parse_unit(UNIT_SUP);
        return r ? [r.node] : [];
    }

    /**
     * Subscript `_` content: read only ONE unit (with rule-2 extension for `_`/`[`) or a group.
     * Unlike `^`, this rule applies everywhere — `_` never reads beyond one unit.
     */
    private parse_sub_content(): LatexExpr {
        const nxt = this.tk.peek();
        if (!nxt) return [];
        if (nxt.s === '(' || nxt.s === '{') {
            const group = this.parse_group(nxt.s);
            return [group];
        }
        const r = this.parse_unit(UNIT_SUB);
        return r ? [r.node] : [];
    }

    /**
     * Content inside `[...]` brackets: greedily read until `]`.
     * Brackets delimit the content, so there is no one-unit limit.
     */
    private parse_bra_content(): LatexExpr {
        return this.parse_content(UNIT_SUB, false);
    }

    /** Content inside ψ-rule absorbed token — no func-app, no hat. */
    private parse_psi_sub_content(): LatexExpr {
        return this.parse_content(UNIT_SUB, false);
    }

    /**
     * Recursively absorb tokens via ψ rule: consume the next letter/digit,
     * apply substitution, and if the result is ψ, continue absorbing.
     * Also handles _ / [ operators on each absorbed node.
     */
    private parse_psi_chain(): LatexExpr {
        const nxt = this.tk.peek();
        if (!nxt || !is_letter_digit(nxt.s)) return [];

        this.tk.advance();
        this.tk.commit();

        const val = this.substitute(nxt.s);
        let node: LatexNode = { kind: 'token', value: val };

        // recursive ψ rule
        if (this.opts.psi_subscript && val === 'ψ') {
            const sub = this.parse_psi_chain();
            if (sub.length > 0) {
                node = { kind: 'subsup', base: node, sub: sub } satisfies SubSupNode;
            }
        }

        // _ and [ operators on the absorbed node (no ^, no func-app)
        while (true) {
            const n2 = this.tk.peek();
            if (!n2) break;
            if (n2.s === '_') {
                this.tk.advance();
                const sub2 = this.parse_psi_sub_content();
                node = { kind: 'subsup', base: node, sub: sub2 } satisfies SubSupNode;
            } else if (n2.s === '[' && this.opts.subscript_bracket) {
                this.tk.advance();
                const sub2 = this.parse_psi_sub_content();
                node = { kind: 'subsup', base: node, sub: sub2 } satisfies SubSupNode;
            } else if (n2.s === '^') {
                break;
            } else {
                break;
            }
        }

        return [node];
    }

    // ---- generic content parser ----

    /**
     * Parse a sequence of units (content of _ / ^ / []).
     * @param opts  UnitOpts controlling ^ behavior in this content
     * @param allow_func_app  if true, check for `(` without ws after each unit
     */
    private parse_content(opts: UnitOpts, allow_func_app: boolean): LatexExpr {
        const nodes: LatexExpr = [];
        while (true) {
            const nxt = this.tk.peek();
            if (!nxt) break;
            // stop at any closing bracket
            if (nxt.s === ')' || nxt.s === '}' || nxt.s === ']') break;
            // if ^ is not allowed in this context, stop here (bubbles up)
            if (nxt.s === '^' && !opts.allow_hat) break;
            this.tk.mark();
            const r = this.parse_unit(opts);
            if (!r) {
                this.tk.revert();
                break;
            }
            this.tk.commit();

            nodes.push(r.node);

            // function-app check: ( without whitespace
            if (allow_func_app && !r.psi_absorbed) {
                const after = this.tk.peek();
                while (after && after.s === '(' && !after.leading_ws) {
                    const group = this.parse_group('(');
                    nodes.push(group);
                    const nextAfter = this.tk.peek();
                    if (!nextAfter || nextAfter.s !== '(' || nextAfter.leading_ws) break;
                }
            }
        }
        return nodes;
    }

    // ---- group ----

    private parse_group(open: string): GroupNode {
        this.tk.advance(); // consume open
        this.tk.commit();
        const body = this.parse_expr();
        // expect close
        const expected = open === '(' ? ')' : '}';
        const close_tok = this.tk.peek();
        const close = close_tok && close_tok.s === expected ? expected : '';
        if (close) {
            this.tk.advance();
            this.tk.commit();
        }
        return {
            kind: 'group',
            open: open as '(' | '{',
            body,
            close: close as ')' | '}',
        };
    }

    // ---- helpers ----

    /**
     * Merge superscript content into an existing SubSupNode.
     * If `current` is already a subsup with no sup, add sup.
     * Otherwise wrap in a new SubSupNode.
     */
    private merge_sup(current: LatexNode, sup: LatexExpr): LatexNode {
        if (current.kind === 'subsup' && current.sup === undefined) {
            return { ...current, sup } satisfies SubSupNode;
        }
        return { kind: 'subsup', base: current, sup } satisfies SubSupNode;
    }

    /**
     * Parse _/^ at the start of a unit (implicit empty base).
     */
    private parse_subsup_after_op(base: LatexNode, op: string): UnitResult {
        if (op === '_') {
            const sub = this.parse_sub_content();
            return { node: { kind: 'subsup', base, sub } satisfies SubSupNode, psi_absorbed: false };
        } else {
            const sup = this.parse_sup_content();
            return { node: { kind: 'subsup', base, sup } satisfies SubSupNode, psi_absorbed: false };
        }
    }
}

// ---- Export helper ----

export function parse_latex(input: string, opts?: Partial<ParserOptions>): LatexExpr {
    const tk = new Tokenizer(input);
    const parser = new Parser(tk, opts);
    return parser.parse_expr();
}

// ---- Render to LaTeX string ----

function render_node(node: LatexNode): string {
    switch (node.kind) {
        case 'token':
            return node.value;
        case 'group':
            return node.open + node.body.map(render_node).join('') + node.close;
        case 'subsup': {
            let s = needs_braces(node.base) ? '{' + render_node(node.base) + '}' : render_node(node.base);
            if (node.sub) s += '_{' + node.sub.map(render_node).join('') + '}';
            if (node.sup) s += '^{' + node.sup.map(render_node).join('') + '}';
            return s;
        }
    }
}

function needs_braces(n: LatexNode): boolean {
    return n.kind === 'subsup';
}

export function ast_to_latex(expr: LatexExpr): string {
    return expr.map(render_node).join('');
}
