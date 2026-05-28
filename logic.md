# Web Tool Architecture Logic

## 1. Overall Direction

当前项目优先建设为一个网页端工具，而不是一开始就做可安装桌面软件。

当前技术方向的核心特点是：

- 使用 SvelteKit 构建完整 Web 工具。
- 使用 Svelte 组件承载复杂交互。
- 使用 TypeScript 约束业务数据结构。
- 使用 Vite 提供快速开发和构建。
- 使用 Tailwind CSS 管理界面样式。
- 使用 Web Worker 处理较重的浏览器端任务。
- 使用 SvelteKit API routes 承载服务端逻辑，例如 AI 调用、限流、密钥保护。
- 使用 Vercel 部署在线版本。

这说明当前产品不需要先引入 Electron 或 Tauri。桌面端封装应该等核心网页工作流被验证后再加入。

## 2. Stack Dependency Layers

当前推荐技术栈可以理解为从底到上的几层：

```text
pnpm
  |
  +-- TypeScript
  |     |
  |     +-- SvelteKit 2
  |     |     |
  |     |     +-- Svelte 5
  |     |     +-- SvelteKit routes
  |     |     +-- SvelteKit API routes
  |     |
  |     +-- Vite
  |           |
  |           +-- dev server
  |           +-- production build
  |           +-- code splitting
  |           +-- worker bundling
  |
  +-- Tailwind CSS
  |     |
  |     +-- app.css
  |     +-- component classes
  |
  +-- Feature Libraries
        |
        +-- lucide-svelte
        +-- svelte-i18n
        +-- pdf-lib / pdfjs-dist, when PDF features are needed
        +-- svelte-file-dropzone, when upload dropzones are needed
        +-- svelte-dnd-action, when drag sorting is needed
        +-- openai / provider SDKs, when AI features are needed
```

## 3. Dependency Responsibilities

### pnpm

`pnpm` 是包管理和脚本入口。

它负责：

- 安装依赖。
- 锁定依赖版本。
- 运行开发、构建、检查脚本。
- 未来如有 monorepo 需求，可以自然扩展到 workspace。

典型脚本：

```json
{
	"dev": "vite dev --host",
	"build": "vite build",
	"preview": "vite preview --host",
	"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
}
```

### TypeScript

`TypeScript` 是整个项目的数据结构约束层。

它负责：

- 定义业务数据类型。
- 约束组件 props。
- 约束 API request 和 response。
- 约束 Worker message payload。
- 降低复杂工具逻辑在重构时的风险。

对于工具型项目，TypeScript 尤其重要，因为文件处理、AI 返回值、用户配置、导出数据通常结构复杂。

### SvelteKit

`SvelteKit` 是项目的主框架。

它负责：

- 页面路由。
- 布局组织。
- 服务端 API routes。
- 前后端同仓开发体验。
- 和 Vercel 等平台的部署适配。

推荐把用户直接看到的工具主界面放在：

```text
src/routes/+page.svelte
```

把服务端接口放在：

```text
src/routes/api/
```

### Svelte 5

`Svelte 5` 是 UI 运行层。

它负责：

- 组件渲染。
- 组件状态。
- 事件绑定。
- 页面交互。
- 局部响应式更新。

Svelte 的优势是组件代码相对直接，适合做工具型界面：上传、预览、设置面板、编辑区、弹窗、进度提示等都可以拆成清晰组件。

### Vite

`Vite` 是开发服务器和构建工具。

它负责：

- 本地开发热更新。
- 生产构建。
- 依赖预打包。
- 动态 import。
- Web Worker 打包。
- 大型依赖拆包，例如 PDF 相关库。

如果未来引入 `pdfjs-dist` 或 `pdf-lib`，应在 `vite.config.ts` 中把大型依赖拆成独立 chunk，避免主包过大。

### Tailwind CSS

`Tailwind CSS` 是样式系统。

它负责：

- 快速构建工具型界面。
- 控制布局、间距、颜色、边框、响应式。
- 避免过早设计复杂 CSS 架构。

Tailwind 应主要用于页面和组件样式。复杂交互状态仍然应该由 Svelte 状态控制，而不是用样式类硬编码业务逻辑。

### lucide-svelte

`lucide-svelte` 是图标库。

它负责：

