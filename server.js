"use strict";
const http = require("http");
const { db, nextId, audit, save } = require("./store");
const P = require("./pipeline");
const { renderAdmin } = require("./admin");
const path = require("path");
const fs = require("fs");
const os = require("os");
const DATA_FILE = path.join(__dirname, "data", "db.json");

const PORT = +(process.env.PORT || 4711);
const HOST = process.env.HOST || "0.0.0.0";

const routes = [];
function route(method, pattern, handler) {
  const re =
    pattern instanceof RegExp
      ? pattern
      : new RegExp("^" + pattern.replace(/:[^/]+/g, "([^/]+)") + "/?$");
  routes.push({ method, re, handler });
}

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((ok, no) => {
    let d = "";
    req.on("data", (c) => {
      d += c;
      if (d.length > 40e6) req.destroy();
    });
    req.on("end", () => {
      if (!d) return ok({});
      try {
        ok(JSON.parse(d));
      } catch (_) {
        no(new Error("Invalid JSON body"));
      }
    });
    req.on("error", no);
  });
}

const getApp = (id) => db.apps[id] || null;
const notFound = (res, id) =>
  send(res, 404, { error: "Application not found", id });

const DOCS = [
  ["GET", "/api/health", "service status"],
  ["GET", "/api/docs", "this list"],
  ["GET", "/api/rulesets", "rule set per application category"],
  ["GET", "/api/applications", "list applications"],
  [
    "POST",
    "/api/applications",
    "submit application — body: institution, state, type, email, intake, faculty, built, fireTo, documents:[{name,text,issued,hash}]",
  ],
  ["GET", "/api/applications/:id", "application detail"],
  [
    "POST",
    "/api/applications/:id/process",
    "run stages 2–9 (category → rules → registry → OCR/classify → validate → anomalies → issuing authorities → infrastructure)",
  ],
  [
    "GET",
    "/api/applications/:id/evidence",
    "flattened evidence index with rule + verification status per item",
  ],
  [
    "POST",
    "/api/applications/:id/review",
    "officer decision — body: decision=request_info|manual|refer|complete|reject, note, actor",
  ],
  [
    "POST",
    "/api/applications/:id/resubmit",
    "applicant rectification — body: any of institution/state/type/email/intake/faculty/built/fireTo, documents, note",
  ],
  [
    "POST",
    "/api/applications/:id/inspection",
    "manual verification result — body: result=pass|fail, note",
  ],
  [
    "GET",
    "/api/applications/:id/report",
    "evidence-linked report ( ?format=json|html )",
  ],
  ["GET", "/api/audit", "audit trail (?limit=50)"],
  ["POST", "/api/demo/seed", "create the sample application (idempotent)"],
];

route("GET", "/api/health", (req, res) =>
  send(res, 200, {
    ok: true,
    service: "vyrax-backend",
    time: new Date().toISOString(),
    applications: Object.keys(db.apps).length,
  }),
);
route("GET", "/api/docs", (req, res) =>
  send(res, 200, {
    service: "VYRAX compliance backend",
    endpoints: DOCS.map((d) => ({ method: d[0], path: d[1], about: d[2] })),
  }),
);
route("GET", "/api/rulesets", (req, res) =>
  send(res, 200, {
    rulesets: P.RULESETS,
    documentList: P.DOCL,
    applicationTypes: P.TYPES,
  }),
);

route("GET", "/api/applications", (req, res) =>
  send(res, 200, {
    applications: Object.values(db.apps).map((a) => ({
      id: a.id,
      institution: a.institution,
      state: a.state,
      type: a.type,
      status: a.status,
      uiStatus: a.uiStatus,
      category: a.category,
      flags: a.flagCount || 0,
      createdAt: a.createdAt,
    })),
  }),
);

route("POST", "/api/applications", async (req, res) => {
  const b = await readBody(req);
  if (!b.institution || !String(b.institution).trim())
    return send(res, 400, { error: "institution is required" });
  if (!P.TYPES.includes(b.type))
    return send(res, 400, {
      error: "type must be one of: " + P.TYPES.join(", "),
    });
  const app = {
    id: nextId(),
    createdAt: new Date().toISOString(),
    institution: String(b.institution).trim(),
    state: b.state || "",
    type: b.type,
    email: b.email || "",
    intake: +b.intake || 0,
    faculty: +b.faculty || 0,
    built: +b.built || 0,
    fireTo: b.fireTo || "",
    category: b.category || "",
    documents: (Array.isArray(b.documents) ? b.documents : []).map((d) => ({
      name: String(d.name || "document"),
      text: String(d.text || ""),
      kind: "",
      words: 0,
      issued: d.issued || "",
      hash:
        d.hash ||
        "h" +
          P.hash((d.name + "|" + (d.text || "")).toLowerCase()).toString(16),
    })),
    history: [
      {
        ts: new Date().toISOString(),
        actor: "applicant",
        action: "Application submitted",
        from: "",
        to: "Under review",
        note: "",
      },
    ],
    status: "Under review",
    uiStatus: "Under review",
  };
  db.apps[app.id] = app;
  audit("applicant", "submit", app.id, app.institution + " — " + app.type);
  save();
  send(res, 201, { application: app });
});

