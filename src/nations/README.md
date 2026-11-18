# 国家资源包

`imperia/`、`determia/`、`nosta/`、`ida/`、`rina/` 分别保存五国的资料。国家目录包含三个基本文件，也可定义独立的地块资产。

| 文件 | 内容 |
| --- | --- |
| `index.ts` | 国家 ID、中英文名、首都名、棋盘色与浅色、开局配置、提示文案、模型键、地块变体 ID |
| `logo.png` | 网页和 PWA 共用的透明徽标，五国原图存放在 `设定/` |
| `models.ts` | 导出部队、船舰、城市、建设设施和血量标签高度，以及该国的地块资产入口 `terrain` |
| `terrain.ts` | 自定义地块造型时提供格面和底座、自然地形、资源、遗迹、灯塔和表面点缀。共享资产见 `imperia/terrain.ts` |

`opening.technologies` 是开局已研究的科技 ID，可填多项。`unit` 是初始兵种 ID，`stars` 是初始星星，`cityLevel` 是首都等级。公平模式可用 `fairDeposit` 配置首都周围对应的地形、资源和数量。`notices.opening` 是该国玩家的开局提示，`notices.firstContact` 是其他玩家第一次遇到该国时看到的文案。

## 地块资产

`terrainVariant` 指定地块使用的国家资产包。公平和故事模式在开图时按最近的开局据点为每个坐标分配变体。自由模式的匿名势力使用帝国变体。五国当前均配置为 `imperia`。

变体 ID 随地块存档。占领、砍伐、烧林和种林会更新各自的规则字段，渲染按原坐标的资产包选择对应地形。缺少变体字段的旧档会补为 `imperia`。城市、建筑和部队继续从当前归属的模型包选取。

## 添加国家

1. 复制一个国家目录。给 `index.ts` 设置独立的 `id` 和 `modelSet`，填写资料并替换 `logo.png`。徽标以透明 PNG 导入，当前显示资源为 192 × 192。科技、兵种、地形和资源 ID 参考游戏配置与类型。
2. 在 `registry.ts` 引入该包并加入 `registered`，在 `models.ts` 以新 `modelSet` 键注册模型入口。游戏类型会从登记内容生成国家 ID。
3. 沿用共享模型时可保留 `models.ts` 的现有导出。自定义造型时，在本国目录新增模型文件，从共享模型展开，再覆盖需要替换的工厂。例如 `export const models = { ...danubianModels, unit: makeUnit }`。模型函数的参数和返回值见 `_shared/danubian/index.ts`。
4. 从该国的 `models.ts` 导出 `terrain`，并在上级目录 `models.ts` 的 `TERRAIN_ASSETS` 中按国家 ID 注册。可共享帝国资产，也可在本国的 `terrain.ts` 中从 `imperialTerrain` 展开改写需要的资产。若开图时要分配本国变体，将本国 `index.ts` 的 `terrainVariant` 指向本国 ID。地形工厂沿用棋格的标准尺寸和海陆标高。
5. 公平模式会读取新登记的国家。加入故事模式还需要在固定地图里配置首都位置。运行 `npm test` 和 `npm run build` 验证。

已发布的国家 ID 也用来解析存档里的地块变体。规则、生成器与 AI 读取国家配置，棋盘和开局预览读取渲染资产。