- 工具栏图标。
- 操作按钮图标。
- 状态提示图标。
- 导入、导出、删除、设置、预览等常见动作图标。

工具型应用中，图标可以减少按钮文字负担，提高界面扫描效率。

### svelte-i18n

`svelte-i18n` 是国际化层。

它负责：

- 中文和英文文案。
- 菜单、按钮、提示、错误信息本地化。
- 后续扩展更多语言。

推荐目录：

```text
src/lib/i18n/
  index.ts
  locales/
    zh.json
    en.json
```

### Web Worker

`Web Worker` 是浏览器端重任务隔离层。

它负责：

- 大文件解析。
- PDF 处理。
- 文档转换。
- 批量计算。
- AI 返回结果的复杂整理。

原则是：任何可能让页面卡顿的任务，都应考虑放入 Worker。

推荐目录：

```text
src/lib/workers/
  worker.ts
```

### SvelteKit API Routes

`src/routes/api` 是服务端逻辑层。

它负责：

- 调用需要保密 API key 的外部服务。
- AI 请求代理。
- 请求限流。
- 服务端校验。
- 不能暴露在浏览器中的逻辑。

浏览器可以直接做的任务不要强行放到 API routes。API routes 应该只承载必须在服务端运行的能力。

### Vercel Adapter

`@sveltejs/adapter-vercel` 是部署适配层。

它负责：

- 把 SvelteKit 项目部署到 Vercel。
- 支持 SvelteKit API routes 在 Vercel 上运行。
- 允许设置 Node.js runtime，例如 `nodejs22.x`。

## 4. Source Directory Logic

推荐目录不是简单分类，而是为了控制依赖方向。

```text
src/routes
  depends on components, stores, lib

src/components
  depends on stores and lib types
  should not own core business logic

src/stores.ts
  depends on lib types and browser APIs
  stores shared UI and session state

src/lib/core
  depends on TypeScript and small utilities
  should not depend on Svelte components

src/lib/workers
  depends on core logic
  runs expensive browser-side jobs

src/lib/llm
  depends on core types
  isolates AI providers and response cleanup

src/routes/api
  depends on lib/server or lib/llm/server
  runs server-only work
```

理想依赖方向：

```text
routes -> components -> stores -> lib/core
routes -> api -> lib/llm/server -> lib/llm/core -> lib/core
workers -> lib/core
```

应避免的方向：

```text
lib/core -> components
lib/core -> routes
workers -> components
components -> routes/api internals
```

核心原则是：业务逻辑可以被 UI 使用，但业务逻辑不应该知道 UI 的存在。

## 5. Runtime Flow

一次典型用户操作可以分成以下流程。

### Browser-only Flow

适用于不需要服务端的任务，例如本地文件解析、格式转换、预览生成。

```text
User action
  -> Svelte component event
  -> update stores
  -> call lib/core service
  -> optionally send task to Web Worker
  -> receive result
  -> update stores
  -> UI re-renders
```

例子：

```text
用户上传文件
  -> Dropzone.svelte 触发 file selected
  -> stores.ts 保存当前文件状态
  -> lib/core/parser.ts 解析基础信息
  -> lib/workers/worker.ts 执行重任务
  -> stores.ts 保存处理结果
  -> PreviewPanel.svelte 展示结果
```

### Server-assisted Flow

适用于需要密钥、限流或服务端能力的任务，例如 AI 调用。

```text
User action
  -> Svelte component event
  -> client-side validation
  -> call src/routes/api endpoint
  -> server-side validation and rate limit
  -> call lib/llm/server
  -> provider SDK request
  -> normalize response
  -> return JSON to browser
  -> update stores
  -> UI re-renders
```

例子：

```text
用户点击 AI 生成
  -> Toolbar.svelte 触发 generate
  -> lib/llm/client.ts 整理请求
  -> POST /api/process
  -> +server.ts 校验输入和限制大小
  -> lib/llm/server.ts 调用 OpenAI 或其他 provider
  -> lib/llm/core.ts 修复和标准化结果
  -> 返回结构化 JSON
  -> stores.ts 保存结果
  -> 编辑区和预览区更新
```

## 6. Data Ownership Logic

状态分三类管理。

### UI State

UI 状态只影响界面，不属于业务数据。

例子：

