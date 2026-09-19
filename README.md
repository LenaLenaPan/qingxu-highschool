# 清许学习空间：统一源码与发布约定

现有站点：https://imaginative-faun-bda14e.netlify.app/
Netlify site ID：8a47f003-a56f-4c1f-9b1e-3faadb598225
本包是四科站点的统一源码，后续修改应从最新版本接续，不要仅上传单科页面覆盖整站。

## 日常更新
1. 取回最新版 qingxu-learning-source.zip，读取 site.json 与本说明。
2. 只修改对应 public/ 学科目录；英语 Day21–28 保留根目录的 day21.html 等地址及 assets/。
3. 公共导航只改 public/shared/nav.js，入口页面样式只改 public/shared/portal.css。各科原有样式与题目逻辑保留。
4. 保留原有 localStorage 键、题目 ID、结果格式。迁移题目结构前单独设计记录兼容。
5. 运行 `npm run build` 生成进度同步脚本，再运行 `python3 scripts/validate.py` 检查页面入口、链接和所有 JS 语法。
6. 日常内容修改只保留在源码中，不因单个页面更新而零散发布。只有用户明确说“构建”“推送上线”或“集中构建”时，才统一推送并触发一次 Netlify 构建。
7. 等待部署 ready，核对 production URL、四科入口、进度中心及旧 Day21–28 地址。发布失败不要声称成功。
8. 更新 site.json 的版本及实际部署 ID，保留文件版本历史。

## 范围与限制
当前为人工提出修改、助手编辑检查后集中发布；没有后台监听所有对话。其他学科对话需要明确引用此统一网站及源码。
学习进度中心与首页通过 Supabase Auth 和 learning_progress 表跨设备同步。沿用独立测试项目 qtzowtlqudotkomzrntg 的邮箱账号，正式进度和 learning_progress_test 分表存放。登录会话由锁定版本的官方 SDK 持久化并刷新。勾选立即保存；切回页面、恢复网络或点击“读取云端”时刷新。同步失败时暂停修改，读取云端确认后再继续。
任务步骤来自 public/data/learning-plan.json，数据库 learning_task_catalog 验证任务与步骤。新增任务时须同时更新数据库目录；客户端不能自行创建目录。database/learning-progress.sql 是本次已执行的建表脚本，仅用于空数据库初始化，不要重复执行。database/test-learning-progress.sql 在事务内测试权限和版本冲突，结束后回滚。
只同步步骤、任务安排及服务器完成时间，不上传详细作答文本。每行绑定 auth.uid()，按任务版本进行条件更新，避免设备之间静默覆盖。完整勾选才进入“已完成”，取消任一步会清除完成时间。
旧 localStorage 键和 Netlify Blobs/API 保留。“导入旧记录”只补充当前账号缺少的任务，优先采用仍可访问的旧云端记录，不覆盖 Supabase 中已有任务。需要在保留旧记录的设备上操作；旧 Netlify 云端仅在该设备仍有有效旧登录会话时可读取。测试页模拟数据不会导入。
Supabase 账号由管理员创建，页面不提供注册入口。勾选进度直接写数据库，不触发 Netlify 构建。旧 Netlify 依赖与函数保留供迁移与回退使用。
noindex 仅限制搜索引擎索引，不是访问控制。站点沿用原有公开访问状态。
