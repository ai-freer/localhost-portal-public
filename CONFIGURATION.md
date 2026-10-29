# 框架与实例配置

## 文件边界

HTTP 边界：使用 `portal_server.py` 只提供明确列出的运行资源；本地栅格图可放在 assets/ 下（推荐 assets/card-media/），目录和文件名使用英文字母、数字、下划线或连字符；不提供目录列表、SVG 文件或符号链接。新增其他脚本、样式时需审查并同步白名单，不能改为开放整个目录。

通用框架：`index.html`、`bootstrap.js`、`config.js`、`services.js`、`shares.js`、`visuals.js`。
实例内容：`instance.json`、`services.json`、`shares.json`、`artwork.json`。
本机运行：macOS 安装器在当前用户的 LaunchAgents 目录生成专属 plist，见 AUTOSTART.md；它不在源码目录内。若个人实例另有启动或隧道配置，同样不随框架更新覆盖。

加载顺序：读取四份 JSON 并校验 → 渲染通用页面。只支持 HTTP(S) 打开；不再在代码中保存默认配置副本。配置加载失败显示错误，不清空浏览器数据。

## instance.json

- `schemaVersion`：目前为 1。
- `title`、`brand`、`sidebarNote`、`servicesTitle`、`servicesSubtitle`、`sharesSubtitle`、`quickExample`：站点文案。
- `storage.services`、`storage.shares`：两个独立的 localStorage 键。已有实例不要改键；新实例使用不同前缀。
- `serviceCategories`：按 JSON 属性顺序展示。每个分类可配置 `icon`；`includeTunnel: true` 会包含所有标记为隧道的服务。
- `shareCategories`：按分类名称配置 `icon`、`tone`、`sort`。`tone` 支持 blue、teal、violet、amber、rose；`sort` 支持 manual、date-desc。
- `probeServices`：是否进行服务可达性检测。演示实例关闭；关闭时服务显示“未检测”。

分类名称在当前兼容格式中仍是关联键；重命名时同时更新条目和实例分类配置。分享分类的显示顺序以 shares.json 的 categories 为准。新增用户分类没有主题配置时使用通用图标和蓝色。

## services.json

结构为 `{ "version": 1, "services": [...] }`。
条目必填 `name`、`url`、`category`；可选 `id`、`aliases`（字符串数组）、`emoji`、`note`、`tunnel`、`nonWeb`。
网页只接受 HTTP(S)；非网页连接串需显式设置 `nonWeb: true`，点击复制而不导航。禁止把密码或访问令牌放入配置。

## shares.json

结构为 `{ "version": 1, "categories": ["学习资料"], "shares": [...] }`。
条目字段：`id`、`name`、`url`、`category`、`originalName`、`date`、`aliases`、`artwork`。
日期未知留空，已知使用 YYYY-MM-DD。URL 保留原始字符串；按 URL 标准化结果检查重复，不移除查询参数或锚点。不同空间各自去重。

`artwork` 引用 artwork.json 中的键，与 URL、标题无关。旧浏览器条目没有此字段时，先按相同 ID 或完整 URL 查找文件默认条目的配图；加载不会写回浏览器存储。编辑或导出时会携带解析出的配图引用。

## artwork.json

键为稳定配图标识，值为 SVG 内部图形片段，不包括外层 svg 标签。图形坐标系固定为 96×64，外层样式由框架提供。仅允许静态 path、rect、circle、ellipse、line、polyline、polygon、g 和绘图属性。禁止脚本、事件、外链和 SVG 文字。

绘图尺寸、线宽、渐隐与截图要求见 SHARE_CARD_STYLE.md。

## 保存、导入与备份

1. 首次访问使用文件配置；已有浏览器配置始终优先，包括空列表。提高文件 version 不会覆盖收藏。
2. 页面编辑仅保存当前浏览器；提示会提醒导出。不会自动写入磁盘或 Git。
3. 文件配置更新后，已有浏览器需要主动导入或重置。导入是替换，不是自动合并；服务和分享分别操作，替换前有确认。
4. 若浏览器和文件都发生修改，先导出浏览器版本，按 ID/URL 对比并合并文件，再导入合并结果。保留用户删除，不自行补回默认条目。
5. 导出的 JSON 写回本实例对应文件后，再通过私有仓备份。四份实例配置必须一起保留，配图和分类主题不在条目导出中。
6. 新增默认条目不会自动补回浏览器已删除的内容；导入前明确核对要保留的修改。

默认配置文件和浏览器存储都不是加密存储。静态部署会让可访问该站点的人读取配置；真实配置只用于你授权的私有环境。

## 检查

运行 `node --test config.test.cjs` 校验配置和存储规则（Node 仅用于开发检查，运行导航不需要 Node）。浏览器检查两个空间、分类、搜索、编辑、导出/导入，并实际截图检查桌面 1440×1000 和手机 390×844 的深浅主题。

## 可选 card-media.json

通用渲染由 card-media.js/card-media.css 提供；映射和图片是实例内容，不在框架覆盖清单中。card-media.json 缺失、为空或 JSON 损坏只影响图片，不阻止手动启动或自启动；它不参与必需配置完整性检查，前端继续回退到原 SVG/白卡。原四份 JSON、已有存储键和收藏不需迁移。

```json
{
  "version": 1,
  "services": {},
  "shares": {
    "https://example.com/report": {
      "level": 1,
      "type": "source-section",
      "file": "assets/card-media/report.jpg",
      "crop": [100, 80, 520, 400],
      "sourceSize": [1200, 800],
      "source": "https://example.com/report#summary",
      "reason": "原版时间线与状态分栏"
    }
  }
}
```

键为原始完整 URL，保留查询和锚点，服务/分享分别匹配。crop 是原图像素的 x/y/width/height，sourceSize 是原图宽高；必须在图像边界内。未裁切时可用 focus（如 70% 40%）、fit（cover/contain）、brightness（0.5–1.5）。file 只接受 assets/ 下本地静态栅格图，禁止外链与路径上溯。level/type/source/reason 用于维护溯源，不显示业务状态。

配图映射不写入 localStorage 或条目导出。完整实例备份除四份原配置外，还要包含 card-media.json 和 assets/card-media/。刷新配图不用重新导入收藏。测试：node --test config.test.cjs card-media.test.cjs。

## 连接地址卡片

非网页服务默认作为连接地址呈现，数据库与缓存协议采用对应 SVG 图形，点击复制原始连接串。HTTP API 需要在 card-media.json 的 services 完整 URL 映射中显式声明 `"service":{"role":"endpoint","kind":"model"}`，不按名称或端口猜测。kind 支持 model、database、cache、connection。此声明独立于图片字段；不需要 file，不改变原 services.json 或浏览器收藏。

服务网格和全局搜索均使用“复制地址”操作；分享空间的相同 URL 仍按分享链接打开。普通 HTTP 网页无声明时保持原行为。监听端口只说明有进程监听，不能当作实际依赖或使用证明。

服务条目还可在同一个映射中设置 `"brand":{"file":"assets/brands/example.png","iconFile":"assets/brands/example-icon.png","surface":"light"}`。file 为完整官方标识，iconFile 为可选官方小图标；surface 为 light、dark 或 none。只接受本地静态栅格图片，以 contain 保持比例与原色，不作为整页截图裁切。来源与许可说明留在实例素材记录；brand.attribution 可存需要在页面底部显示的权利归属说明（最多 300 字符）。品牌展示不会把普通网页改成连接服务；连接动作仍由 service.role 或 nonWeb 决定。