route("GET", "/api/applications/:id", (req, res, id) => {
  const a = getApp(id);
  if (!a) return notFound(res, id);
  send(res, 200, { application: a });
});

route("POST", "/api/applications/:id/process", (req, res, id) => {
  const a = getApp(id);
  if (!a) return notFound(res, id);
  P.run(a);
  audit("system", "process", id, `stages 2–9 complete, ${a.flagCount} flag(s)`);
  save();
  send(res, 200, {
    id,
    status: a.status,
    uiStatus: a.uiStatus,
    flagCount: a.flagCount,
    checks: a.checks,
  });
});

route("GET", "/api/applications/:id/evidence", (req, res, id) => {
  const a = getApp(id);
  if (!a) return notFound(res, id);
  send(res, 200, { id, status: a.status, evidence: P.evidenceIndex(a) });
});

route("POST", "/api/applications/:id/review", async (req, res, id) => {
  const a = getApp(id);
  if (!a) return notFound(res, id);
  const b = await readBody(req);
  try {
    const d = P.review(a, b.decision, b.note, b.actor);
    audit(
      b.actor || "officer",
      "review:" + b.decision,
      id,
      d.label + (b.note ? " — " + b.note : ""),
    );
    save();
    send(res, 200, {
      id,
      decision: b.decision,
      status: a.status,
      uiStatus: a.uiStatus,
      reportReady: !!a.reportReady,
      history: a.history.slice(-1)[0],
    });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

route("POST", "/api/applications/:id/resubmit", async (req, res, id) => {
  const a = getApp(id);
  if (!a) return notFound(res, id);
  const b = await readBody(req);
  try {
    P.resubmit(a, b);
    audit("applicant", "resubmit", id, "rectified and revalidated");
    save();
    send(res, 200, {
      id,
      status: a.status,
      flagCount: a.flagCount,
      checks: a.checks,
    });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

route("POST", "/api/applications/:id/inspection", async (req, res, id) => {
  const a = getApp(id);
  if (!a) return notFound(res, id);
  const b = await readBody(req);
  try {
    const r = P.inspection(a, b.result, b.note);
    audit("officer", "inspection:" + b.result, id, b.note || "");
    save();
    send(res, 200, {
      id,
      result: r.result,
      status: a.status,
      flagCount: a.flagCount,
    });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

route("GET", "/api/applications/:id/report", (req, res, id) => {
  const a = getApp(id);
  if (!a) return notFound(res, id);
  if (!(a.checks || []).length)
    return send(res, 400, { error: "Run POST /process first" });
  if ((req.query.format || "json") === "html")
    send(res, 200, P.reportHTML(a), "text/html; charset=utf-8");
  else send(res, 200, P.reportJSON(a));
});

route("GET", "/api/audit", (req, res) => {
  const limit = Math.min(+(req.query.limit || 50), 500);
  send(res, 200, { audit: db.audit.slice(0, limit) });
});

route("POST", "/api/demo/seed", (req, res) => {
  try {
    send(res, 200, P.seed(db, { nextId, audit, save }));
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

route("GET", "/admin", (req, res) =>
  send(res, 200, renderAdmin(db, DATA_FILE), "text/html; charset=utf-8"),
);

// Serve the dashboard so every device can use one common link: http://<host-ip>:4711/
const DASHBOARD = path.join(__dirname, "..", "VYRAX Compliance Dashboard.html");
const dashboardPage = (req, res) => {
  try {
    send(res, 200, fs.readFileSync(DASHBOARD, "utf8"), "text/html; charset=utf-8");
  } catch (_) {
    send(res, 404, {
      error: "Dashboard file not found — it must sit next to the vyrax-backend folder",
      expected: DASHBOARD,
    });
  }
};
route("GET", "/app", dashboardPage);
route("GET", "/", dashboardPage);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  req.query = Object.fromEntries(u.searchParams);
  if (req.method === "OPTIONS") return send(res, 204, "");
  for (const r of routes) {
    const m = r.method === req.method && u.pathname.match(r.re);
    if (m) {
      try {
        return await r.handler(req, res, ...m.slice(1));
      } catch (e) {
        return send(res, 500, { error: e.message });
      }
    }
  }
  send(res, 404, { error: "Not found", path: u.pathname, docs: "/api/docs" });
});

server.listen(PORT, HOST, () => {
  console.log(`VYRAX backend listening on http://${HOST}:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const n of list || [])
      if (n.family === "IPv4" && !n.internal)
        console.log(`  share VYRAX:  http://${n.address}:${PORT}`);
  console.log("Docs:  GET /api/docs");
  console.log(
    "Demo:  curl -X POST http://127.0.0.1:" + PORT + "/api/demo/seed",
  );
});
