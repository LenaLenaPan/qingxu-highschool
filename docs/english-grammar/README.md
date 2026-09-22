# 原题讲解改版 · 2026-09-22发布

用户确认：只要就题论题的语法讲解；本卷相关题放在每题下方。不需要章节知识课或独立共性诊断，不另外出题。预览后用户已明确授权“推送上线”。

当前内容：199条练习，排除23个合并的讲义概述条目。沿用已有转录题干和原ID；122条另写分段解释，其余沿用简明、针对本题的说明。194条有人工选择的关联组，5条没有足够直接的关联，不强行凑数。相关组按小组优先，最多展示3条；A12/B50明确标原题重复。

数据：source-transcription.json保存旧版完整转录；explanations.txt为分段讲解；related-groups.json为关联及比较理由。page-template.html包含界面、样式、浏览和本机记录逻辑。

内容生成：`node scripts/render_grammar_review.cjs`，只输出public/english/grammar/index.html，不运行npm build或部署。

测试：`QX_TEST_JSDOM=/path/to/jsdom node scripts/tests/test_grammar_review.cjs`；`python3 scripts/validate.py`。DOM测试遍历199条，验证题干与转录一致、关联有效、搜索筛选、旧记录兼容和打印；不是逐张原图的新一轮独立转录核验，也不替代真实浏览器视觉验收。

学生本机记录沿用qingxu-grammar-20260922-v1；导入时保留已有本机内容。被排除的讲义概述ID的笔记和标记也保留、可导出。仍未接入云端。

本次依据用户授权推送main并触发Netlify构建。实际部署结果记入site.json。可先看P16 A04↔A10、P21 school/day/reason成对题。
