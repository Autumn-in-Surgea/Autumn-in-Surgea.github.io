# 开发、安装和发布

这是《西陆秋色》0.1 的本地开发、安装和 GitHub Pages 发布说明。

## 四个入口的区别

| 入口 | 加载什么 | 什么时候变成新版 | 断网使用 |
| --- | --- | --- | --- |
| 开发网页 `http://127.0.0.1:5173/` | 当前源码，支持热更新 | 保存代码后由 Vite 更新 | 需本机开发服务器运行；没有 PWA 离线缓存 |
| 生产预览 `http://127.0.0.1:5174/` | 最近一次构建的 `dist/` | 重新构建后，通过更新提示载入 | 完成缓存后可离线启动 |
| 从本地地址安装的 PWA | 安装来源地址的生产版本和缓存 | 同一来源地址重新提供新版，应用检测并提示更新 | 缓存完成且未被清理时可用，无需保持本地服务器运行 |
| 从 GitHub Pages 安装的 PWA | Pages 发布的生产版本和缓存 | 发布新版本并联网获取更新 | 缓存完成且未被清理时可用 |

修改源码不会自动改掉已经安装的生产版本。要更新本地安装版本，需要重新构建，并在**原来的协议、主机名、端口和路径**提供新版本，再打开应用，等待“更新并重启”。当前更新流程先保存对局，AI 忙时不允许重启；普通联网检查不会强制刷新正在玩的页面。[Vite PWA 更新说明](https://vite-pwa-org.netlify.app/guide/prompt-for-update)

本地对应命令：

```bash
# 开发界面
npm run dev

# 构建、校验并提供生产版本，按顺序执行
npm run build
npm run verify:pwa
npm run preview
```

这里列出的 `5173`、`5174` 已固定在 npm 脚本中。`--strictPort` 防止端口占用时静默换地址。`vite preview` 用于本机验收，公网发布由静态托管服务提供。[Vite 静态部署说明](https://vite.dev/guide/static-deploy)

## 存档与已安装应用

浏览器按协议、主机名、端口区分来源。下面这些来源相互独立：

- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://localhost:5174`
- `https://autumn-in-surgea.github.io`

因此开发网页、本地生产版和 Pages 版的存档不会自动迁移；`localhost` 与 `127.0.0.1` 即使访问同一台电脑也不共用存档。不同浏览器、浏览器资料或设备之间也没有云同步。[浏览器同源与存储规则](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)

迁移方法：在旧入口的“设置”中导出存档 → 打开新入口 → “设置”中导入存档。若新入口已有要保留的对局，先导出其备份，再主动导入。不要为迁移清空旧应用的数据。

本地安装的 PWA 不会自动改成 GitHub Pages 应用。Pages 发布后应从 Pages 地址另行安装，再导入需要继续的存档。手机上的 `localhost` / `127.0.0.1` 指手机自己，不能用它访问电脑上的预览服务。

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

PWA 文档建议页面、manifest 和 Service Worker 避免长期不可变缓存；Pages 的实际响应头由托管平台决定，上线后须检查更新行为，不能只根据本地预览判断更新已生效。[Vite PWA 部署要求](https://vite-pwa-org.netlify.app/deployment/)

更详细的离线流程见 [PWA.md](PWA.md)，已执行和待执行的测试分别记录在 [VERIFICATION.md](VERIFICATION.md)。
