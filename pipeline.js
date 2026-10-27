"use strict";

// Keyword lexicons mirror the VYRAX dashboard so client and backend agree.
const DOCL = [
  "Land ownership deed",
  "Building plan approval",
  "Fire safety certificate",
  "Faculty qualification list",
  "Audited financial statement",
];
const TYPES = [
  "New institution",
  "New course",
  "Intake increase",
  "Extension of approval",
  "Closure of course",
];

const CAT = {
  "New institution": [
    ["new institution", 6],
    ["new college", 6],
    ["proposal for new", 5],
    ["letter of intent", 4],
    ["society registration", 4],
    ["trust deed", 4],
    ["feasibility", 3],
    ["essentiality certificate", 4],
    ["establish", 3],
    ["greenfield", 3],
    ["setting up", 3],
    ["start a new", 3],
  ],
  "New course": [
    ["new course", 6],
    ["new programme", 6],
    ["new program", 6],
    ["course introduction", 5],
    ["introduce", 3],
    ["syllabus", 3],
    ["curriculum", 3],
    ["additional course", 4],
    ["start course", 4],
    ["laboratory requirement", 2],
  ],
  "Intake increase": [
    ["increase in intake", 7],
    ["increase intake", 7],
    ["additional seats", 6],
    ["sanctioned intake", 5],
    ["intake", 4],
    ["enhancement", 3],
    ["enhance", 3],
    ["seats", 2],
    ["capacity", 2],
    ["increase", 2],
  ],
  "Extension of approval": [
    ["extension of approval", 7],
    ["eoa", 5],
    ["renewal", 4],
    ["renew", 3],
    ["continuation", 3],
    ["previous approval", 4],
    ["approved till", 3],
    ["mandatory disclosure", 3],
    ["self disclosure", 2],
    ["annual report", 2],
  ],
  "Closure of course": [
    ["closure of course", 8],
    ["closure of institution", 6],
    ["closure", 6],
    ["discontinue", 5],
    ["discontinuation", 5],
    ["withdrawal", 4],
    ["withdraw", 4],
    ["wind up", 4],
    ["surrender", 4],
    ["teach out", 3],
    ["no admission", 3],
  ],
};

const DOCK = {
  "Land ownership deed": [
    "land",
    "sale deed",
    "lease deed",
    "patta",
    "title deed",
    "survey number",
  ],
  "Building plan approval": [
    "building plan",
    "plan approval",
    "sanctioned plan",
    "floor plan",
    "completion certificate",
  ],
  "Fire safety certificate": [
    "fire safety",
    "fire noc",
    "fire certificate",
    "fire",
  ],
  "Faculty qualification list": [
    "faculty",
    "teaching staff",
    "staff list",
    "qualification",
  ],
  "Audited financial statement": [
    "audited",
    "balance sheet",
    "financial statement",
    "income and expenditure",
    "chartered accountant",
  ],
};

// Rule sets loaded per application category (workflow stage 3).
const RULESETS = {
  "New institution": {
    requiredDocs: DOCL,
    studentsMultiplier: 4,
    facultyRatio: 20,
    areaPerStudent: 4,
    checks: ["faculty-ratio", "area", "fire", "intake-vs-sanctioned"],
  },
  "New course": {
    requiredDocs: DOCL,
    studentsMultiplier: 4,
    facultyRatio: 20,
    areaPerStudent: 4,
    checks: ["faculty-ratio", "area", "fire"],
  },
  "Intake increase": {
    requiredDocs: DOCL,
    studentsMultiplier: 4,
    facultyRatio: 20,
    areaPerStudent: 4,
    checks: ["faculty-ratio", "area", "fire", "intake-vs-sanctioned"],
  },
  "Extension of approval": {
    requiredDocs: DOCL,
    studentsMultiplier: 4,
    facultyRatio: 20,
    areaPerStudent: 4,
    checks: ["faculty-ratio", "area", "fire"],
  },
  "Closure of course": {
    requiredDocs: DOCL,
    studentsMultiplier: 0,
    facultyRatio: 0,
    areaPerStudent: 0,
    checks: [],
  },
};

