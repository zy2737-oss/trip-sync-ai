# TripSync AI：团队协作

## 本地运行

安装 Node.js 22.13 或更新版本，下载仓库后执行：

```sh
npm run install:ci
npm run dev
```

打开启动信息显示的本地地址。默认端口为 5173。

## 代码位置

- `app/page.tsx`：问卷、用户画像、景点选择、冲突选项和行程展示。
- `app/globals.css`：页面样式与移动端布局。
- `app/api/places/route.ts`：景点数据接口。

当前版本是演示原型：同行成员和行程使用示例数据，问卷答案保存在当前页面状态中；尚未实现跨设备同步、多人回答存储或 LLM 行程生成。景点接口配置 `GOOGLE_PLACES_API_KEY` 时请求 Google Places，否则返回示例数据。

## 提交修改

每人从最新的默认分支创建自己的功能分支，例如 `feature/questionnaire`。完成修改后提交 Pull Request，由另一位队友检查后合并。修改前先沟通负责的页面，避免同时改同一文件。

提交前执行：

```sh
npm run lint
npm run build
```

不要上传 API 密钥、`.env` 文件、`node_modules` 或生成的构建目录。密钥配置在本地或发布平台的环境变量中。

## 实时餐厅查询

每顿饭的 `Find real restaurants` 按钮调用 `/api/restaurants`。服务端使用 Google Places API (New) Text Search，按固定的旅行日、餐次、用餐区域和用户预算档位返回最多三家候选餐厅。第 4 天的平价和高价寿司分开查询。返回店名、地址、Google Maps 链接、价格档位和常规营业时间；不保证未来旅行日营业、菜单价格或可订位。

在 Google Cloud 启用 Places API (New) 和计费，限制 API Key 仅能使用 Places API，并设置调用配额。在 Sites 网站设置中，将 `GOOGLE_PLACES_API_KEY` 添加为秘密环境变量，重新发布。请不要把密钥提交到 GitHub 或写在前端。未配置时返回明确的不可用提示，用户仍可用 Google Maps 搜索链接；不会伪造真实餐厅结果。

本地测试时把密钥放入忽略的 `.dev.vars` 文件：`GOOGLE_PLACES_API_KEY=...`。餐厅选择仅保留在当前行程页面中，尚未与队友同步。接口不持久化或缓存 Places 内容；密钥接入后应在 Google Cloud 设置适合课堂演示的配额。该公开原型的查询接口尚未实施用户级限流。

纯逻辑测试：`node --experimental-strip-types --test tests/restaurant-search.test.mjs`。

## 发布说明

GitHub 用来共同编辑源代码。合并代码后，现有 Sites 网站需要另外发布；仅推送 GitHub 不会自动更新线上网站。`.openai/hosting.json` 保存现有网站的关联信息，请保留它。