- 当前是否打开设置面板。
- 当前是否显示弹窗。
- 当前是否处于加载中。
- 当前选中的 tab。

这类状态可以放在组件内部，也可以放在 `stores.ts`，取决于是否跨组件共享。

### Session State

Session 状态是当前用户正在处理的数据。

例子：

- 当前文件。
- 当前解析结果。
- 当前编辑内容。
- 当前预览数据。
- 当前用户设置。

这类状态适合放在 `stores.ts`，必要时持久化到 `localStorage` 或 `IndexedDB`。

### Core Data

Core data 是业务逻辑的输入和输出结构。

例子：

- 文档节点。
- 导出配置。
- AI 返回的结构化数据。
- 解析后的中间模型。

这类结构应该在 `src/lib/core/types.ts` 中定义，供 UI、Worker、API routes 共享。

## 7. Client and Server Split

当前项目应优先使用浏览器能力，但需要明确边界。

适合放在浏览器端：

- 文件读取。
- 用户编辑。
- 本地预览。
- 轻量格式转换。
- 不含密钥的模型整理。
- 可以离线完成的任务。

适合放在 Web Worker：

- 大文件解析。
- 密集计算。
- PDF 页面渲染或生成。
- 批量转换。
- 会阻塞 UI 的任务。

适合放在服务端 API：

- OpenAI 或其他 AI provider 调用。
- 需要隐藏 API key 的请求。
- 需要限流的请求。
- 需要统一日志和错误处理的请求。
- 浏览器无法安全完成的任务。

## 8. Why Not Desktop First

当前不优先做 Electron 或 Tauri，原因是产品阶段不匹配。

桌面端会立刻引入：

- 安装包构建。
- 自动更新。
- Windows/macOS/Linux 差异。
- 系统权限。
- 本地文件系统权限。
- 签名和发布流程。
- 桌面端崩溃和兼容性调试。

这些问题都是真实成本，但在网页端工具的早期验证阶段收益不高。

更好的顺序是：

```text
1. 先做网页端核心工具。
2. 验证用户工作流和核心功能。
3. 确认哪些能力浏览器无法满足。
4. 如果确实需要本地能力，再接入 Tauri 或其他桌面封装。
```

由于 SvelteKit 可以输出静态资源，未来如果要接入 Tauri，仍然有迁移路径。

## 9. Build and Deployment Logic

开发阶段：

```text
pnpm install
pnpm dev
```

检查阶段：

```text
pnpm check
```

构建阶段：

```text
pnpm build
```

预览阶段：

```text
pnpm preview
```

部署阶段：

```text
SvelteKit project
  -> Vite production build
  -> @sveltejs/adapter-vercel
  -> Vercel web hosting and serverless functions
```

## 10. Future Extension Logic

当前结构应为未来扩展保留空间，但不要提前实现不需要的复杂度。

可以自然扩展的方向：

- 增加更多工具页面：继续放入 `src/routes`。
- 增加复杂业务逻辑：扩展 `src/lib/core`。
- 增加 AI provider：扩展 `src/lib/llm`。
- 增加大型处理任务：扩展 `src/lib/workers`。
- 增加多语言：扩展 `src/lib/i18n/locales`。
- 增加桌面版：以后基于静态构建接入 Tauri。

不建议一开始就做的事情：

- 不要过早引入 Electron 或 Tauri。
- 不要一开始拆 monorepo，除非代码规模已经需要。
- 不要把所有逻辑塞进 `+page.svelte`。
- 不要让 UI 组件直接依赖服务端内部实现。
- 不要让 AI provider 逻辑散落在页面组件中。

## 11. Summary

当前技术结构的核心逻辑是：

```text
SvelteKit 负责应用骨架和 API routes
Svelte 负责交互式 UI
TypeScript 负责数据结构可靠性
Vite 负责开发和构建速度
Tailwind CSS 负责界面样式效率
Web Worker 负责重任务隔离
SvelteKit API routes 负责服务端安全边界
Vercel 负责网页部署
```

这套结构的目标不是一次性覆盖所有平台，而是先把网页端工具做稳。只要业务逻辑保持在 `src/lib`，UI 保持在 `src/components`，服务端能力保持在 `src/routes/api`，未来无论继续做复杂 Web 工具，还是扩展桌面端，架构都不会被早期选择卡死。
