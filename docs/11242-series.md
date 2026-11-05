# 11242 系列接入说明

本次新增根分类 `11242系列`，包含 SRD、RPD、ARD、ARD2、IPD，以及子分类 `ta0` 下的 e0MN、strong-e0MN。原有 `MN → ta0` 条目保留。

菜单按注册先后排序：根分类中放在 `aSAN` 之后、`互译器` 之前；组内顺序为 `SRD → RPD → ARD → ARD2 → IPD → ta0`。

支持 NER 原生中英文切换：展开设置栏后，在“语言 / Language”中选择“中文 / English”。分类名、简介、视图名、图例、图形无障碍标签和本模块的解析／预算提示随语言更新。记号语法、计数、基本列和已保存视图的内部 ID 不变。

SRD 是原 SRPD 的新名称。ARD 与 ARD2 采用简化后的 skyline 版本，不是 legacy 版本。分类名称来自 SRD 的计数序列 `1,2,4,2` 与其他若干系统的 `1,1,2,4,2` 所对应的 BMS 极限。

## 视图

所有条目共有：**列表、计数序列、邻接列表、三角矩阵、弧线图**。

| 记号              | 额外视图         |
| ----------------- | ---------------- |
| SRD               | 层级列表、山脉图 |
| RPD、ARD、ARD2    | 无               |
| IPD               | 树形图           |
| e0MN、strong-e0MN | 行高差、山脉图   |

- 列表保持各记号的原始结构语法，单行显示，使用 NER 的继承字体。它支持输入和查找。
- 计数采用精确整数。预算不足时保留已算出的数字，逐列用 `?` 表示未知；不会用近似数字替代，也不会把整条序列改成“计数超限”。计数显示不是另一套展开规则。
- 邻接列表按列组织为 `[...]`；层之间用分号分隔，每层写 `层号:槽位,槽位,...`。槽位按前驱列编号排列，空槽表示无边。SRD 隐去的首根在邻接关系中仍按 0 编号。
- 三角矩阵每层一张，行是父列、列是源列；只画对角线及其上方。对角线换底色并填列号，代替外侧行列标。计数序列在所有表格上方。层号在左侧。
- 矩阵和弧线中的 RPD/ARD/ARD2 数字是根参数 `q`，所以 `0` 也表示有边；SRD/e0MN 使用 `1` 表示有边；IPD 填入树参数。
- 弧线图按层分组，重叠区间分配不同轨道，参数放在带边框的标签中。山脉图及树形图保留各自结构。
- 图形均绘制完整表达式；超出绘图预算会明确提示切换列表，不截取局部冒充全图。
- 计数、邻接列表、矩阵等未实现逆解析的视图不支持直接导入；NER 会显示原有提示。需要查找时先切回“列表”。

## 规则来源与实现边界

