# Notation Explorer Rewritten

基于 [notation-explorer](https://github.com/hypcos/notation-explorer) 使用 TypeScript 重构的展开器.

在保留原项目展开树的基本形式的基础上, 增加了一些便于分析的功能, 如分析输入框 (及纯键盘分析快捷键), 图形绘制 (山脉图, DEN 图等), 多种等价表示等.

在原项目的基础上, 新增了部分社区已有定义但此前无展开器的记号, 及一些新记号.

本项目使用了 AI 编程.

## 在线使用

<https://smilelee-lyx.github.io/ne-rewritten/>

## 本地运行

需要 Node 24 (与 CI 一致).

```bash
npm install
npm run dev        # 本地开发
npm run build      # 构建到 dist/
npm run preview    # 预览构建产物
```

其他脚本:

- `npm run build:compat`:构建旧浏览器兼容版到 `dist-compat/`.
- `npm run build:singlefile`:构建为单文件 `dist/NE-rewritten.html`.
- `npm run typecheck`:类型检查.

## 自定义记号

项目支持上传自定义记号.

在设置栏打开「自定义记号 → 配置」, 即可新建脚本, 上传 `.js`, 添加模板, 并在面板内查看或下载 API 文档.

若要编写自定义记号, 请阅读 [api.md](src/assets/api.md) 与 [api.ts](src/assets/api.ts) 查询规范; `api.md` 也可直接在面板内下载, 交给 AI 生成脚本.
