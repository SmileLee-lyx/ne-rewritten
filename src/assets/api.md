# 用户自定义记号 API 文档

可阅读文档来编写记号, 也可下载本文档提供给 AI 以帮助生成记号.
此外, 还可查看或下载 `api.ts` 查看类型详细定义.

常见问题汇总 (FAQ) 见本文档末尾.

## 定义记号

上传自定义记号时, 请在上传的 js 代码中调用如下的函数.

```ts
function register_notation<T>(notation: NotationDefinition<T>);
```

以下为字段的详细说明. 其中, 省略了部分不常用字段.

```ts
export interface NotationDefinition<T> {
    id: string;
    name: string;
    simple_name?: string;
    category_id?: string;
    display: NotationDisplaySpec<T>;
    display_equiv?: Record<string, NotationDisplaySpec<T>>;
    init: () => T[];
    is_limit: (a: T) => boolean;
    compare: (a: T, b: T) => number;
    FS: (a: T, index: number) => T;
    FS_alter?: (a: T, index: number) => T;
    FS_short?: (a: T, index: number) => T;
    FS_equiv?: Record<string, (a: T, index: number) => T>;

    draw_diagram?: DiagramControl<T, any>;              // 图表(画布), 详见"绘制图表与山脉图"章节
    mountain_view?: (expr: T, data: any) => MountainViewSource | undefined;  // 山脉图(HTML 面板)

    debug?: Record<string, any>;

    debug_verification?: TestFunc<T> | Record<string, TestFunc<T>>;
}
```
`T` 为记号的表达式类型.

### 基础信息

```ts
    id: string;
```

`id` 为记号的唯一标识符, 不得与其他记号或记号类别重复.

```ts
    name: string;
    simple_name?: string;
```

`name` 与 `simple_name` 分别为记号名的全称与简称,
其中 `simple_name` 为可选字段.
若省略简称, 则简称与全称相同.

```ts
category_id?: string;
```
`category_id` 可选字段表示记号的类别的 id.
若类别未定义, 则该记号出现在顶层, 不在任何类别中.

### 展示与等价记号

```ts
    display: NotationDisplaySpec<T>;
```

`display` 字段描述记号表达式如何转化为显示的字符串. 
其中 `NotationDisplaySpec<T>` 类型如下定义:

```ts
type NotationDisplay<T> = (a: T) => string;

type NotationDisplaySpec<T> =
    | NotationDisplay<T>
    | {
    plain: NotationDisplay<T>;
    html?: NotationDisplay<T>;
    latex?: NotationDisplay<T>;
    from_display?: (str: string) => T;
};
```

`display` 字段有两种表示: 简化表示与完整表示.
简化表示即提供单个 `(T) => string` 的函数.

完整表示中, `plain` 字段为纯文本展示, 其输出结果直接按照纯文本展示.

`html` 可选字段为 html 展示, 其输出结果直接视为 html 来渲染.
从而, 可以使用 `<sub><sup>` 等元素来实现上下标等功能.
未提供时, 默认直接以纯文本的输出作为输出.

`latex` 可选字段为 latex 展示, 其输出结果直接视为 latex 公式源码来渲染.
未提供时, 默认将 html 展示的结果转化为 latex, 该自动转化未必完全可靠.
目前仅支持 `<sub><sup>` 标签的自动转化.

`from_display` 可选字段语义上为将 `plain` 输出的纯文本字符串转化回表达式的函数.
注意, ***导出为 xlsx*** 功能导出的表格使用 `plain` 纯文本表示;
若想导入表格, 则必须提供 `from_display` 字段.

```ts
    display_equiv?: Record<string, NotationDisplaySpec<T>>;
```

`display_equiv` 可选字段描述了该记号的等价表示.
等价表示原先指同一个记号的不同表示方法 
(例如, LMN 可将 $\psi_0(\psi_0(\psi_1))$ 简化为 $0(0(1))$),
但也可用于完全互译的两个等价记号
(例如, BMS 有 0Y 等价表示).

`display_equiv` 对象的字段名称表示诸等价表示的 id.
每个字段均与 `display` 的类型相同, 可以为单个函数的简单表示, 也可为完整表示.

### 记号核心算法

```ts
    init: () => T[];
```
`init` 函数返回的数组即为初始时展示的表达式, 从大往小排列.
首项必须为该记号的极限. 习惯上末项为零记号.