参考仓库：[column-ordinal-notations-hzy](https://github.com/hzyhhzy/column-ordinal-notations-hzy)。各原始展开器的相对路径和 SHA-256 记录于 `src/test/fixtures/11242.json`，方便区分后续变更。

- `graph.ts`：RPD 的显式根闭包，以及 ARD/ARD2 的压缩 skyline 规则和计数。
- `srd.ts`：去掉隐式首根后的 SRPD 规则；对外改名 SRD。
- `ipd-core.js`：IPD 的共享树节点实现、精确计数和完整树绘图；通过 `.d.ts` 提供类型边界。
- `e0-core.js`：@test_alpha0 的表达式语法与绘图，以及有限段批量计算、区间求和等计数加速；通过 `.d.ts` 提供类型边界。
- `index.ts`：注册原生 `NotationDefinition`，不再调用自定义展开器的全局注册函数，也不使用 `eval`。e0MN 与 strong-e0MN 的 **FS、短展开、长展开、fast、比较和极限判定直接复用 MN 模块**，仅转换顶端的内部表示，避免两份规则漂移。
- `views.ts`：各记号共用的邻接、矩阵、弧线和内联图形排版。
- `i18n.ts`：集中管理中英文本，通过 `TextSpec` 键接入 NER 翻译字典；图形及错误文字在运行时读取当前语言。通用显示缓存增加语言维度，等价表示菜单及图形面板使用翻译后的名称而非内部 ID。

计算与绘图预算是界面保护，超限不改变数学结果。一般计数预算约为每个表达式 200 ms；一次渲染可能涉及多个表达式，不能把它理解为整个页面的硬实时保证。已完成的精确计数会缓存。

## 简介中大小比较的依据

简介采用短句；`e0MN > ARD2 > ARD > RPD > SRD` 写作“已有纸面嵌入比较”。依据是已有文稿给出的以下界，而不是本次样例测试推出的结论：

1. [SRPD 对应关系](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/notations/SRPD/correspondence.zh-CN.md)：SRD 对应 RPD `(1,2)` 的展开域，因而位于 RPD 的真初段。
2. [RPD ≤ ARD(1,2)](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/proofs/paper/rpd-le-ard-a2.zh-CN.md)：整个 RPD 可嵌入 ARD 的一个有限表达式以下。
3. [ARD ≤ ARD2(1,3)](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/proofs/paper/ard-le-ard2-13.zh-CN.md)：整个 ARD 可嵌入 ARD2 的一个有限表达式以下。
4. [ARD2 ≤ e0MN](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/research/order-comparisons/proofs/ard2-e0mn-cover-20260917/ARD2-le-e0MN.zh-CN.md)：目标可取 e0MN 的 `()(1:ω)(2:ω^2)()(4:ω)(5:ω^3+ω+1)`，其计数是 `1,3,14,1,6,185`，低于 e0MN `(1,4)`。

上述嵌入文稿给出大小比较；e0MN 的整体良序性另由 @test_alpha0 的证明提供，来源说明见下节。此次接入核对了比较文稿结论及其有限上界，没有新增 Lean 形式化或重新审计所有数学证明。

SRD 极限的 Y 序列候选来自 @最菜萌新 的猜测，页面明确标为猜测。RPD 的 `≥ Y` 及其他系统的良序性状态依照参考仓库；IPD 与整个 ARD2 的关系不在简介中擅作断言。

## 简介中的良序公理上界

SRD、RPD、ARD、ARD2、IPD 的简介统一注明：已在 $KP_\omega+\text{存在不可数序数}$ 下证明良序（纸面证明）。这里使用论文的约定：KP 包含完整集合归纳，附加公理的准确表述为

$$
\exists\nu\,[\nu>\omega\text{ 为序数，且不存在集合函数 }\omega\twoheadrightarrow\nu].
$$

依据分别是 [RPD 等的合写论文](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/proofs/paper/well-ordering.zh-CN.md)、[ARD 轮廓版证明](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/proofs/paper/ard-well-ordering.zh-CN.md)、[ARD2 轮廓版证明](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/proofs/paper/ard2-well-ordering.zh-CN.md)、[IPD 证明](https://github.com/hzyhhzy/column-ordinal-notations-hzy/blob/main/proofs/paper/ipd-well-ordering.zh-CN.md)，以及前述 SRPD 对应文稿第 5 节的良序转移。结论针对各记号的指定标准域；不把普通 Lean 证明说成已内部形式化了该弱集合论。

e0MN 与 strong-e0MN 的简介均注明：已由 @test_alpha0 在“KPω + 存在不可数序数”下证明良序。这一证明状态及署名由 @hzyhhzy 于 2026-11-05 补充确认，更新了参考仓库旧版外部记号说明的状态。本次未取得该证明的新文稿或进行独立审计，不将其说成由上述单向嵌入下界推出。

## 验证

`src/test/11242.test.ts` 使用每个记号 72 个参考式，共 504 个式子，对照若干一步展开、可得精确计数、严格下降、显示和解析往返。另直接对照本仓库原有 e0MN/strong-e0MN 的默认、短、长展开。测试是移植回归检查，不是良序性或全域等价性的证明。

`src/test/11242-i18n.test.ts` 检查全部翻译键及插值参数、中英简介和视图名、树图实时切换、解析错误和预算提示，以及显示缓存不会跨语言串用。另验证切换语言不改变计数、展开结果和视图内部 ID。

```sh
npm run typecheck
npx vitest run --maxWorkers=2
npm run build:singlefile
```

单文件产物为 `dist/NE-rewritten.html`。浏览器中点击 `11242系列`，再选择记号；两种 e0MN 位于其 `ta0` 子分类。列表上方可直接切换各个视图。
