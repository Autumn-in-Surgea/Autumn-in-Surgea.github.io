# 开发、安装和发布

这是《西陆秋色》0.1 的本地开发、安装和 GitHub Pages 发布说明。

## 本地开发与生产验收

| 入口 | 加载什么 | 什么时候变成新版 | 断网使用 |
| --- | --- | --- | --- |
| 开发网页 `http://127.0.0.1:5173/` | 当前源码，支持热更新 | 保存代码后由 Vite 更新 | 需要本机开发服务器运行 |
| GitHub Pages 网页 | 通过 CI 发布的静态构建 | 发布完成后，联网取得新版 | 完成缓存后可离线启动 |
| 从 GitHub Pages 安装的 PWA | Pages 发布的生产版本和缓存 | 发布新版本并联网获取更新 | 缓存完成且未被清理时可用 |

本地使用以下命令开发和检查构建产物。

```bash
npm ci
npm run dev

# 发布前检查
npm test
npm run build
npm run verify:pwa
```

本地试玩固定用 `5173`。`--strictPort` 在端口占用时直接报错，保证开发来源和存档地址稳定。正式安装、断网读档、AI 和版本更新都在 Pages 站点验收。发布新版后，已安装应用联网时会检查更新。AI 空闲时点击“更新并重启”，应用先保存对局，再载入新版。[Vite 静态部署说明](https://vite.dev/guide/static-deploy) · [Vite PWA 更新说明](https://vite-pwa-org.netlify.app/guide/prompt-for-update)

## 存档与已安装应用

浏览器按协议、主机名、端口区分来源。开发地址 `http://127.0.0.1:5173/`、旧本地安装版和 `https://autumn-in-surgea.github.io/` 各有独立的存档。`localhost` 与 `127.0.0.1` 也是不同来源。不同地址、浏览器、浏览器资料或设备之间用导出的 JSON 搬运对局。[浏览器同源与存储规则](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)

在旧入口的“设置”中导出存档，再打开新入口并导入。如果新入口已有要保留的对局，先导出那份存档。此前从本地安装的用户可以从 Pages 地址安装新版，再导入旧对局。

## GitHub Pages 发布准备

[Autumn-in-Surgea/Autumn-in-Surgea.github.io](https://github.com/Autumn-in-Surgea/Autumn-in-Surgea.github.io) 是组织站点仓库，默认发布到根地址 [autumn-in-surgea.github.io](https://autumn-in-surgea.github.io/)。Actions 运行详情里的 `github-pages` 环境会提供部署结果和站点链接。[GitHub Pages 站点类型](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

推送到 `main` 会触发 `.github/workflows/deploy-pages.yml`。把 PR 合并到 `main` 也会触发同一流程。工作流依次执行 `npm ci`、`npm test`、`npm run build`、`npm run verify:pwa`，全部通过后仅上传 `dist/` 并部署；不上传源码目录、文档或本地存档。

1. 首次设置时，在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 提交改动并推送 `main`（`git push origin main`）。
3. 在 **Actions → Deploy GitHub Pages** 查看本次推送对应的提交号。构建和部署均成功后，打开运行记录里的站点链接。
4. 已安装的 Pages 应用在线打开后会检查更新。看到“更新并重启”时，点击即可保存并切到新版本。

手动发布当前代码时，点工作流页的 **Run workflow** 并选 `main`。**Re-run jobs** 会重试该记录关联的原提交。

站点首次启用需要该组织仓库的设置权限。[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

Pages 负责通过 HTTPS 分发静态文件。游戏 AI 继续在玩家设备的 Web Worker 中执行；发布不会增加服务端 AI、账号、存档同步或多人对战后端。[GitHub Pages 服务性质](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## 根目录部署与更新验收

当前 `base: "./"` 将构建资源写为相对路径；manifest 的 `id`、`scope`、`start_url` 及 Service Worker 注册路径也相对项目目录。同一构建可发布到站点根目录，也可部署到以 `/` 结尾的预览子目录。[Vite 相对基础路径](https://vite.dev/guide/build#relative-base)

上线后应在实际 Pages URL 复查：

- 页面、manifest、图标、Service Worker、AI Worker 均从 `https://autumn-in-surgea.github.io/` 根站点加载。
- 确认安装后的启动地址为站点根地址，关闭所有窗口后再测试断网启动、读档和结束 AI 回合。
- 发布第二个版本后，旧窗口保持可操作；联网看到更新提示，主动保存并更新后可以继续旧存档。

更新应保持站点地址和应用标识稳定。后续增加路径路由、改域名或改仓库名时，需要重新检查资源路径、应用身份和存档迁移。不要通过改 `id`、清理所有站点数据或强制刷新来掩盖缓存问题。

PWA 文档建议页面、manifest 和 Service Worker 使用可重新验证的缓存。Pages 的实际响应头由托管平台决定，部署完成后以正式站点的更新行为为准。[Vite PWA 部署要求](https://vite-pwa-org.netlify.app/deployment/)

更详细的离线流程见 [PWA.md](PWA.md)，已执行和待执行的测试分别记录在 [VERIFICATION.md](VERIFICATION.md)。