```ts
    is_limit: (a: T) => boolean;
```

`is_limit` 函数表示判断表达式是否为极限序数.
兼容性考虑, 该名称不作修改, 但更适宜的名称为 `is_limit_ordinal`.
该函数**不是**判断一个表达式是否为该记号的极限表达式.

```ts
    compare: (a: T, b: T) => number;
```

`compare` 函数比较两个记号的大小. 返回值的符号表示比较结果.
使用 `compare(a, b) > 0` 来判断 `a > b`.

```ts
    FS: (a: T, index: number) => T;
    FS_alter?: (a: T, index: number) => T;
    FS_short?: (a: T, index: number) => T;
    FS_equiv?: Record<string, (a: T, index: number) => T>;
```

`FS` 字段以及 `FS_alter`, `FS_short`, `FS_equiv` 可选字段表示计算记号的基本列.
它们对应设置项中的展开变体.

以矩阵记号或序列记号为例, 若完整提供, 
则语义上 `FS` 与 `FS_alter` 为短展开与长展开.

`FS_short` 表示 lnz-1 模式, 
使用更精细的基本列来减少展开到某一项需要取基本列的次数.
例如, BMS 的 lnz-1 模式中, 第 $0$ 项为删去末列,
第 $1$ 项为末列 lnz-1, 第 $2$ 项起为通常的短展开, 
其中若与第 $1$ 项重复则删去一个重复项.

可以不定义 `FS_short` 字段, 这时在 lnz-1 模式下会默认使用 `FS` 字段.

```ts
    FS_equiv?: Record<string, (a: T, index: number) => T>;
```

`FS_equiv` 为可选字段, 用于给出三种预设变体之外的更多展开变体.
其键为变体的 id, 值为该变体的基本列函数.

`FS_equiv` 的主要作用为添加各种 "fast" 变体 (参考 MN):
MN 系列记号的 `FS_short` 与通常记号一致,
而把第 $1$ 项为截断的那份 lnz-1 基本列作为额外的变体提供, 写作

```ts
    FS_equiv: { fast: ... },
```

其中的保留键 `FS`, `FS_alter`, `FS_short` 缺省时由上面三个同名字段充当,
即 `FS_equiv` 中的 `FS_short` 与字段 `FS_short` 同义
(若两者都存在, 则以 `FS_equiv` 中的为准).

变体选择是**按记号**分别记录的.
未定义的变体不会出现在设置项中;
自定义键的变体在设置项中直接以键名 (如 `fast`) 显示,
而三个保留键则显示为"短展开", "长展开", "lnz-1".
若某记号还没有记录过所选的变体, 则使用默认变体,
即存在 `FS_short` 时用 `FS_short`, 否则用 `FS`.

### 绘制图表

```ts
    draw_diagram?: DiagramControl<T, any>;
```

`draw_diagram` 为可选字段, 描述该记号如何在鼠标聚焦表达式时弹出图表.
其中最常用的写法是给出山脉图(见下一节), 由通用绘制函数负责排布与画线.

### 山脉图

```ts
    mountain_view?: (expr: T, data: any) => MountainViewSource | undefined;
```

`mountain_view` 为可选字段: 定义后, 该记号的表达式可以在"山脉图面板"里以 **HTML 表格**的形式查看
(表格可滚动, 左侧行标列在横向滚动时固定). 它与 `draw_diagram` 的图表是**同一份数据**的两种呈现,
因此建议两者共用一个构造函数, 只造一次形状与布局.

返回的数据如下:

```ts
export interface MountainViewSource<V = any> {
    shape: MountainShape<V>;
    layout: MountainLayoutOptions<V>;
    display_html_row_label?: boolean;  // 行标是否按 HTML 渲染
    display_html_entry?: boolean;      // 格子文字是否按 HTML 渲染
}
```

"形状"是每列的节点数组; 每个节点给出所在的行高向量, 显示文字, 以及可选的左腿落点
(落点写作 `shape[i][j]` 的下标, 省略或越界表示无左腿):

```ts
export interface MountainNode<V> {
    vertical: V;                    // 行高向量(记号自己的载体类型)
    text: string;                   // 该格显示的文字
    leg_target?: [number, number];  // 左腿折线的落点
}
export type MountainShape<V> = MountainNode<V>[][];
```

"布局"告诉渲染器如何把行高向量排成行:

```ts
export interface MountainLayoutOptions<V> {
    vertical_display: (v: V) => string;                // 行高向量 → 文字(同时用作去重键与默认行标)
    vertical_compare: (a: V, b: V) => number;          // 行的上下次序
    separator_count: (higher: V, lower: V) => number;  // 相邻两行之间的分割线数量
    row_label?: (v: V, index: number) => string | undefined;  // 行标; 返回 undefined 则不显示该行标
    extra_verticals?: V[];                             // 强制参与排序, 但没有节点落在其上的行
    row_height?: number;                               // 单行基准高度(默认 40, 仅画布版使用)
    row_gap?: number;                                  // 每条额外分割线的高度增量(默认 5, 仅画布版使用)
}
```

几点约定:

- `shape` 中出现的行就是**会被绘制**的行; 记号内部的"虚拟行"不要放进去;
- 同一列内两个节点不允许落在同一行;
- HTML 版**无视上下翻转**, 固定按"行标小者在上"绘制(表格第一行即行标最小的行);
- `separator_count` 只影响画布版的行距, HTML 表格版**无视分割线数量**(各行等距).

### 绘制山脉图: draw_mountain_diagram

画布版图表可以直接调用运行环境注入的 `draw_mountain_diagram`(无需 import):

```ts
declare function draw_mountain_diagram<V>(
    shape: MountainShape<V>,
    layout: MountainLayoutOptions<V>,
    draw?: MountainDiagramOptions,
): Diagram | undefined;
```

`MountainDiagramOptions` 全部可选: `column_width`(列宽, 默认 30), `row_label_width`(行标列宽, 默认 50),
`connector_offset`(连线两端偏移, 默认 10), `outer_padding`(上下留白, 默认 10), `font_size`(字号, 默认 14),
`invert_vertical`(是否上下翻转), `display_html_row_label` / `display_html_entry`(行标 / 格子文字是否按 HTML 渲染).

共用一个构造函数的例子:

```js
function build_source(expr) {
    return {
        shape: expr.map((col, i) =>
            col.map((e, j) => ({
                vertical: [j],
                text: '' + e,
                leg_target: i > 0 && j > 0 ? [i - 1, j - 1] : undefined,
            })),
        ),
        layout: {
            vertical_display: (v) => '' + v[0],
            vertical_compare: (a, b) => a[0] - b[0],
            separator_count: () => 1,
            row_label: (v) => '' + v[0],
        },
    };
}

register_notation({
    // ...其余字段...
    mountain_view: (expr) => build_source(expr),
    draw_diagram: {
        default_data: { invert_vertical: false },
        draw_diagram: (expr, data) => {
            const s = build_source(expr);
            return draw_mountain_diagram(s.shape, s.layout, { invert_vertical: data.invert_vertical });
        },
    },
});
```

若同时需要 HTML 渲染行标或格子文字, 记得在 source 里写 `display_html_row_label` / `display_html_entry`.

### debug

```ts
    debug: Record<string, any>
```

`debug` 字段就是用于 debug 的, 向控制台暴露内部方法, 如 `compute_bad_root` 方法等.
在输入框按 `Ctrl+D` 可以向控制台输出当前记号与表达式, 
还会把记号与表达式挂载到全局 `notation` 和 `expr` 变量上,
这时可以用 `notation.debug.xxx` 来获取暴露的函数并调试执行.

### debug_verification

```ts
export type TestFunc<T> = (expr: T) => boolean;

    debug_verification?: TestFunc<T> | Record<string, TestFunc<T>>;
```

`debug_verification` 可选字段为调试校验器: 若定义了该字段, 每次展开创建新节点时,
都会对新生成的表达式运行校验. 若未通过, 仅会在控制台打印警告, 节点仍会正常创建,
便于在手动展开表达式树时快速校验展开是否正确.

该字段有两种写法:

- **单个函数**: 直接写一个 `TestFunc<T>`, 行为与以往一致;
- **record**: 写 `Record<string, TestFunc<T>>`(字段名可自由取, 如 `{ 基本列正确, 提升对齐 }`),
  此时会运行其中的**全部**校验函数, 并在未通过时**额外打印所有未通过的字段名**,
  便于快速定位是哪一项校验不过, 例如:

```ts
    debug_verification: {
        'UP 判定': (e) => check_up(e),
        '基本列': (e) => check_fs(e),
    },
```

