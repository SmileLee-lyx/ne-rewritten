import type { TextSpec } from '@/notation-definition.ts';

export type SeriesLanguage = 'zh' | 'en';
export const seriesMessages = {
    category: {
        zh: '11242系列',
        en: '11242 family',
    },
    'view.list': {
        zh: '列表',
        en: 'List',
    },
    'view.count': {
        zh: '计数序列',
        en: 'Counting sequence',
    },
    'view.adjacency': {
        zh: '邻接列表',
        en: 'Adjacency list',
    },
    'view.matrix': {
        zh: '三角矩阵',
        en: 'Triangular matrix',
    },
    'view.arcs': {
        zh: '弧线图',
        en: 'Arc diagram',
    },
    'view.heights': {
        zh: '层级列表',
        en: 'Height list',
    },
    'view.mountain': {
        zh: '山脉图',
        en: 'Mountain diagram',
    },
    'view.trees': {
        zh: '树形图',
        en: 'Tree diagram',
    },
    'view.row-difference': {
        zh: '行高差',
        en: 'Row-height differences',
    },
    'description.chain': {
        zh: '已有纸面嵌入比较：e0MN > ARD2 > ARD > RPD > SRD。',
        en: 'Paper embedding results: e0MN > ARD2 > ARD > RPD > SRD.',
    },
    'description.well-ordering': {
        zh: '已在“KPω + 存在不可数序数”下证明良序（纸面证明）。',
        en: 'Proved well-ordered in “KPω + an uncountable ordinal exists” (paper proof).',
    },
    'description.srd': {
        zh: '“11242系列”各记号的共有初段（原名 SRPD）。1,2,4,2 对应 lim(BMS)。极限目前未知；@最菜萌新 猜测为 Y 序列的 1,3,4,2,5,8,10,4,9,14,17,10。',
        en: 'A common initial segment of the notations in the “11242 family” (formerly SRPD). 1,2,4,2 corresponds to lim(BMS). Its limit is unknown; @最菜萌新 conjectures Y(1,3,4,2,5,8,10,4,9,14,17,10).',
    },
    'description.rpd': {
        zh: '由 GPT6-Astra 与 @hzyhhzy 发明，已证明大于等于 Y 序列，但目前不确定是否等于。',
        en: 'Invented by GPT6-Astra and @hzyhhzy. Proved to be at least as large as the Y sequence; equality remains open.',
    },
    'description.ard': {
        zh: '由 GPT6-Astra 与 @hzyhhzy 发明。已证明 RPD ≤ ARD(1,2)，因此 ARD > RPD。',
        en: 'Invented by GPT6-Astra and @hzyhhzy. RPD ≤ ARD(1,2) has been proved, so ARD > RPD.',
    },
    'description.ard2': {
        zh: '由 GPT6-Astra 与 @hzyhhzy 发明。已证明 ARD ≤ ARD2(1,3)，因此 ARD2 > ARD。',
        en: 'Invented by GPT6-Astra and @hzyhhzy. ARD ≤ ARD2(1,3) has been proved, so ARD2 > ARD.',
    },
    'description.ipd': {
        zh: '由 GPT6-Astra 与 @hzyhhzy 发明，以迭代树轮廓作为边的参数，与整个 ARD2 的大小关系尚未确定。',
        en: 'Invented by GPT6-Astra and @hzyhhzy, using iterated tree profiles as edge parameters. Its comparison with the whole ARD2 system remains open.',
    },
    'description.e0mn': {
        zh: '由 @test_alpha0 发明，与 MN–ta0 栏的 e0MN 使用相同定义，增加计数序列等显示。',
        en: 'Invented by @test_alpha0. Uses the same definition as e0MN under MN–ta0, with counting sequences and additional views.',
    },
    'description.strong-e0mn': {
        zh: '由 @test_alpha0 发明，与 MN–ta0 栏的 strong e0MN 使用相同定义，增加计数序列等显示。',
        en: 'Invented by @test_alpha0. Uses the same definition as strong e0MN under MN–ta0, with counting sequences and additional views.',
    },
    'description.e0-proof': {
        zh: '已由 @test_alpha0 在“KPω + 存在不可数序数”下证明良序。',
        en: 'Proved well-ordered by @test_alpha0 in “KPω + an uncountable ordinal exists”.',
    },
    'error.budget': {
        zh: '计算预算不足，请使用较小的展开指标。',
        en: 'Computation budget exceeded; use a smaller expansion index.',
    },
    'error.natural': {
        zh: '需要非负安全整数。',
        en: 'A non-negative safe integer is required.',
    },
    'error.graph-range': {
        zh: '父列、层标或根标超出本记号允许的范围。',
        en: 'A parent, layer or root is outside the range allowed by this notation.',
    },
    'error.graph-input': {
        zh: '请输入 [(层,父列,根)] 列表或 Limit[3][2]。',
        en: 'Enter a [(layer,parent,root)] list or a path such as Limit[3][2].',
    },
    'error.parent-order': {
        zh: '父列表须非增，且满足 高度−1≤父列<子列。',
        en: 'Parent lists must be non-increasing and satisfy height−1 ≤ parent < child.',
    },
    'error.parent-input': {
        zh: '请输入父项列表，如 [][1][2,2]。',
        en: 'Enter a parent list, for example [][1][2,2].',
    },
    'error.height-input': {
        zh: '请输入层级列表。',
        en: 'Enter a height list.',
    },
    'error.height-parent': {
        zh: '该层级列表没有相应父项。',
        en: 'No parent list corresponds to this height list.',
    },
    'error.height-inverse': {
        zh: '层级列表不能无损还原。',
        en: 'This height list cannot be inverted losslessly.',
    },
    'error.graph-budget': {
        zh: '完整图超出绘图预算，请切换列表。',
        en: 'The full diagram exceeds the drawing budget; switch to List.',
    },
    'error.matrix-budget': {
        zh: '完整矩阵超出绘图预算，请切换列表。',
        en: 'The full matrix exceeds the drawing budget; switch to List.',
    },
    'error.matrix-width': {
        zh: '完整矩阵过宽，请切换列表。',
        en: 'The full matrix is too wide; switch to List.',
    },
    'error.arc-width': {
        zh: '完整弧线图过宽，请切换列表。',
        en: 'The full arc diagram is too wide; switch to List.',
    },
    'error.arc-height': {
        zh: '完整弧线图过高，请切换列表。',
        en: 'The full arc diagram is too tall; switch to List.',
    },
    'error.expansion-width': {
        zh: '展开列数超出预算。',
        en: 'Expansion column budget exceeded.',
    },
    'error.row-depth': {
        zh: '行标嵌套深度超出预算',
        en: 'Row-label nesting budget exceeded',
    },
    'error.expansion-columns': {
        zh: '展开列数超出预算',
        en: 'Expansion column budget exceeded',
    },
    'error.expansion-time': {
        zh: '展开时间超出预算',
        en: 'Expansion time budget exceeded',
    },
    'error.count-integer': {
        zh: '中间整数超过 32768 位',
        en: 'Intermediate integer exceeds 32768 bits',
    },
    'error.count-top': {
        zh: '外顶端没有有限列计数',
        en: 'The external top has no finite column count',
    },
    'error.count-work': {
        zh: '工作量预算',
        en: 'work budget',
    },
    'error.count-depth': {
        zh: '行标嵌套深度',
        en: 'row-label nesting depth',
    },
    'error.count-cnf': {
        zh: '计数需要标准 Cantor 正规形',
        en: 'Counting requires standard Cantor normal form',
    },
    'error.count-rows': {
        zh: '行标总大小',
        en: 'total row-label size',
    },
    'error.count-coeff': {
        zh: '计数需要安全整数系数',
        en: 'Counting requires safe integer coefficients',
    },
    'error.count-columns': {
        zh: '计数需要列序列',
        en: 'Counting requires a column sequence',
    },
    'error.count-legal': {
        zh: '计数需要合法的 e0MN 列',
        en: 'Counting requires legal e0MN columns',
    },
    'error.count-input': {
        zh: '输入文字大小',
        en: 'input text size',
    },
    'error.count-result': {
        zh: '结果超过 32768 位',
        en: 'Result exceeds 32768 bits',
    },
    'error.count-cache': {
        zh: '局部缓存大小',
        en: 'local cache size',
    },
    'error.count-tasks': {
        zh: '任务嵌套深度',
        en: 'task nesting depth',
    },
    'error.count-path': {
        zh: '单任务路径长度',
        en: 'per-task path length',
    },
    'error.row-decrease': {
        zh: '行标基本列没有严格下降',
        en: 'The row-label fundamental sequence did not strictly decrease',
    },
    'error.row-crossing': {
        zh: 'down 产生了非法列：降低后的行标越过前一项',
        en: 'down produced an illegal column: the lowered row label crossed the preceding entry',
    },
    'error.index': {
        zh: '指标必须是非负安全整数或 BigInt。',
        en: 'The index must be a non-negative safe integer or BigInt.',
    },
    'error.work': {
        zh: '工作量',
        en: 'work',
    },
    'error.time': {
        zh: '时间',
        en: 'time',
    },
    'error.tree-depth': {
        zh: '树递归深度',
        en: 'tree recursion depth',
    },
    'error.integer-bits': {
        zh: '准确整数位数',
        en: 'exact integer bit length',
    },
    'error.arity': {
        zh: '节点元数',
        en: 'node arity',
    },
    'error.shared-nodes': {
        zh: '共享树容量',
        en: 'shared tree capacity',
    },
    'error.normalize': {
        zh: '共享树规范化内部错误。',
        en: 'Internal shared-tree normalization error.',
    },
    'error.tree-text': {
        zh: '树文本长度',
        en: 'tree text length',
    },
    'error.columns': {
        zh: '列数',
        en: 'column count',
    },
    'error.edges': {
        zh: '边数',
        en: 'edge count',
    },
    'error.expression-text': {
        zh: '表达式文本长度',
        en: 'expression text length',
    },
    'error.level': {
        zh: '层号',
        en: 'level',
    },
    'error.expanded-columns': {
        zh: '展开列数',
        en: 'expanded column count',
    },
    'error.ipd-input': {
        zh: '请输入列列表、A0 或 Limit。',
        en: 'Enter a column list, A0 or Limit.',
    },
    'error.input-text': {
        zh: '输入文本长度',
        en: 'input text length',
    },
    'error.integer-length': {
        zh: '结构整数长度',
        en: 'structural integer length',
    },
    'error.integer-range': {
        zh: '结构整数范围',
        en: 'structural integer range',
    },
    'error.reference': {
        zh: '引用必须是父列以前的 ROOT 或当前 SELF。',
        en: 'References must be ROOT values at or before the parent, or the current SELF.',
    },
    'error.repeat': {
        zh: '重复次数不能为零。',
        en: 'The repetition count must be nonzero.',
    },
    'error.parent-before': {
        zh: '父列必须严格早于本列。',
        en: 'The parent column must strictly precede this column.',
    },
    'error.ipd-path': {
        zh: '请输入 A0、A1[3]、Limit 或完整列列表。',
        en: 'Enter A0, A1[3], Limit or a complete column list.',
    },
    'error.input-path': {
        zh: '输入展开路径',
        en: 'input expansion path',
    },
    'error.trailing': {
        zh: '表达式后有未识别内容。',
        en: 'Unrecognized content follows the expression.',
    },
    'error.phases': {
        zh: '局部阶段数',
        en: 'local phase count',
    },
    'error.count-text': {
        zh: '计数文本长度',
        en: 'count text length',
    },
    'error.root': {
        zh: '非法底层引用。',
        en: 'Invalid base-level reference.',
    },
    'error.tree-form': {
        zh: '正层树应为 [] 或 [head,children]。',
        en: 'A positive-level tree must be [] or [head,children].',
    },
    'error.tree-node': {
        zh: '非法树节点。',
        en: 'Invalid tree node.',
    },
    'error.column-array': {
        zh: '需要列数组。',
        en: 'A column array is required.',
    },
    'error.edge-array': {
        zh: '每列应为边数组。',
        en: 'Each column must be an edge array.',
    },
    'error.edge-form': {
        zh: '边应为 [parent,[level,tree]]。',
        en: 'An edge must be [parent,[level,tree]].',
    },
    'error.parent': {
        zh: '非法父列。',
        en: 'Invalid parent column.',
    },
    'error.tree-level': {
        zh: '非法树层。',
        en: 'Invalid tree level.',
    },
    'error.list-text': {
        zh: '完整列表长度',
        en: 'complete list length',
    },
    'error.tree-budget': {
        zh: '完整树超出绘图预算',
        en: 'The full tree exceeds the drawing budget',
    },
    'error.tree-size': {
        zh: '完整树尺寸超出绘图预算',
        en: 'The full tree dimensions exceed the drawing budget',
    },
    'error.tree-svg': {
        zh: '完整树图文本超限',
        en: 'The full tree diagram exceeds the text budget',
    },
    'error.forest-text': {
        zh: '完整森林文本超限',
        en: 'The full forest exceeds the text budget',
    },
    'error.tree-fallback': {
        zh: '完整树超出绘图预算，请切换列表；未显示局部图。',
        en: 'The full tree exceeds the drawing budget; switch to List. No partial diagram is shown.',
    },
    'error.difference-nonnegative': {
        zh: '序数右差要求第二项不小于第一项',
        en: 'Ordinal right difference requires the second ordinal to be at least the first',
    },
    'error.difference-missing': {
        zh: '序数右差不存在',
        en: 'Ordinal right difference does not exist',
    },
    'error.fs-index': {
        zh: '基本列指标须为非负整数',
        en: 'FS index must be a non-negative integer',
    },
    'error.e0-unmatched': {
        zh: 'e0MN 表达式中有不匹配的左括号',
        en: 'Unmatched "(" in e0MN expression',
    },
    'error.row-diff-internal': {
        zh: '内部错误：行高差不正确',
        en: 'Internal error: row-height difference is incorrect',
    },
    'error.row-diff-empty': {
        zh: '行高差列中存在空项',
        en: 'Empty entry in a row-height difference column',
    },
    'error.row-diff-unmatched': {
        zh: '行高差表达式中有不匹配的左括号',
        en: 'Unmatched "(" in a row-height difference expression',
    },
    'error.e0-width': {
        zh: '非法 e0MN 表达式：d ≤ 0',
        en: 'Illegal e0MN expression: d <= 0',
    },
    'error.short-index': {
        zh: '未找到有限的短展开指标',
        en: 'No finite short-expansion index found',
    },
    'error.number-expected': {
        zh: '需要数字',
        en: 'number expected',
    },
    'error.number-large': {
        zh: '数字过大',
        en: 'number is too large',
    },
    'error.sum-term': {
        zh: '加号后需要项',
        en: 'term expected after "+"',
    },
    'error.exponent': {
        zh: '需要指数',
        en: 'exponent expected',
    },
    'error.coefficient': {
        zh: '系数必须为正数',
        en: 'coefficient must be positive',
    },
    'error.ordinal-trailing': {
        zh: '存在多余内容',
        en: 'unexpected trailing text',
    },
    'error.cnf': {
        zh: '不是标准 Cantor 正规形',
        en: 'not in standard Cantor normal form',
    },
    'diagram.matrix': {
        zh: '层 {{layer}} 的邻接矩阵',
        en: 'Adjacency matrix for layer {{layer}}',
    },
    'diagram.arcs': {
        zh: '分层弧线图',
        en: 'Layered arc diagram',
    },
    'diagram.head': {
        zh: '头 {{level}}',
        en: 'Head {{level}}',
    },
    'diagram.level': {
        zh: '层 {{level}}',
        en: 'Level {{level}}',
    },
    'diagram.zero': {
        zh: '第 {{level}} 层零树',
        en: 'Zero tree at level {{level}}',
    },
    'diagram.self': {
        zh: 'SELF，当前列 {{column}}',
        en: 'SELF, current column {{column}}',
    },
    'diagram.root': {
        zh: 'ROOT，列 {{column}}',
        en: 'ROOT, column {{column}}',
    },
    'diagram.node': {
        zh: '第 {{level}} 层节点；头 {{head}}',
        en: 'Level {{level}} node; head {{head}}',
    },
    'diagram.tree': {
        zh: '第 {{column}} 列指向第 {{parent}} 列的第 {{level}} 层完整树',
        en: 'Full level {{level}} tree from column {{column}} to column {{parent}}',
    },
    'diagram.description': {
        zh: '实线连接同层子树；紫框内部是低一层的头树。子树从左到右有序，重复项全部画出。',
        en: 'Solid lines connect subtrees at the same level; purple frames contain head trees one level lower. Children are ordered left to right, and all repetitions are drawn.',
    },
    'diagram.column': {
        zh: '第 {{column}} 列（从 0 编号）',
        en: 'Column {{column}} (zero-based)',
    },
    'diagram.empty': {
        zh: '空列，没有边',
        en: 'Empty column, no edges',
    },
    'diagram.legend': {
        zh: '实线：同层子树　紫框：低层头树　∅：空列　·：零树',
        en: 'Solid lines: same-level children; purple frames: lower-level heads; ∅: empty column; ·: zero tree',
    },
    'error.ipd-count': {
        zh: 'IPD：计数预算内未算完（{{reason}}）；没有返回截断项。',
        en: 'IPD: counting budget exceeded ({{reason}}); no truncated expression was returned.',
    },
    'error.ipd-operation': {
        zh: 'IPD：操作预算内未算完（{{reason}}）；没有返回截断项。',
        en: 'IPD: operation budget exceeded ({{reason}}); no truncated expression was returned.',
    },
    'error.expected': {
        zh: '位置 {{position}} 应为 {{expected}}。',
        en: 'Expected {{expected}} at position {{position}}.',
    },
    'error.expected-natural': {
        zh: '位置 {{position}} 需要非负整数。',
        en: 'A non-negative integer is required at position {{position}}.',
    },
    'error.count-limit': {
        zh: '计数超限：{{reason}}（不是不终止的结论）',
        en: 'Counting budget exceeded: {{reason}} (this does not imply nontermination)',
    },
    'error.count-time': {
        zh: '时间预算（{{ms}} ms）',
        en: 'time budget ({{ms}} ms)',
    },
    'error.natural-value': {
        zh: '需要自然数：{{value}}',
        en: 'Natural number expected: {{value}}',
    },
    'error.e0-parse': {
        zh: '非法 e0 表达式“{{text}}”：{{reason}}，位置 {{position}}',
        en: 'Illegal e0 expression "{{text}}": {{reason}} at position {{position}}',
    },
    'error.missing': {
        zh: '缺少“{{token}}”',
        en: 'Missing "{{token}}"',
    },
    'error.entry-form': {
        zh: '项应为 a:x；实际为：{{entry}}',
        en: 'Entry must have form a:x; got: {{entry}}',
    },
    'error.left-leg': {
        zh: '左腿列标必须是正整数：{{value}}',
        en: 'Left-leg column label must be a positive integer: {{value}}',
    },
    'error.e0-parenthesis': {
        zh: 'e0MN 表达式的位置 {{position}} 应为左括号',
        en: 'Expected "(" at position {{position}} in an e0MN expression',
    },
    'error.row-parenthesis': {
        zh: '行高差表达式的位置 {{position}} 应为左括号',
        en: 'Expected "(" at position {{position}} in a row-height difference expression',
    },
    'error.tower-height': {
        zh: '塔高须为非负整数',
        en: 'Tower height must be a non-negative integer',
    },
    'error.bad-exponent': {
        zh: '非法指数',
        en: 'bad exponent',
    },
    'error.term-expected': {
        zh: '需要一个项',
        en: 'term expected',
    },
    'error.positive-integer': {
        zh: '需要正整数',
        en: 'positive integer expected',
    },
    'error.term-start': {
        zh: '项须以正整数或 ω 开头',
        en: 'term must start with a positive integer or ω',
    },
    'error.positive-coeff': {
        zh: '需要正系数',
        en: 'positive coefficient expected',
    },
    'error.empty': {
        zh: '表达式为空',
        en: 'empty expression',
    },
    'error.positive-row': {
        zh: '行标须为正',
        en: 'row label must be positive',
    },
    'error.unexpected': {
        zh: '非预期字符“{{character}}”',
        en: 'Unexpected character "{{character}}"',
    },
    'error.count-unavailable': {
        zh: '计数不可用：{{reason}}',
        en: 'Count unavailable: {{reason}}',
    },
} as const;
export type SeriesTextKey = keyof typeof seriesMessages;
let languageSource: () => SeriesLanguage = () => 'zh';

/** Read the reactive application setting at render time, not when modules load. */
export function setSeriesLanguageSource(read: () => SeriesLanguage): void {
    languageSource = read;
}
export function seriesName(key: SeriesTextKey): TextSpec {
    return { id: `11242.${key}` };
}
export function seriesDictionary(lang: SeriesLanguage): Record<string, string> {
    return Object.fromEntries(Object.entries(seriesMessages).map(([key, text]) => [`11242.${key}`, text[lang]]));
}
export function seriesText(key: SeriesTextKey, params: Record<string, string | number> = {}): string {
    return seriesMessages[key][languageSource()].replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
        String(params[name] ?? token),
    );
}
