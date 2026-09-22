(() => {
  if (document.getElementById("qingxu-shared-navigation")) return;
  const groups = [
    { label: "数学", path: "/math/", children: [
      ["全部数学内容", "/math/"],
      { label: "第一章 · 集合与逻辑", children: [["知识回看", "/math/chapter1/"], ["五天思维训练", "/math/training/"]] },
      { label: "第二章 · 等式与不等式", children: [["知识回看", "/math/chapter2/"], ["错因回看", "/math/chapter2/chapter2-review-20260919.html"], ["定向练习", "/math/chapter2/chapter2-practice-20260919.html"], ["已学内容诊断", "/math/chapter2/diagnostic.html"]] },
      { label: "第三章", children: [["知识点回看", "/math/chapter3/review-20260919.html"], ["无提示复测 01", "/math/chapter3/retest-01-20260919.html"]] },
      { label: "阶段训练", children: [["前两周弱项回看", "/math/weaks-review-20260913.html"], ["弱项 12 题", "/math/weaks-practice-20260913.html"], ["月考针对训练", "/math/monthly-exam-1-targeted-01.html"], ["月考诊断卷", "/math/monthly-exam-1-diagnostic.html"]] }
    ] },
    { label: "物理", path: "/physics/", children: [
      ["全部物理内容", "/physics/"], ["前两周测试与订正", "/physics/weeks1-2-diagnosis-training.html"],
      { label: "第一章 · 运动的描述", children: [["知识回看", "/physics/chapter1.html"], ["针对练习", "/physics/chapter1-practice.html"], ["最近作业专项", "/physics/motion-practice-20260910.html"]] },
      { label: "第二章 · 匀变速运动", children: [["知识小结", "/physics/chapter2-review.html"], ["针对练习", "/physics/chapter2-practice.html"]] }
    ] },
    { label: "化学", path: "/chemistry/", children: [["全部化学内容", "/chemistry/"], ["第一册 · 错题讲解", "/chemistry/book1-review-20260922.html"], ["第一册 · 8题强化", "/chemistry/book1-practice-20260922.html"], ["第一轮错题专项", "/chemistry/special-practice-1.html"]] },
    { label: "英语", path: "/english/", children: [["全部英语内容", "/english/"], ["第二轮 · Day32–71", "/english/round2/"], ["语法专项 · 逐题讲解", "/english/grammar/"], ["Day 1 · 综合诊断", "/english/day1/"], ["Day 2–5", "/english/day2-5/"], ["Day 6–10", "/english/day6-10/"], ["Day 11–20", "/english/day11-20/"], ["Day 21–31 目录", "/english/day21-28.html"], ["Day 29", "/day29.html"], ["Day 30", "/day30.html"]] }
  ];
  const normalize = path => path.replace(/index\.html$/, "");
  const path = normalize(location.pathname);
  const subject = groups.find(group => path.startsWith(group.path) || (group.path === "/english/" && /^\/day\d/.test(path)));
  const esc = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const contains = node => Array.isArray(node) ? normalize(node[1]) === path : node.children.some(contains);
  const link = (label, href) => `<a href="${href}" ${normalize(href) === path ? 'aria-current="page"' : ""}>${esc(label)}</a>`;
  const items = nodes => nodes.map(node => Array.isArray(node) ? link(...node) : `<details ${contains(node) ? "open" : ""}><summary>${esc(node.label)}</summary><div class="children">${items(node.children)}</div></details>`).join("");
  const navigation = () => `<nav aria-label="学习空间导航">
    <div class="primary">${link("学习首页", "/")}${link("学习进度", "/progress/")}</div>
    <a class="sync-card" href="/progress/"><span class="sync-title">我的学习进度</span><strong data-summary>登录后查看云端进度</strong><small data-sync>在手机和电脑间接着学</small></a>
    <p class="section-label">学科与章节</p>
    ${groups.map(group => `<details class="subject" ${subject === group ? "open" : ""}><summary ${subject === group ? 'class="active-subject"' : ""}>${group.label}</summary><div class="children">${items(group.children)}</div></details>`).join("")}
    <p class="note">首次作答 · 订正 · 复测<br>分开记录，一步一步完成。</p>
  </nav>`;
  const host = document.createElement("div");
  host.id = "qingxu-shared-navigation";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>
    :host{display:block;color:#21364b;font:14px/1.6 system-ui,-apple-system,"PingFang SC",sans-serif;color-scheme:light}
    *{box-sizing:border-box}a{color:inherit;text-decoration:none}button,summary,a{-webkit-tap-highlight-color:transparent}
    button{font:inherit;cursor:pointer}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #46745f;outline-offset:2px}
    .desktop{display:none}.brand{display:block;font-weight:800;font-size:19px;letter-spacing:.03em}.brand small{display:block;font-size:11px;font-weight:500;letter-spacing:.15em;color:#718176;margin-top:2px}
    .mobile-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:#fafcf9;border-bottom:1px solid #dde5dd}
    .mobile-bar .brand{font-size:16px}.mobile-bar small{font-size:12px;color:#64776b}.menu-button,.close{min-height:44px;padding:8px 14px;border:1px solid #cad9ce;border-radius:10px;background:white;color:#2e5540}
    nav a{display:block;padding:10px 12px;border-radius:9px;min-height:44px;overflow-wrap:anywhere}
    nav a:hover{background:#edf2ed}nav a[aria-current]{background:#dfebe1;color:#204b32;font-weight:750;border-left:3px solid #3e7150}
    .primary{display:grid;gap:4px;margin-top:20px;font-weight:700}.sync-card{margin:18px 0;padding:14px!important;background:#edf3ec;border:1px solid #d7e3d5}
    .sync-title{font-size:11px;color:#5a715e}.sync-card strong{display:block;font-size:14px;margin:5px 0}.sync-card small{display:block;font-size:11px;color:#64776b}
    .section-label{margin:22px 12px 8px;color:#718176;font-size:11px;letter-spacing:.15em}
    details summary{cursor:pointer;padding:10px 12px;min-height:44px;border-radius:8px}
    .subject>summary{font-weight:750;font-size:15px}.active-subject{color:#2d6745;background:#f0f4ed}
    .children{padding-left:10px;margin-left:8px;border-left:1px solid #dce4da}.children a,.children summary{font-size:13px}
    .note{margin:28px 12px 12px;font-size:11px;line-height:1.9;color:#78877a}
    dialog{position:fixed;inset:0 auto 0 0;margin:0;width:min(340px,90vw);height:100%;height:100dvh;max-height:100dvh;max-width:90vw;border:0;background:#fafcf9;color:#21364b;padding:22px 18px;overflow-y:auto;overscroll-behavior:contain}
    dialog::backdrop{background:rgba(19,35,26,.45)}.drawer-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
    @media(min-width:1280px){.mobile-bar{display:none}.desktop{display:block;position:fixed;left:0;top:0;bottom:0;width:240px;padding:28px 18px;overflow-y:auto;overscroll-behavior:contain;background:#fafcf9;border-right:1px solid #dce4da;z-index:100}}
    @media print{:host{display:none!important}}
  </style>
  <aside class="desktop" aria-label="学习侧栏"><a class="brand" href="/">清许学习空间<small>LEARN AT YOUR OWN PACE</small></a>${navigation()}</aside>
  <header class="mobile-bar"><div><a class="brand" href="/">清许学习空间</a><small>${esc(subject?.label || (path === "/progress/" ? "学习进度" : "学习首页"))}</small></div><button class="menu-button" aria-haspopup="dialog" aria-controls="qx-nav-drawer" aria-expanded="false">目录与进度</button></header>
  <dialog id="qx-nav-drawer" aria-label="目录与学习进度"><div class="drawer-head"><span class="brand">目录与进度</span><button class="close" autofocus>关闭菜单</button></div>${navigation()}</dialog>`;
  // Only reserve a rail on wide screens. Existing in-page TOCs and print layouts remain intact.
  const offset = document.createElement("style");
  offset.textContent = "@media screen and (min-width:1280px){body{padding-left:calc(240px + var(--qx-body-padding,0px))!important;box-sizing:border-box}}";
  document.body.style.setProperty("--qx-body-padding", getComputedStyle(document.body).paddingLeft);
  document.head.append(offset);
  document.body.prepend(host);
  const button = shadow.querySelector(".menu-button");
  const dialog = shadow.querySelector("dialog");
  let previousOverflow = "";
  button.addEventListener("click", () => {
    previousOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    button.setAttribute("aria-expanded", "true");
  });
  const close = () => dialog.close();
  shadow.querySelector(".close").addEventListener("click", close);
  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }
    if (event.target.closest("a")) close();
  });
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = previousOverflow;
    button.setAttribute("aria-expanded", "false");
    button.focus();
  });
  const desktop = matchMedia("(min-width:1280px)");
  desktop.addEventListener("change", event => { if (event.matches && dialog.open) close(); });
  window.addEventListener("beforeprint", () => { if (dialog.open) close(); });
  window.addEventListener("qx-progress-summary", event => {
    const info = event.detail;
    for (const node of shadow.querySelectorAll("[data-summary]")) node.textContent = info.signedIn ? info.ready ? `已完成 ${info.completed} / ${info.total} 项` : "云端进度待确认" : "登录后查看云端进度";
    for (const node of shadow.querySelectorAll("[data-sync]")) node.textContent = info.signedIn ? info.label : "在手机和电脑间接着学";
  });
  // Shared auth state without adding a separate database client for the sidebar.
  if (document.documentElement.dataset.answerStorage !== 'local' && !path.startsWith('/english/grammar/') && (/^\/(english|math|physics|chemistry)\//.test(path) || /^\/day\d+\.html$/.test(path))) {
    const answers = document.createElement("script"); answers.src = "/shared/answer-records.js";
    document.body.append(answers);
  }
  if (!document.querySelector('script[src="/shared/progress-sync.js"]')) {
    const script = document.createElement("script"); script.src = "/shared/progress-sync.js";
    script.addEventListener("error", () => {
      for (const node of shadow.querySelectorAll("[data-sync]")) node.textContent = "同步服务未加载，可前往进度页重试";
    });
    document.body.append(script);
  }
})();