> **注意**: 该字段仅供调试使用, 对每个新建节点都有额外调用开销;
> 在正式发布(或把记号分发给他人)之前, 建议删除该字段以减少性能开销.

## 定义记号类别

上传自定义记号时, 也可以在上传的 js 代码中调用如下的函数来定义记号类别.

```ts
function register_category(cat: NotationCategoryDefinition);
```

记号类别用于在导航栏中分组记号.

```ts
interface NotationCategoryDefinition {
    id: string;
    name: string;
    simple_name?: string;
    parent_id?: string;
    generator?: NotationCategoryGenerator;
}
```

### 基础信息

```ts
    id: string;
```

`id` 为类别的唯一标识符, 不得与其他记号或记号类别重复.

```ts
    name: string;
    simple_name?: string;
```

`name` 与 `simple_name` 分别为类别的全称与简称,
其中 `simple_name` 为可选字段.
若省略简称, 则简称与全称相同.

```ts
    parent_id?: string;
```

`parent_id` 可选字段表示父类别的 id, 用于在导航栏中建立层级结构.
若省略则类别出现在导航栏的最顶层.

### 生成器

类别可以具有一个生成器, 用于生成类似 `nMN` 这样的记号族.
生成器根据序号 $n$ 生成对应的记号.

有生成器的类别, 生成的记号所属的类别必须为该类别;
该类别不应当有生成器生成的记号以外的记号, 也不应当有子类别.

```ts
    generator?: NotationCategoryGenerator;
```

`generator` 可选字段, 其类型如下定义:

```ts
interface NotationCategoryGenerator {
    start: number;
    initial: number;
    create: (n: number) => NotationDefinition<any>;
}
```

```ts
    start: number;
```

`start` 为生成器开始生成的序号.

```ts
    initial: number;
```

`initial` 为页面加载时默认展开到的序号.

```ts
    create: (n: number) => NotationDefinition<any>;
```

`create` 为根据序号 $n$ 生成记号定义的函数.
该类别会在导航栏中以可交互的形式展示,
允许用户增减序号来切换生成的记号.

## 常见问题汇总

1. 如何支持表格导入?

A: 需要定义 from_display, 详见 '展示与等价记号' 章节.

2. 内置类别的 id

A: 以下为目前内置的记号类别及其层次结构:

| id | 名称                                   |
|----|--------------------------------------|
| `category-ocf` | Ordinal Collapsing Function          |
| `category-ocn` | OCF-like notation                    |
| `category-y` | Y sequence                           |
| &emsp;&#124; `category-y-omega` | &emsp;omega Y                        |
| `category-bm-like` | Bashicu Matrix-like notation         |
| &emsp;&#124; `category-minus1-y-nss-series` | &emsp;-1Y-nSS Series |
| &emsp;&emsp;&#124; `category-bm-minus1-y-nss` | &emsp;&emsp;-1Y n-tuple Sequence System |
| &emsp;&emsp;&#124; `category-bm-t-minus1-y-nss` | &emsp;&emsp;Transfinite -1Y-nSS |
| &emsp;&emsp;&#124; `category-bm-bt-minus1-y-nss` | &emsp;&emsp;Branching Transfinite -1Y-nSS |
| &emsp;&emsp;&#124; `category-bm-bt-star-minus1-y-nss` | &emsp;&emsp;Bubby3's Transfinite\* -1Y-nSS |
| &emsp;&emsp;&#124; `category-bm-bt-star-minus1-y-nss'` | &emsp;&emsp;Bubby3's Transfinite\* -1Y-nSS' |
| &emsp;&emsp;&#124; `category-bm-btl-minus1-y-nss` | &emsp;&emsp;Asheep's Transfinite nSS |
| &emsp;&#124; `category-upms-partial` | &emsp;BMS(n rows) + UPMS |
| `category-mn` | Mountain Notation                    |
| &emsp;&#124; `category-n-mn` | &emsp;n-MN                           |
| &emsp;&#124; `category-hypcos-w2mn` | &emsp;HypCos's omega2MN              |
| &emsp;&#124; `category-smile-mn` | &emsp;Smile's omega2+MN              |
| `category-den` | Defective Embedding Notation         |
| `category-ton` | Taranovksy's ordinal notation        |
| `category-asan` | Aarex's Superstrong Array Notation   |


