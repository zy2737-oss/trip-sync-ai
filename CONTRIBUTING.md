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

## 网站发布

GitHub 用来共同编辑源代码。合并代码后，现有 Sites 网站需要另外发布；仅推送 GitHub 不会自动更新线上网站。`.openai/hosting.json` 保存现有网站的关联信息，请保留它。