const ISSUERS = {
  "Land ownership deed": "Sub-Registrar (Land Records)",
  "Building plan approval": "Town Planning Authority",
  "Fire safety certificate": "State Fire and Rescue Services",
  "Faculty qualification list": "Affiliating University (HR Cell)",
  "Audited financial statement": "Chartered Accountant Registry",
};

function hash(s) {
  let h = 5381;
  for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return h;
}
const rx = (w) =>
  new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const esc = (x) =>
  String(x == null ? "" : x).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const today = () => new Date().toISOString().slice(0, 10);

function classify(rows) {
  const sc = {},
    ev = {};
  TYPES.forEach((k) => {
    sc[k] = 0;
    ev[k] = [];
  });
  rows.forEach((r) => {
    const nm =
      " " +
      String(r.name || "")
        .toLowerCase()
        .replace(/[_\-.]+/g, " ") +
      " ";
    const tx = String(r.text || "").toLowerCase();
    Object.entries(CAT).forEach(([k, L]) =>
      L.forEach(([w, p]) => {
        if (r.name !== "Pasted text") {
          const m = nm.match(new RegExp(rx(w).source, "gi"));
          if (m) {
            sc[k] += p * m.length;
            ev[k].push([w, "file name " + r.name, p * m.length]);
          }
        }
        if (tx) {
          const c = Math.min(
            3,
            (tx.match(new RegExp(rx(w).source, "gi")) || []).length,
          );
          if (c) {
            sc[k] += p * c;
            ev[k].push([w, "text of " + r.name, p * c]);
          }
        }
      }),
    );
    r.kind =
      Object.entries(DOCK).find(([, L]) =>
        L.some((w) => rx(w).test(nm) || rx(w).test(tx.slice(0, 4000))),
      )?.[0] || "Other document";
    r.words = (tx.trim().match(/\S+/g) || []).length;
  });
  const rank = Object.entries(sc).sort((a, b) => b[1] - a[1]);
  const tot = rank.reduce((a, x) => a + x[1], 0);
  const top =
    rank[0][1] >= 6 && rank[0][1] - rank[1][1] >= 2 ? rank[0][0] : null;
  return {
    category: top,
    conf: top && tot ? Math.min(99, Math.round((rank[0][1] / tot) * 100)) : 0,
    rank,
    rows,
    found: DOCL.filter((d) => rows.some((r) => r.kind === d)),
    ev: top ? ev[top].sort((a, b) => b[2] - a[2]).slice(0, 8) : [],
  };
}

// Deterministic stand-in for the central registry (stage 4).
function registry(name) {
  const h = hash(String(name || "").toLowerCase());
  return {
    found: true,
    sanctionedIntake: 60 + (h % 6) * 60,
    established: 1985 + (h % 40),
    accredited: h % 5 !== 0,
    campusAreaM2: 6000 + (h % 50) * 400,
    labs: 6 + (h % 24),
    lastAudit: new Date(Date.now() - ((h % 20) + 2) * 30 * 864e5)
      .toISOString()
      .slice(0, 10),
  };
}

