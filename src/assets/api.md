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

    debug?: Record<string, any>;
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
```

`FS` 字段以及 `FS_alter`, `FS_short` 可选字段表示计算记号的基本列.
它们对应设置项中的三种展开变体.

以矩阵记号或序列记号为例, 若完整提供, 
则语义上 `FS` 与 `FS_alter` 为短展开与长展开.

`FS_short` 表示 lnz-1 模式, 
使用更精细的基本列来减少展开到某一项需要取基本列的次数.
例如, BMS 的 lnz-1 模式中, 第 $0$ 项为删去末列,
第 $1$ 项为某列 lnz-1, 第 $2$ 项起为通常的短展开, 
其中若与第 $1$ 项重复则删去一个重复项.

可以不定义 `FS_short` 字段, 这时在 lnz-1 模式下会默认使用 `FS` 字段.

### debug

```ts
    debug: Record<string, any>
```

`debug` 字段就是用于 debug 的, 向控制台暴露内部方法, 如 compute_bad_root 方法等.
在输入框按 Ctrl+D 可以向控制台输出当前记号与表达式, 
还会把记号与表达式挂载到全局 notation 和 expr 变量上,
这时可以用 notation.debug.xxx 来获取暴露的函数并调试执行.

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

有生成器的类别, 生成的记号所属的类别必须为该类别;
该类别不应当有生成器生成的记号以外的记号, 也不应当有子类别.

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
| &emsp;&#124; `category-bm-minus1-y-nss` | &emsp;-1Y n-tuple Sequence System    |
| &emsp;&#124; `category-bm-t-minus1-y-nss` | &emsp;Transfinite -1Y-nSS            |
| &emsp;&#124; `category-bm-bt-minus1-y-nss` | &emsp;Branching Transfinite -1Y-nSS  |
| &emsp;&#124; `category-bm-bt-star-minus1-y-nss` | &emsp;Bubby3's Transfinite\* -1Y-nSS |
| &emsp;&#124; `category-bm-btl-minus1-y-nss` | &emsp;Asheep's Transfinite nSS       |
| `category-mn` | Mountain Notation                    |
| &emsp;&#124; `category-n-mn` | &emsp;n-MN                           |
| &emsp;&#124; `category-hypcos-w2mn` | &emsp;HypCos's omega2MN              |
| &emsp;&#124; `category-smile-mn` | &emsp;Smile's omega2+MN              |
| `category-den` | Defective Embedding Notation         |
| `category-ton` | Taranovksy's ordinal notation        |
| `category-asan` | Aarex's Superstrong Array Notation   |


