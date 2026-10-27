"use strict";
// Server-rendered data browser for the VYRAX backend. Mounted at GET /admin.

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const STATCOL = {
  "Under review": "#b5841e",
  "Pending docs": "#b5841e",
  "Manual verification": "#8a5a10",
  "Referred to competent authority": "#8a5a10",
  Approved: "#2f7a55",
  Flagged: "#b3402e",
};
const pill = (s) => {
  const c = STATCOL[s] || "#666";
  return `<span class="pill" style="background:${c}1a;color:${c};border:1px solid ${c}55">${esc(s)}</span>`;
};
const badge = (st) => {
  const c = st === "flag" ? "#b3402e" : st === "pass" ? "#2f7a55" : "#b5841e";
  return `<span class="pill" style="background:${c}1a;color:${c};border:1px solid ${c}55">${esc(st)}</span>`;
};
const dt = (iso) => {
  const d = new Date(iso);
  return isNaN(d)
    ? esc(iso)
    : d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};

function appBlock(a) {
  const fields = [
    ["Institution", a.institution],
    ["State", a.state],
    ["Type", a.type],
    ["Category", a.category],
    ["Email", a.email],
    ["Intake", a.intake],
    ["Faculty", a.faculty],
    ["Built-up area (sq m)", a.built],
    ["Fire certificate valid until", a.fireTo],
    ["Created", dt(a.createdAt)],
  ].filter((x) => x[1] !== "" && x[1] != null);

  const docs = (a.documents || [])
    .map(
      (d) =>
        `<tr><td>${esc(d.name)}</td><td>${esc(d.kind || "—")}</td><td class="num">${d.words || 0}</td><td>${esc(d.issued || "—")}</td><td><code>${esc(String(d.hash || "").slice(0, 16))}</code></td></tr>`,
    )
    .join("");

  const checks = (a.checks || [])
    .map(
      (c) =>
        `<div class="check"><div class="chkh"><b>Stage ${c.stage}</b> — ${esc(c.title)} ${badge(c.status)}${c.rule ? ` <code>${esc(c.rule)}</code>` : ""}</div>` +
        (c.findings || [])
          .map(
            (f) =>
              `<div class="finding"><div>${badge(f.status)} <b>${esc(f.label)}</b>${f.rule ? ` <code>${esc(f.rule)}</code>` : ""} — ${esc(f.detail || "")}</div>` +
              (f.evidence || [])
                .map(
                  (e) =>
                    `<div class="ev">↳ ${esc(e.source)}: ${esc(e.detail)}</div>`,
                )
                .join("") +
              "</div>",
          )
          .join("") +
        "</div>",
    )
    .join("");

  const hist = (a.history || [])
    .map(
      (h) =>
        `<tr><td>${dt(h.ts)}</td><td>${esc(h.actor)}</td><td>${esc(h.action)}${h.note ? " — " + esc(h.note) : ""}</td><td>${esc(h.from || "—")} → ${esc(h.to || "—")}</td></tr>`,
    )
    .join("");

  return `<details class="app"><summary><b>${esc(a.id)}</b> ${esc(a.institution)} ${pill(a.status)}<span class="meta">${esc(a.type)} · flags: <b>${a.flagCount || 0}</b> · ${dt(a.createdAt)}</span></summary>
<div class="body">
<div class="cols"><div><h4>Fields</h4><table>${fields.map((f) => `<tr><th>${f[0]}</th><td>${esc(f[1])}</td></tr>`).join("")}</table></div>
<div><h4>Quick links</h4><p class="links"><a href="/api/applications/${esc(a.id)}">JSON</a> · <a href="/api/applications/${esc(a.id)}/evidence">Evidence</a> · <a href="/api/applications/${esc(a.id)}/report?format=json">Report (JSON)</a> · <a href="/api/applications/${esc(a.id)}/report?format=html">Report (HTML)</a></p>
<h4>Documents (${(a.documents || []).length})</h4>${docs ? `<table><thead><tr><th>Name</th><th>Kind</th><th class="num">Words</th><th>Issued</th><th>Hash</th></tr></thead><tbody>${docs}</tbody></table>` : '<p class="none">No documents.</p>'}</div></div>
<h4>Checks (${(a.checks || []).length})</h4>${checks || '<p class="none">Not processed yet — POST /api/applications/' + esc(a.id) + "/process</p>"}
<h4>History (${(a.history || []).length})</h4>${hist ? `<table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Transition</th></tr></thead><tbody>${hist}</tbody></table>` : '<p class="none">No history.</p>'}
</div></details>`;
}