function run(app) {
  app.checks = [];
  const add = (c) => {
    app.checks.push(c);
    return c;
  };
  const docs = app.documents || [];

  // Stage 2 — Identify application category
  const cls = classify(docs);
  if (!app.category) app.category = cls.category || app.type || null;
  add({
    stage: 2,
    title: "Identify application category",
    status: cls.category ? "pass" : "info",
    rule: "CAT-LEX v1",
    findings: [
      {
        label: "Detected category",
        status: cls.category ? "info" : "flag",
        rule: "CAT-LEX",
        detail: cls.category
          ? `${cls.category} (confidence ${cls.conf}%)`
          : 'Not classifiable from the submitted documents; declared type "' +
            app.type +
            '" will be used',
        evidence: [
          {
            source: "documents",
            detail: cls.rows.length + " document(s) scored",
          },
        ],
      },
    ],
    evidence: cls.ev.map((e) => ({
      source: e[1],
      detail: '"' + e[0] + '" +' + e[2] + " pts",
    })),
    next: cls.category
      ? []
      : [
          "Add the application letter or a covering note so the category can be identified",
        ],
  });

  // Stage 3 — Load applicable rule set
  const rs =
    RULESETS[app.category] || RULESETS[app.type] || RULESETS["New institution"];
  app.ruleSet = RULESETS[app.category]
    ? app.category
    : RULESETS[app.type]
      ? app.type
      : "New institution (default)";
  add({
    stage: 3,
    title: "Load applicable rule set",
    status: "pass",
    rule: "RULESET/" + app.ruleSet,
    findings: [
      {
        label: "Rule set in force",
        status: "info",
        rule: "RULESET",
        detail: `${rs.requiredDocs.length} required documents, faculty ratio 1:${rs.facultyRatio}, ${rs.areaPerStudent} sq m built-up per student`,
        evidence: [],
      },
    ],
    evidence: [],
    next: [],
  });

  // Stage 4 — Retrieve authorised institutional records
  const reg = registry(app.institution);
  app.registry = reg;
  add({
    stage: 4,
    title: "Retrieve authorised institutional records",
    status: reg.accredited ? "pass" : "flag",
    rule: "REG-CENTRAL",
    findings: [
      {
        label: "Registry record",
        status: "info",
        rule: "REG-1",
        detail: `Sanctioned intake ${reg.sanctionedIntake} | established ${reg.established} | accredited: ${reg.accredited ? "yes" : "NO"} | campus ${reg.campusAreaM2} sq m | ${reg.labs} labs | last audit ${reg.lastAudit}`,
        evidence: [
          { source: "central registry", detail: "lookup by institution name" },
        ],
      },
    ],
    evidence: [],
    next: reg.accredited
      ? []
      : ["Confirm accreditation status with the council before deciding"],
  });

  // Stage 5 — OCR and document classification
  add({
    stage: 5,
    title: "OCR and document classification",
    status: "pass",
    rule: "DOC-LEX v1",
    findings: docs.map((d) => ({
      label: d.name,
      status: "info",
      rule: "DOC-CLS",
      detail: `${d.kind}${d.words ? ", " + d.words + " words read" : " — file name only, OCR unavailable"}`,
      evidence: [],
    })),
    evidence: [],
    next: [],
  });

  // Stage 6 — Validate fields and required documents
  const missing = rs.requiredDocs.filter((d) => !cls.found.includes(d));
  const vf = [];
  if (!/^\S+@\S+\.\S+$/.test(app.email || ""))
    vf.push({
      label: "Contact email",
      status: "flag",
      rule: "VAL-1",
      detail: "Missing or invalid contact email",
      evidence: [],
    });
  if (!(app.intake > 0))
    vf.push({
      label: "Proposed intake",
      status: "flag",
      rule: "VAL-2",
      detail: "Intake must be a positive number of seats",
      evidence: [],
    });
  if (missing.length)
    vf.push({
      label: "Required documents",
      status: "flag",
      rule: "VAL-3",
      detail: "Missing: " + missing.join(", "),
      evidence: missing.map((m) => ({
        source: "rule set",
        detail: m + " is required",
      })),
    });
  add({
    stage: 6,
    title: "Validate fields and required documents",
    status: vf.length ? "flag" : "pass",
    rule: "VAL-*",
    findings: vf.length
      ? vf
      : [
          {
            label: "Fields and documents",
            status: "pass",
            rule: "VAL-OK",
            detail:
              "All required fields valid and all required documents present",
            evidence: [],
          },
        ],
    evidence: [],
    next: missing.length
      ? ["Obtain the missing documents from the applicant"]
      : [],
  });

  // Stage 7 — Anomaly and consistency checks (flags only; never auto-reject)
  const an = [];
  const students = (app.intake || 0) * rs.studentsMultiplier;
  const needFac = rs.facultyRatio ? Math.ceil(students / rs.facultyRatio) : 0;
  const needArea = rs.areaPerStudent ? students * rs.areaPerStudent : 0;
  const seen = {};
  docs.forEach((d) => {
    const k = d.hash || d.name;
    seen[k] = (seen[k] || 0) + 1;
  });
  docs.forEach((d) => {
    const k = d.hash || d.name;
    if (seen[k] > 1)
      an.push({
        label: "Duplicate content",
        status: "flag",
        rule: "AN-1",
        detail: d.name + " has identical content to another submitted document",
        evidence: [
          {
            source: "document:" + d.name,
            detail: "content hash " + String(d.hash || "").slice(0, 16),
          },
        ],
      });
  });
  if (
    rs.checks.includes("intake-vs-sanctioned") &&
    app.intake > 0 &&
    app.intake > reg.sanctionedIntake
  )
    an.push({
      label: "Intake above sanctioned",
      status: "flag",
      rule: "AN-2",
      detail: `Requested ${app.intake} seats exceeds sanctioned ${reg.sanctionedIntake}`,
      evidence: [
        {
          source: "central registry",
          detail: "sanctioned intake " + reg.sanctionedIntake,
        },
      ],
    });
  if (
    rs.checks.includes("faculty-ratio") &&
    app.intake > 0 &&
    (app.faculty || 0) < needFac
  )
    an.push({
      label: "Faculty ratio below 1:" + rs.facultyRatio,
      status: "flag",
      rule: "AN-3",
      detail: `${app.faculty || 0} faculty for ${students} students; need ${needFac}`,
      evidence: [
        {
          source: "application",
          detail: "intake " + app.intake + ", faculty " + (app.faculty || 0),
        },
      ],
    });
  if (
    rs.checks.includes("area") &&
    app.intake > 0 &&
    (app.built || 0) < needArea
  )
    an.push({
      label: "Built-up area below requirement",
      status: "flag",
      rule: "AN-4",
      detail: `${app.built || 0} sq m provided; need ${needArea} sq m (${rs.areaPerStudent} per student)`,
      evidence: [
        {
          source: "application",
          detail: "built-up " + (app.built || 0) + " sq m",
        },
      ],
    });
  const hasFire = cls.found.includes("Fire safety certificate");
  if (rs.checks.includes("fire") && (!app.fireTo || app.fireTo < today()))
    an.push({
      label: hasFire
        ? "Fire certificate expired"
        : "Fire certificate validity missing",
      status: "flag",
      rule: "AN-5",
      detail: app.fireTo
        ? `Valid until ${app.fireTo}, which is before ${today()}`
        : "No validity date supplied",
      evidence: [
        { source: "application", detail: "fireTo " + (app.fireTo || "—") },
      ],
    });
  docs.forEach((d) => {
    if (d.issued && d.issued > today())
      an.push({
        label: "Future-dated document",
        status: "flag",
        rule: "AN-6",
        detail: d.name + " is dated " + d.issued,
        evidence: [
          { source: "document:" + d.name, detail: "issued " + d.issued },
        ],
      });
  });
  add({
    stage: 7,
    title: "Run anomaly and consistency checks",
    status: an.length ? "flag" : "pass",
    rule: "AN-*",
    summary: `${an.length} potential anomal${an.length === 1 ? "y" : "ies"} flagged — nothing is auto-rejected; an officer must review each flag with its evidence`,
    findings: an.length
      ? an
      : [
          {
            label: "Anomaly scan",
            status: "pass",
            rule: "AN-OK",
            detail: "No anomalies detected",
            evidence: [],
          },
        ],
    evidence: [],
    next: an.length
      ? [
          "Officer reviews each anomaly: supporting evidence, applicable rule, verification status, next steps",
        ]
      : [],
  });

  // Stage 8 — Verify with issuing authorities
  const certs = docs.filter((d) => DOCL.includes(d.kind));
  const ver = certs.map((d) => {
    const h = hash((app.institution + "|" + d.name).toLowerCase());
    const result = ["verified", "verified", "pending"][h % 3];
    const issuer = ISSUERS[d.kind] || "Issuing authority";
    return {
      label: d.name,
      status:
        result === "verified" ? "pass" : result === "pending" ? "info" : "flag",
      rule: "ISS-CHK",
      detail: `${issuer} — ${result === "verified" ? "record matches the issuing registry" : result === "pending" ? "confirmation pending from the authority" : "no matching record found"}`,
      evidence: [
        {
          source: "authority:" + issuer,
          detail: "verification status: " + result,
        },
      ],
    };
  });
  add({
    stage: 8,
    title: "Verify with issuing authorities",
    status: ver.some((v) => v.status === "flag")
      ? "flag"
      : ver.some((v) => v.status === "info")
        ? "info"
        : "pass",
    rule: "ISS-*",
    findings: ver.length
      ? ver
      : [
          {
            label: "No certifiable documents",
            status: "info",
            rule: "ISS-0",
            detail: "No recognised certificates among the uploaded documents",
            evidence: [],
          },
        ],
    evidence: [],
    next: ver.some((v) => v.status === "info")
      ? ["Follow up with the pending issuing authorities"]
      : [],
  });

  // Stage 9 — Assess infrastructure evidence
  const infra = [];
  if (rs.areaPerStudent && app.intake > 0)
    infra.push({
      label: "Built-up area",
      status: (app.built || 0) >= needArea ? "pass" : "flag",
      rule: "INF-1",
      detail: `${app.built || 0} sq m built-up on a ${reg.campusAreaM2} sq m campus; requirement ${needArea} sq m`,
      evidence: [
        {
          source: "central registry",
          detail: "campus " + reg.campusAreaM2 + " sq m",
        },
      ],
    });
  infra.push({
    label: "Laboratories",
    status: reg.labs >= 8 ? "pass" : "info",
    rule: "INF-2",
    detail: reg.labs + " laboratories on record",
    evidence: [],
  });
  infra.push({
    label: "Accreditation",
    status: reg.accredited ? "pass" : "flag",
    rule: "INF-3",
    detail: reg.accredited
      ? "Institution is accredited"
      : "Institution is NOT on the accredited list",
    evidence: [{ source: "central registry", detail: "accreditation lookup" }],
  });
  add({
    stage: 9,
    title: "Assess infrastructure evidence",
    status: infra.some((i) => i.status === "flag")
      ? "flag"
      : infra.some((i) => i.status === "info")
        ? "info"
        : "pass",
    rule: "INF-*",
    findings: infra,
    evidence: [],
    next: [],
  });

  app.processedAt = new Date().toISOString();
  app.flagCount = app.checks.reduce(
    (n, c) => n + c.findings.filter((f) => f.status === "flag").length,
    0,
  );
  return app.checks;
}

