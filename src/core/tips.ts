/** 一条提示。content 为 i18n 键 (TextID)。 */
export interface Tip {
    /** 稳定 id, 作为 ignored_tip 的键。 */
    id: string;
    /** i18n 键, 渲染为提示正文 (可含 HTML, 如 <kbd>)。 */
    content: string;
}

/** 全体提示注册表: 旧浏览器导入失败时指引跳转兼容版; 以及山脉类记号改用 fast 基本列变体的提速建议。 */
export const TIPS: Tip[] = [
    { id: 'compat', content: 'tip.compat' },
    { id: 'fast-variant', content: 'tip.fast-variant' },
];
