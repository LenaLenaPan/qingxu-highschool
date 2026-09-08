# 清许学习空间：统一源码与发布约定

现有站点：https://imaginative-faun-bda14e.netlify.app/
Netlify site ID：8a47f003-a56f-4c1f-9b1e-3faadb598225
本包是四科站点的统一源码，后续修改应从最新版本接续，不要仅上传单科页面覆盖整站。

## 日常更新
1. 取回最新版 qingxu-learning-source.zip，读取 site.json 与本说明。
2. 只修改对应 public/ 学科目录；英语 Day21–28 保留根目录的 day21.html 等地址及 assets/。
3. 公共导航只改 public/shared/nav.js，入口页面样式只改 public/shared/portal.css。各科原有样式与题目逻辑保留。
4. 保留原有 localStorage 键、题目 ID、结果格式。迁移题目结构前单独设计记录兼容。
5. 运行 python3 scripts/validate.py。检查页面入口、链接和所有 JS 语法。
6. 通过已连接 Netlify 插件的 deploy-site 获取此站点的临时发布命令，在本目录执行。不要保存返回的临时凭证。
7. 等待部署 ready，核对 production URL、四科入口及旧 Day21–28 地址。发布失败不要声称成功。
8. 更新 site.json 的版本及实际部署 ID，重新打包并替换原有 qingxu-learning-source.zip，保留文件版本历史。

## 范围与限制
当前为人工提出修改、助手编辑检查后直接发布；未连接 GitHub 自动构建，也没有后台监听所有对话。其他学科对话需要明确引用此统一网站及源码包。
作答记录仍为浏览器本地存储，没有跨设备同步或数据库。既有 Netlify 域名和键名不变的记录可继续使用；其他域名或 file:// 下的记录不会自动迁入。
化学仅有待创建入口。源题、答案和学生分析沿用已有材料，本轮只整合页面。
noindex 仅限制搜索引擎索引，不是访问控制。站点沿用原有公开访问状态。
