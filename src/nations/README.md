# 国家资源包

`imperia/`、`determia/`、`nosta/`、`ida/`、`rina/` 分别保存五国的资料。国家目录登记资料、模型和棋子帽型，也可定义独立的地块资产。

| 文件 | 内容 |
| --- | --- |
| `index.ts` | 国家 ID、中英文名、首都名、配色、开局配置、提示文案、模型键、地块变体 ID |
| `logo.png` | 网页和 PWA 共用的透明徽标，五国原图存放在 `设定/` |
| `models.ts` | 导出部队、船舰、城市、建设设施和行动徽标高度，以及该国的地块资产入口 `terrain` |
| `headwear.ts` | 该国的棋子帽型，步兵、骑手和乘员共用 |
| `fleet.ts` | 该国舰船的色板、舰桥设备、旗形与旗面图案 |
| `terrain.ts` | 自定义地块造型时提供格面和底座、自然地形、资源、遗迹、灯塔和表面点缀。共享资产见 `imperia/terrain.ts` |

`opening.technologies` 是开局已研究的科技 ID，可填多项。`unit` 是初始兵种 ID，`stars` 是初始星星，`cityLevel` 是首都等级。公平模式可用 `fairDeposit` 配置首都周围对应的地形、资源和数量。`notices.opening` 是该国玩家的开局提示，`notices.firstContact` 是其他玩家第一次遇到该国时看到的文案。

`boardColor` 指定本国的高亮识别色，通用于领土边界、陆军圆盘和舰船条带及旗帜。`color` 供城市和界面使用。读入旧档时，棋盘识别色按国家 ID 读取当前资源包。

## 地块资产

`terrainVariant` 指定地块使用的国家资产包。公平和故事模式在开图时按最近的开局据点为每个坐标分配变体。自由模式的匿名势力使用帝国变体。五国当前均配置为 `imperia`。

变体 ID 随地块存档。占领、砍伐、烧林和种林只更新各自的规则字段。缺少变体字段的旧档会补为 `imperia`。当前棋盘和开局预览统一使用帝国地块资产，ID 仍留给未来的地貌和自然资源包。城市和部队使用当前归属的模型包，中立村落按地块的变体 ID 选择所属国风格。

## 部队造型

五国在各自的 `models.ts` 中调用 `nationalUnits(id)`。共享的风格 B 人物和装备位于 `_shared/pawns/`。修改帽型用本国的 `headwear.ts`，修改职业动作与持物用 `roles.ts` 和 `equipment.ts`，修改马匹、炮组与装甲车的组合用 `land.ts`。七种舰船在 `_shared/pawns/fleet.ts` 中装配，各国的舰桥、旗形和涂装由本国目录的 `fleet.ts` 定义。自由模式的匿名势力使用帝国造型和该势力的棋盘色。

单位在首次显示时合并为主体和阵营色两个网格，后续同国同兵种复用。选择描边、战斗动作与点击检测共用对局中的模型。

## 城市和设施样式

帝国在 `imperia/structures.ts` 登记各级城市的四种样式。城市最高的主楼由共享模型绘制，帝国按发展阶段更换整套配楼、街巷和院落，分别定义在 `liaoCities.ts`、`civicCities.ts` 和 `bundCities.ts`。地图种子和坐标决定样式索引，同一格在读档、升级和回放中选取相同索引。旧档也可即时计算。其他国家可在模型包上提供 `structureVariantCount`，并在 `city` 工厂使用最后一个参数。各类设施在每一发展档统一使用一个帝国造型与配色。港口、桥梁和道路仍沿地形和连接方向放置。

## 添加国家

1. 复制一个国家目录。给 `index.ts` 设置独立的 `id` 和 `modelSet`，填写资料并替换 `logo.png`。徽标以透明 PNG 导入，当前显示资源为 192 × 192。科技、兵种、地形和资源 ID 参考游戏配置与类型。
2. 在 `types.ts` 的 `NationId` 中加入国家 ID，在 `registry.ts` 的 `registered` 登记资料包，在 `models.ts` 以新 `modelSet` 键注册模型入口。
3. 在 `_shared/pawns/sculpt.ts` 中登记帽型，在本国的 `fleet.ts` 中配置舰船配色、旗形与甲板设备，再在 `_shared/pawns/fleet.ts` 中登记。可沿用已有国别的设计。将本国的 `models.ts` 指向所需的 `nationalUnits(...)` 入口。
4. 从该国的 `models.ts` 导出 `terrain`，并在上级目录 `models.ts` 的 `TERRAIN_ASSETS` 中按国家 ID 注册。可共享帝国资产，也可在本国的 `terrain.ts` 中从 `imperialTerrain` 展开改写需要的资产。若开图时要分配本国变体，将本国 `index.ts` 的 `terrainVariant` 指向本国 ID。地形工厂沿用棋格的标准尺寸和海陆标高。
5. 公平模式会读取新登记的国家。加入故事模式还需要在固定地图里配置首都位置。运行 `npm test` 和 `npm run build` 验证。

已发布的国家 ID 也用来解析存档里的地块变体。规则、生成器与 AI 读取国家配置，棋盘和开局预览读取渲染资产。
