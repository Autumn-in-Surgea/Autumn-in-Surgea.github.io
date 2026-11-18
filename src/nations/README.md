# 国家资源包

`imperia/`、`determia/`、`nosta/`、`ida/`、`rina/` 分别保存五国的资料。每包有三个入口文件。

| 文件 | 内容 |
| --- | --- |
| `index.ts` | 国家 ID、中英文名、首都名、棋盘色与浅色、开局配置、提示文案及模型键 |
| `logo.png` | 网页和 PWA 共用的透明徽标，五国原图存放在 `设定/` |
| `models.ts` | 部队、船舰、城市和建设设施的模型入口，以及资源模型与血量标签高度 |

`opening.technologies` 是开局已研究的科技 ID，可填多项。`unit` 是初始兵种 ID，`stars` 是初始星星，`cityLevel` 是首都等级。公平模式可用 `fairDeposit` 配置首都周围对应的地形、资源和数量。`notices.opening` 是该国玩家的开局提示，`notices.firstContact` 是其他玩家第一次遇到该国时看到的文案。

## 添加国家

1. 复制一个国家目录。给 `index.ts` 设置独立的 `id` 和 `modelSet`，填写资料并替换 `logo.png`。徽标以透明 PNG 导入，当前显示资源为 192 × 192。科技、兵种、地形和资源 ID 参考游戏配置与类型。
2. 在 `registry.ts` 引入该包并加入 `registered`，在 `models.ts` 以新 `modelSet` 键注册模型入口。游戏类型会从登记内容生成国家 ID。
3. 沿用共享模型时可保留 `models.ts` 的现有导出。自定义造型时，在本国目录新增模型文件，从共享模型展开，再覆盖需要替换的工厂。例如 `export const models = { ...danubianModels, unit: makeUnit }`。模型函数的参数和返回值见 `_shared/danubian/index.ts`。
4. 公平模式会读取新登记的国家。加入故事模式还需要在固定地图里配置首都位置。运行 `npm test` 和 `npm run build` 验证。

已发布的国家 ID 用来解析存档里的归属。规则与 AI 只导入国家资料和开局配置，棋盘才导入模型入口。