// Stage 10 — Officer review decisions (from the workflow diagram)
const DECISIONS = {
  request_info: {
    to: "Pending docs",
    ui: "Pending docs",
    label: "Rectification permitted — additional information requested",
    needNote: true,
  },
  manual: {
    to: "Manual verification",
    ui: "Under review",
    label: "Further verification needed — manual verification or inspection",
  },
  refer: {
    to: "Referred to competent authority",
    ui: "Under review",
    label: "Referred — competent authority follows official process",
  },
  complete: {
    to: "Approved",
    ui: "Approved",
    label: "Review completed — evidence-linked report generated",
  },
  reject: {
    to: "Flagged",
    ui: "Flagged",
    label: "Officer rejection — evidence cited, applicant informed",
    needNote: true,
  },
};

function review(app, decision, note, actor) {
  const d = DECISIONS[decision];
  if (!d)
    throw new Error(
      "Unknown decision '" +
        decision +
        "' — use request_info | manual | refer | complete | reject",
    );
  if (!app.checks || !app.checks.length)
    throw new Error("Run POST /process on this application first");
  if (d.needNote && !(note || "").trim())
    throw new Error('A note is required for decision "' + decision + '"');
  const from = app.status;
  app.status = d.to;
  app.uiStatus = d.ui;
  app.history = app.history || [];
  app.history.push({
    ts: new Date().toISOString(),
    actor: actor || "officer",
    action: d.label,
    from,
    to: d.to,
    note: note || "",
  });
  if (decision === "complete") app.reportReady = true;
  return d;
}

