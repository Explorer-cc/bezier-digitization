# Bezier Digitization

Default language: English. Switch to [中文](#中文) below.

Browser-based curve digitization and export tool for tracing reference images into editable cubic Bezier paths.

Live site:

```text
https://explorer-cc.github.io/bezier-digitization/
```

## Features

- Upload a reference image from file selection, drag-and-drop, or clipboard paste.
- Pan and zoom the canvas while tracing.
- Move, resize, rotate, lock, and adjust opacity for reference images.
- Draw freehand strokes and simplify them into editable cubic Bezier curves.
- Trace point-by-point cubic Bezier paths.
- Edit curve anchors and control handles directly on the canvas.
- Snap to calibrated grid points and nearby path endpoints.
- Set a coordinate origin and horizontal unit length calibration.
- Export selected curves as TikZ, LuaDraw, or CeTZ code.

## Development

Install dependencies with the project-local pnpm store:

```powershell
pnpm install --store-dir .pnpm-store
```

Start the development server:

```powershell
pnpm dev --host 127.0.0.1 --port 5189 --strictPort
```

Run checks and tests:

```powershell
pnpm check
pnpm test
```

Build for production:

```powershell
pnpm build
```

## GitHub Pages Build

This app is deployed as a static SvelteKit site. For the GitHub Pages project URL, build with the repository base path:

```powershell
$env:BASE_PATH='/bezier-digitization'
pnpm check
pnpm test
pnpm build
pnpm preview
```

The static build output is written to `build/`. A successful Pages build should include:

- `build/index.html`
- `build/404.html`
- generated assets under `build/_app/`

Deployment is handled by `.github/workflows/deploy.yml` on pushes to `main` and manual workflow runs. In the GitHub repository settings, set `Settings > Pages > Source` to `GitHub Actions`.

## Import Methods

Supported reference-image import methods:

- file picker
- image drag-and-drop
- clipboard paste

Supported image formats depend on browser support for common web image types.

## Export Formats

The export panel currently supports:

- TikZ paths using `.. controls .. and ..`
- LuaDraw `g:Dbezier(...)` output for open paths
- CeTZ `bezier(...)` output

Export precision is configurable in the UI.

## Tech Stack

- SvelteKit 2
- Svelte 5 runes
- TypeScript
- Paper.js
- Tailwind CSS through `@tailwindcss/vite`
- Vitest
- pnpm

## 中文

默认语言：英文。你可以在这里切换到中文。

这是一个基于浏览器的曲线数字化工具，用于把参考图像描成可编辑的三次 Bezier 路径。

线上地址：

```text
https://explorer-cc.github.io/bezier-digitization/
```

## 功能

- 通过文件选择、拖拽或剪贴板粘贴导入参考图像。
- 在描线时支持画布平移和缩放。
- 可移动、缩放、旋转、锁定并调整参考图像透明度。
- 支持自由手绘并简化为可编辑的三次 Bezier 曲线。
- 支持逐点绘制三次 Bezier 路径。
- 可在画布上直接编辑曲线锚点和控制柄。
- 支持网格点吸附和路径端点吸附。
- 可设置坐标原点和横向单位长度标定。
- 可导出选中的曲线为 TikZ、LuaDraw 或 CeTZ 代码。

## 本地开发

使用项目本地 pnpm store 安装依赖：

```powershell
pnpm install --store-dir .pnpm-store
```

启动开发服务器：

```powershell
pnpm dev --host 127.0.0.1 --port 5189 --strictPort
```

运行检查和测试：

```powershell
pnpm check
pnpm test
```

构建生产版本：

```powershell
pnpm build
```

## GitHub Pages 构建

这个项目会作为静态 SvelteKit 站点部署。为了适配 GitHub Pages 的项目子路径，请使用仓库 base path 构建：

```powershell
$env:BASE_PATH='/bezier-digitization'
pnpm check
pnpm test
pnpm build
pnpm preview
```

静态构建产物会输出到 `build/`。一个正常的 Pages 构建应包含：

- `build/index.html`
- `build/404.html`
- `build/_app/` 下的资源文件

部署由 `.github/workflows/deploy.yml` 负责，在推送到 `main` 或手动触发时运行。GitHub 仓库设置里需要把 `Settings > Pages > Source` 设为 `GitHub Actions`。

## 导入方式

当前支持的参考图像导入方式：

- 文件选择
- 图像拖拽
- 剪贴板粘贴

支持的图片格式取决于浏览器对常见网页图片类型的支持。

## 导出格式

当前导出面板支持：

- TikZ，使用 `.. controls .. and ..`
- LuaDraw 的 `g:Dbezier(...)`，用于开路径
- CeTZ 的 `bezier(...)`

导出精度可以在界面中调整。

## 技术栈

- SvelteKit 2
- Svelte 5 runes
- TypeScript
- Paper.js
- 通过 `@tailwindcss/vite` 使用 Tailwind CSS
- Vitest
- pnpm