function renderAdmin(db, dataFile) {
  const apps = Object.values(db.apps).sort((x, y) =>
    String(y.createdAt).localeCompare(String(x.createdAt)),
  );
  const auditRows = db.audit
    .map(
      (e) =>
        `<tr><td>${dt(e.ts)}</td><td>${esc(e.actor)}</td><td><code>${esc(e.action)}</code></td><td>${esc(e.id || "")}</td><td>${esc(e.detail || "")}</td></tr>`,
    )
    .join("");
  const flagTotal = apps.reduce((n, a) => n + (a.flagCount || 0), 0);

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VYRAX backend — data browser</title>
<style>
body{margin:0;background:#f7f2e2;color:#1d2b22;font:15px/1.5 'Segoe UI',system-ui,sans-serif}
header{background:linear-gradient(120deg,#143726,#2f7a55);color:#f7f2e2;padding:22px 28px}
header h1{margin:0 0 4px;font-size:22px}header p{margin:0;opacity:.85;font-size:13px}
main{max-width:1080px;margin:0 auto;padding:22px 16px 60px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 20px}
.stat{background:#fcfaf0;border:1px solid #d8cfae;border-radius:10px;padding:10px 18px}
.stat b{display:block;font-size:22px}.stat span{font-size:12px;color:#6b7a6e}
h2{font-size:17px;margin:26px 0 10px;border-bottom:2px solid #d8cfae;padding-bottom:6px}
.pill{display:inline-block;padding:1px 9px;border-radius:99px;font-size:12px;font-weight:600;vertical-align:1px}
details.app{background:#fcfaf0;border:1px solid #d8cfae;border-radius:10px;margin-bottom:10px}
details.app summary{cursor:pointer;padding:12px 16px;list-style:none}
details.app summary::-webkit-details-marker{display:none}
details.app summary::before{content:'▸';color:#2f7a55;margin-right:8px}
details.app[open] summary::before{content:'▾'}
details.app .meta{float:right;color:#6b7a6e;font-size:13px}
.body{padding:4px 18px 16px;border-top:1px solid #e6ddc2}
.cols{display:grid;grid-template-columns:1fr 1.4fr;gap:22px}
@media(max-width:760px){.cols{grid-template-columns:1fr}details.app .meta{float:none;display:block}}
h4{margin:16px 0 6px;font-size:14px;color:#143726}
table{border-collapse:collapse;width:100%;font-size:13px}
th{text-align:left;color:#6b7a6e;font-weight:600;padding:3px 10px 3px 0;white-space:nowrap}
td{padding:3px 10px 3px 0;vertical-align:top}
thead th{border-bottom:1px solid #d8cfae}
.num{text-align:right}code{background:#efe9d2;border-radius:4px;padding:0 5px;font-size:12px}
.check{border:1px solid #e6ddc2;border-radius:8px;padding:8px 12px;margin-bottom:8px;background:#fffdf6}
.chkh{margin-bottom:4px}.finding{margin:6px 0 2px;font-size:13px}
.ev{color:#6b7a6e;margin-left:26px;font-size:12px}
.links a{color:#2f7a55}.none{color:#6b7a6e;font-size:13px;font-style:italic}
table.aud td{font-size:12.5px}
</style></head><body>
<header><h1>VYRAX backend — data browser</h1><p>data file: ${esc(dataFile)} · refresh the page to see the latest state</p></header>
<main>
<div class="stats"><div class="stat"><b>${apps.length}</b><span>applications</span></div><div class="stat"><b>${flagTotal}</b><span>open flags</span></div><div class="stat"><b>${apps.filter((a) => a.status === "Approved").length}</b><span>approved</span></div><div class="stat"><b>${db.audit.length}</b><span>audit entries</span></div><div class="stat"><b>AP-${String(db.seq || 0).padStart(4, "0")}</b><span>last id issued</span></div></div>
<h2>Applications</h2>
${apps.length ? apps.map(appBlock).join("") : '<p class="none">No applications yet.</p>'}
<h2>Audit trail (${db.audit.length})</h2>
${db.audit.length ? `<table class="aud"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>App</th><th>Detail</th></tr></thead><tbody>${auditRows}</tbody></table>` : '<p class="none">No audit entries.</p>'}
</main></body></html>`;
}

module.exports = { renderAdmin };