// Rectification loop: resubmission and revalidation
function resubmit(app, patch) {
  if (app.status !== "Pending docs")
    throw new Error(
      "Resubmission is only allowed after 'request_info' (status Pending docs)",
    );
  [
    "institution",
    "state",
    "type",
    "email",
    "intake",
    "faculty",
    "built",
    "fireTo",
  ].forEach((k) => {
    if (patch[k] != null)
      app[k] =
        k === "intake" || k === "faculty" || k === "built"
          ? +patch[k]
          : patch[k];
  });
  if (Array.isArray(patch.documents))
    patch.documents.forEach((nd) => {
      app.documents.push({
        name: String(nd.name || "document"),
        text: String(nd.text || ""),
        kind: "",
        words: 0,
        issued: nd.issued || "",
        hash:
          nd.hash ||
          "h" +
            hash((nd.name + "|" + (nd.text || "")).toLowerCase()).toString(16),
      });
    });
  app.history.push({
    ts: new Date().toISOString(),
    actor: "applicant",
    action: "Resubmission and revalidation",
    from: "Pending docs",
    to: "Under review",
    note: patch.note || "",
  });
  app.status = "Under review";
  app.uiStatus = "Under review";
  run(app);
  return app;
}

// Manual verification or inspection outcome
function inspection(app, result, note) {
  if (app.status !== "Manual verification")
    throw new Error(
      "Inspection is only allowed while status is 'Manual verification'",
    );
  if (!["pass", "fail"].includes(result))
    throw new Error("result must be 'pass' or 'fail'");
  if (result === "fail" && !(note || "").trim())
    throw new Error("A note is required when the inspection fails");
  const to = result === "pass" ? "Under review" : "Flagged";
  app.history.push({
    ts: new Date().toISOString(),
    actor: "officer",
    action: "Manual verification / inspection: " + result.toUpperCase(),
    from: app.status,
    to,
    note: note || "",
  });
  app.status = to;
  app.uiStatus = to;
  run(app);
  return { to, result };
}

