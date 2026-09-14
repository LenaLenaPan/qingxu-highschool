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
学习任务状态通过 Netlify Identity、Functions 与站点级 Blobs 跨设备同步。首次登录会合并当前设备中可识别的既有完成记录。题目中的详细作答文本仍保存在浏览器本地，避免把未整理的个人作答直接上传。
Netlify Identity 应设为 Invite only，只邀请家庭使用的账号。进度数据写入 Blobs 不会触发站点构建。
noindex 仅限制搜索引擎索引，不是访问控制。站点沿用原有公开访问状态。
