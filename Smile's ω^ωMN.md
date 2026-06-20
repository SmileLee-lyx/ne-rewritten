# Smile's $\omega^\omega$ MN

一个矩阵 $A = A_1A_2\cdots A_n$ 为列构成的数组, 
其中列 $C = (C_{1}\cdots C_{m})$ 为由项 $C_i$ 构成的数组.
一个项 $E = \text{Sep}\text{Value}$ 由一个分隔符和一个值构成, 值是正整数. 
在 $\omega^\omega$ MN 中, 分隔符形如 $[\alpha]$, 
其中 $\alpha$ 是一个大于 $0$ 且小于 $\omega^\omega$ 的序数.

若 $\alpha < \omega^2$, 设 $\alpha = \omega a + b$. 
则分隔符 $[\alpha]$ 也可简记为 $a$ 个 ';' 后接 $b$ 个 ','.
特别地, 最小的分隔符是单个逗号.

本记号高度依赖 $\omega^\omega$ 以下的序数结构, 可能难以推广.

仅列出不同于 hypcos 原版 MN 的规则.

# 基分隔符

设一个项 $E = A_{ij}$ 具有分隔符 $[\alpha]$, 
其中 $\alpha = \omega^{d_1} a_1 + \cdots + \omega^{d_m} a_m$ 为 Cantor 正规型.
令 $\alpha_0 = \omega^{d_1} a_1 + \cdots + \omega^{d_m} (a_m - 1)$.

令 $j'$ 为最小的自然数, 满足项 $A_{j'}, A_{j' + 1}, \cdots, A_{j - 1}$ 的分隔符都小于 $[\alpha]$.
令 $E$ 的基分隔符 $S(E) = \max(\{\text{Sep}_{ij''}\mid j' \le j'' < j\} \cup \{[\alpha_0]\})$
为这些项的最大分隔符, 至少为 $[\alpha_0]$.

不同于项的分隔符, 基分隔符可能为 $[0]$.

# 默认拉伸量

后继分隔符没有默认拉伸量.
对极限分隔符 $[\alpha]$, 
设 $\alpha = \omega^{d_1} a_1 + \cdots + \omega^{d_m} a_m$ 为 Cantor 正规型.
则默认拉伸量为 $\omega^{d_m - 1}$.

# 拉伸数据

原矩阵的每个作用区域都有一份拉伸数据. 
一个拉伸数据是三元组 $(\alpha_{\text{threshold}}, \alpha_{\text{target}}, \text{force})$,
其中序数 $\alpha_{\text{threshold}}$ 称为拉伸阈, 序数 $\alpha_{\text{target}}$ 称为拉伸目标,
$\text{force}$ 是取值为 $true, false$ 的布尔值, 标记减一操作时是否保留额外项.

对于非最上方的作用区域, $\text{force}$ 始终为 $false$.
令 $E$ 为顶元素, $E'$ 为末列中与顶元素行标相同的元素.
则令 $\alpha_{\text{threshold}} = S(E)$, $\alpha_{\text{target}} = S(E')$.

在标准表达式或标准表达式延伸出的表达式中, $E'$ 始终存在. 
为完整性, 若 $E'$ 不存在, 则令 $\alpha_{\text{target}} = S(E)$.

对于最上方的作用区域, 我们设 $E'$ 为右上元素. 令 $E$ 是一个虚拟项, 具有任意的值, 分隔符和 $E'$ 相同.
考察虚拟列 $(A_{i_R,1}\cdots A_{i_R,j_R} E)$, 在该列中计算 $S(E)$, 
得到拉伸阈 $\alpha_{\text{threshold}} = S(E)$. 
令待定拉伸目标 $\alpha_{\text{target}}' = S(E')$.

1. 若 $E'$ 具有后继分隔符, 则 $\alpha_{\text{target}} = \alpha_{\text{target}}'$. 
令 $\text{force}$ 的值为 $true$ 当且仅当 $v_b(E') < v_b(E) + ω^{\alpha_{\text{target}}}$.

2. 若 $E'$ 具有极限分隔符, 设它的默认拉伸量为 $\omega^{d - 1}$. 
则 $\alpha_{\text{target}} = \max\{\alpha_{\text{target}}', \alpha_{\text{target}} + \omega^{d - 1}\}$.
令 $\text{force}$ 的值为 $true$ 当且仅当 $\alpha_{\text{target}} \ne \alpha_{\text{target}}'$.

# 减一操作

对末列非空的矩阵 $A$, 我们如下修改矩阵:

首先计算最上方作用区域的拉伸数据.

若 $\text{force}$ 为 $false$, 则删去右上项, 否则将该项的分隔符改为 $\alpha_{\text{target}}$.

之后, 将根列中根元素上方 (不含根元素) 的所有项复制到末列上方.

# 展开与延伸

一个非零非后继矩阵的基本列第 $k$ 项为对它做 $k$ 次延伸后删去末项得到的矩阵.

对矩阵做一次延伸, 得到一个非标准矩阵, 其展开与原矩阵展开 (在平移的意义下) 相同.

设 $A$ 为末列非空的原矩阵, $A'$ 为减一操作得到的矩阵. 
将 $A$ 的根列右侧 (不含根列) 的每一列 (这些列称为复制部) 依据 $A'$ 的参考元素和 $A$ 的拉伸数据进行复制操作,
并将得到的列依次添加在 $A'$ 之后, 所得到的矩阵称为 $A$ 的延伸.

# 拉伸规则

待定拉伸元素为在作用区域内 (从而行标足够高的元素不会被拉伸), 且祖先经过根列的元素.

对一个待定拉伸元素, 考虑其所在作用区域的拉伸阈 $\alpha_{\text{threshold}}$, 拉伸目标 $\alpha_{\text{target}}$.
设该待定拉伸元素的上方元素分隔符为 $[\alpha]$. 
若 $\alpha \le \alpha_{\text{threshold}}$, 则不拉伸, 复制后仍为 $\alpha$.
否则进行拉伸, 复制后分隔符为 $\alpha_{\text{target}} + (\alpha - \alpha_{\text{threshold}})$.