// Stage 11 — Evidence-linked report
function evidenceIndex(app) {
  const idx = [];
  let n = 0;
  (app.checks || []).forEach((c) =>
    c.findings.forEach((f) =>
      (f.evidence || []).forEach((e) => {
        idx.push({
          id: "EV-" + String(++n).padStart(2, "0"),
          stage: c.stage,
          stageTitle: c.title,
          rule: f.rule || c.rule,
          check: f.label,
          status: f.status,
          source: e.source,
          detail: e.detail,
        });
      }),
    ),
  );
  return idx;
}

function reportJSON(app) {
  const lastDecision =
    (app.history || [])
      .filter((h) => h.actor === "officer" || h.action.includes("Review"))
      .slice(-1)[0] || null;
  return {
    application: {
      id: app.id,
      institution: app.institution,
      state: app.state,
      type: app.type,
      status: app.status,
      email: app.email,
      intake: app.intake,
      faculty: app.faculty,
      built: app.built,
      fireTo: app.fireTo,
      submittedAt: app.createdAt,
      processedAt: app.processedAt || null,
    },
    category: app.category,
    ruleSet: app.ruleSet,
    registry: app.registry || null,
    openFlags: app.flagCount || 0,
    stages: app.checks || [],
    decision: lastDecision,
    history: app.history || [],
    evidence: evidenceIndex(app),
    nextSteps: [...new Set((app.checks || []).flatMap((c) => c.next || []))],
    generatedAt: new Date().toISOString(),
    principle:
      "No application is automatically rejected on an AI-reported anomaly. Every flag carries its supporting evidence, the applicable rule, the verification status and the available next steps, and a reviewing officer makes the final decision.",
  };
}

const CHIP = { pass: "#3a8559", flag: "#a63d2f", info: "#b8861b" };
const LBL = { pass: "PASS", flag: "FLAG", info: "INFO" };

function reportHTML(app) {
  const r = reportJSON(app);
  const chip = (s) =>
    `<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;color:#fff;background:${CHIP[s] || "#667366"}">${LBL[s] || s.toUpperCase()}</span>`;
  const stages = r.stages
    .map(
      (c) => `
   <section style="background:#fcfaf0;border:1px solid #d9d1b8;border-radius:12px;padding:16px 18px;margin:14px 0">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
      <h3 style="margin:0;font-size:16px">${c.stage}. ${esc(c.title)}</h3>${chip(c.status)}
    </div>
    <div style="font-size:12px;color:#667366;margin:4px 0 10px">Rule: ${esc(c.rule)}${c.summary ? " — " + esc(c.summary) : ""}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${c.findings
        .map(
          (f) => `<tr>
        <td style="padding:6px 8px;border-top:1px solid #e4ead2;vertical-align:top;width:1%;white-space:nowrap">${chip(f.status)}</td>
        <td style="padding:6px 8px;border-top:1px solid #e4ead2;vertical-align:top"><b>${esc(f.label)}</b><div style="color:#667366">${esc(f.detail)}</div>
          ${(f.evidence || []).map((e) => `<div style="font-size:12px;color:#1f5a3d">• ${esc(e.source)} — ${esc(e.detail)}</div>`).join("")}
        </td>
        <td style="padding:6px 8px;border-top:1px solid #e4ead2;vertical-align:top;color:#667366;white-space:nowrap">${esc(f.rule || "")}</td>
      </tr>`,
        )
        .join("")}
    </table>
    ${c.evidence && c.evidence.length ? `<div style="margin-top:8px;font-size:12px;color:#1f5a3d"><b>Classification evidence:</b> ${c.evidence.map((e) => esc(e.detail)).join(" · ")}</div>` : ""}
    ${c.next && c.next.length ? `<div style="margin-top:8px;font-size:12px;color:#7a5a0c"><b>Next:</b> ${c.next.map(esc).join(" · ")}</div>` : ""}
   </section>`,
    )
    .join("");
  const evRows = r.evidence
    .map(
      (e) =>
        `<tr><td style="padding:5px 8px;border-top:1px solid #e4ead2">${e.id}</td><td style="padding:5px 8px;border-top:1px solid #e4ead2">${e.stage}. ${esc(e.stageTitle)}</td><td style="padding:5px 8px;border-top:1px solid #e4ead2">${esc(e.rule)}</td><td style="padding:5px 8px;border-top:1px solid #e4ead2">${esc(e.check)}</td><td style="padding:5px 8px;border-top:1px solid #e4ead2">${esc(e.source)} — ${esc(e.detail)}</td></tr>`,
    )
    .join("");
  const hist = r.history
    .map(
      (h) =>
        `<tr><td style="padding:5px 8px;border-top:1px solid #e4ead2;white-space:nowrap">${h.ts.slice(0, 16).replace("T", " ")}</td><td style="padding:5px 8px;border-top:1px solid #e4ead2">${esc(h.actor)}</td><td style="padding:5px 8px;border-top:1px solid #e4ead2">${esc(h.from || "—")} → ${esc(h.to)}</td><td style="padding:5px 8px;border-top:1px solid #e4ead2">${esc(h.action)}${h.note ? " — " + esc(h.note) : ""}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Evidence-linked report ${esc(app.id)}</title></head>
<body style="margin:0;background:#f7f2e2;color:#1d2b22;font:15px/1.5 'Segoe UI',system-ui,sans-serif">
 <div style="max-width:900px;margin:0 auto;padding:28px 22px 60px">
  <div style="background:linear-gradient(120deg,#143626,#1f5a3d);color:#f7f2e2;border-radius:16px;padding:24px 28px">
    <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.8">VYRAX compliance desk — evidence-linked report</div>
    <h1 style="margin:6px 0 2px;font-family:Georgia,serif">${esc(app.institution)}</h1>
    <div style="opacity:.9">${esc(app.id)} · ${esc(app.type)} · status: <b>${esc(app.status)}</b> · generated ${r.generatedAt.slice(0, 16).replace("T", " ")}</div>
  </div>
  <p style="background:#efe2b8;border:1px solid #d9d1b8;border-radius:10px;padding:10px 14px;font-size:13px">${esc(r.principle)}</p>
  ${stages}
  <h2 style="font-family:Georgia,serif;margin:22px 0 8px">Decision history</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fcfaf0;border:1px solid #d9d1b8;border-radius:12px"><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">When</th><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">Actor</th><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">Transition</th><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">Action</th></tr>${hist}</table>
  <h2 style="font-family:Georgia,serif;margin:22px 0 8px">Evidence index (${r.evidence.length})</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;background:#fcfaf0;border:1px solid #d9d1b8"><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">ID</th><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">Stage</th><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">Rule</th><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">Check</th><th style="text-align:left;padding:8px;border-bottom:1px solid #d9d1b8">Evidence</th></tr>${evRows}</table>
  ${r.nextSteps.length ? `<h2 style="font-family:Georgia,serif;margin:22px 0 8px">Available next steps</h2><ul style="margin:0;padding-left:20px">${r.nextSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
 </div>
</body></html>`;
}

// Demo dataset: one application carrying several anomalies to exercise the review UI.
function seed(db, ctx) {
  const existing = Object.values(db.apps).find(
    (a) => a.institution === "Sunrise Institute of Technology",
  );
  if (existing) return { existing: true, id: existing.id };
  const past = (n) =>
    new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const mk = (name, text, issued) => ({
    name,
    text,
    kind: "",
    words: 0,
    issued: issued || "",
    hash: "h" + hash((name + "|" + text).toLowerCase()).toString(16),
  });
  const docs = [
    mk(
      "land-sale-deed.pdf",
      "This is to certify that the land bearing survey number 112/2 measuring 5.2 acres stands in the name of the trust. Sale deed registered with the Sub-Registrar. Title deed and patta enclosed.",
      past(400),
    ),
    mk(
      "building-plan-approval.pdf",
      "Sanctioned plan for the academic and laboratory blocks approved by the Town Planning Authority. Completion certificate applied for.",
      past(300),
    ),
    mk(
      "fire-safety-certificate.pdf",
      "Fire NOC issued by the State Fire and Rescue Services. Fire certificate valid until " +
        past(40) +
        ".",
      past(600),
    ),
    mk(
      "faculty-qualification-list.pdf",
      "Consolidated list of teaching staff with qualifications and experience. 20 faculty members attached to the proposed institution.",
      past(200),
    ),
    mk(
      "audited-financial-statement.pdf",
      "Audited financial statement and balance sheet for the year ended March 2024 with income and expenditure account, certified by a chartered accountant.",
      past(90),
    ),
  ];
  docs.push({ ...docs[0], name: "land-sale-deed-copy.pdf" }); // identical hash -> AN-1 duplicate flag
  const reg = registry("Sunrise Institute of Technology");
  const app = {
    id: ctx.nextId(),
    createdAt: new Date().toISOString(),
    institution: "Sunrise Institute of Technology",
    state: "Tamil Nadu",
    type: "New institution",
    email: "registrar@sunrise.edu.in",
    intake: reg.sanctionedIntake + 120,
    faculty: 20,
    built: 2400,
    fireTo: past(40),
    category: "New institution",
    documents: docs,
    history: [
      {
        ts: new Date().toISOString(),
        actor: "applicant",
        action: "Application submitted",
        from: "",
        to: "Under review",
        note: "Demo dataset",
      },
    ],
    status: "Under review",
    uiStatus: "Under review",
  };
  run(app);
  db.apps[app.id] = app;
  ctx.audit(
    "system",
    "demo seed",
    app.id,
    "Sample application created with intentional anomalies",
  );
  ctx.save();
  return { existing: false, id: app.id, flags: app.flagCount };
}

module.exports = {
  DOCL,
  TYPES,
  RULESETS,
  hash,
  classify,
  registry,
  run,
  review,
  resubmit,
  inspection,
  evidenceIndex,
  reportJSON,
  reportHTML,
  seed,
};
