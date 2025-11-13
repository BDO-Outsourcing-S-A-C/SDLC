#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer";
import dayjs from "dayjs";
import MarkdownIt from "markdown-it";

const token = process.env.GITHUB_TOKEN;
const repoFullName = process.env.REPO_FULL_NAME; // "owner/repo"
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    prNumber: null,
    excludeDiff: false,
    summaryOnly: false,
    excludeReviewComments: false,
    forceLargeDiffs: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === "--pr" || a === "--pr-number") && args[i + 1]) {
      opts.prNumber = Number(args[++i]);
    } else if (a === "--exclude-diff") {
      opts.excludeDiff = true;
    } else if (a === "--summary-only") {
      opts.summaryOnly = true;
    } else if (a === "--exclude-review-comments") {
      opts.excludeReviewComments = true;
    } else if (a === "--force-large-diffs") {
      opts.forceLargeDiffs = true;
    }
  }
  if (!opts.prNumber || Number.isNaN(opts.prNumber)) {
    console.error("Debe proporcionar --pr <numero>");
    process.exit(1);
  }
  if (!token) {
    console.error("Falta GITHUB_TOKEN en el entorno.");
    process.exit(1);
  }
  if (!repoFullName) {
    console.error("Falta REPO_FULL_NAME en el entorno (owner/repo).");
    process.exit(1);
  }
  const [owner, repo] = repoFullName.split("/");
  return { owner, repo, ...opts };
}

async function ghGet(url, extraAccept) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: extraAccept || "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Error ${res.status} ${res.statusText} al consultar ${url}: ${text}`
    );
  }
  return res.json();
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function sanitizeHtml(html = "") {
  // Eliminamos <script>... y atributos on*
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "");
}

function fmtDate(d) {
  if (!d) return "";
  try {
    return dayjs(d).format("YYYY-MM-DD HH:mm:ss");
  } catch {
    return String(d);
  }
}

function limit(str, max = 10000) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "\n...[TRUNCADO]" : str;
}

function buildHtml(data) {
  const {
    owner,
    repo,
    pr,
    commits,
    files,
    reviews,
    issueComments,
    reviewComments,
    timelineEvents,
    checks,
    statuses,
    options,
  } = data;
  const status =
    pr.state +
    (pr.merged_at ? " (merged)" : pr.closed_at ? " (closed)" : "") +
    (pr.draft ? " (draft)" : "");
  const approvals = reviews.filter((r) => r.state === "APPROVED").length;
  const changesRequested = reviews.filter(
    (r) => r.state === "CHANGES_REQUESTED"
  ).length;
  const reviewersRequested =
    pr.requested_reviewers?.map((u) => u.login).join(", ") || "(ninguno)";
  const assignees = pr.assignees?.map((u) => u.login).join(", ") || "(ninguno)";
  const labels = pr.labels?.map((l) => l.name).join(", ") || "(ninguna)";
  const descriptionHtml = sanitizeHtml(
    md.render(pr.body || "(sin descripción)")
  );

  const commitsHtml = options.summaryOnly
    ? ""
    : commits
        .map(
          (c) => `
    <tr>
      <td><code>${c.sha.slice(0, 7)}</code></td>
      <td>${escapeHtml(c.commit.message.split("\n")[0])}</td>
      <td>${escapeHtml(c.author?.login ?? c.commit.author?.name ?? "")}</td>
      <td>${fmtDate(c.commit.author?.date)}</td>
    </tr>
  `
        )
        .join("");

  const filesHtml = files
    .map(
      (f) => `
    <tr>
      <td>${escapeHtml(f.filename)}</td>
      <td>${f.status}</td>
      <td>+${f.additions} / -${f.deletions}</td>
      <td>${f.changes}</td>
    </tr>
  `
    )
    .join("");

  const reviewsHtml = options.summaryOnly
    ? ""
    : reviews
        .map(
          (r) => `
    <div class="review">
      <div class="meta"><strong>${escapeHtml(r.user?.login ?? "")}</strong> — ${
            r.state
          } — ${fmtDate(r.submitted_at)}</div>
      <div class="body">${escapeHtml(r.body ?? "")}</div>
    </div>
  `
        )
        .join("");

  const issueCommentsHtml = options.summaryOnly
    ? ""
    : issueComments
        .map(
          (c) => `
    <div class="comment">
      <div class="meta"><strong>${escapeHtml(
        c.user?.login ?? ""
      )}</strong> — ${fmtDate(c.created_at)}</div>
      <div class="body">${escapeHtml(c.body ?? "")}</div>
    </div>
  `
        )
        .join("");

  const reviewCommentsHtml =
    options.summaryOnly || options.excludeReviewComments
      ? ""
      : reviewComments
          .map(
            (c) => `
    <div class="comment">
      <div class="meta"><strong>${escapeHtml(
        c.user?.login ?? ""
      )}</strong> — ${fmtDate(c.created_at)}</div>
      <div class="code-ref">Archivo: ${escapeHtml(c.path)} (Línea: ${
              c.original_line ?? c.line ?? "-"
            })</div>
      <div class="body">${escapeHtml(c.body ?? "")}</div>
    </div>
  `
          )
          .join("");

  const largeThreshold = 40000;
  const diffSectionsHtml =
    options.summaryOnly || options.excludeDiff
      ? ""
      : files
          .map((f) => {
            let content;
            if (!f.patch) {
              content = "(diff no disponible)";
            } else if (
              !options.forceLargeDiffs &&
              f.patch.length > largeThreshold
            ) {
              content =
                "Diff demasiado grande (> " +
                largeThreshold +
                " caracteres). Use --force-large-diffs para incluirlo.";
            } else {
              content = f.patch;
            }
            return `
    <details class="diff" ${
      f.patch && f.patch.length < largeThreshold ? "open" : ""
    }>
      <summary>Diff — ${escapeHtml(f.filename)}</summary>
      <pre>${escapeHtml(
        limit(content, options.forceLargeDiffs ? 120000 : 60000)
      )}</pre>
    </details>`;
          })
          .join("");

  const timelineHtml = options.summaryOnly
    ? ""
    : timelineEvents
        .map((ev) => {
          const type = ev.event || ev.type || "desconocido";
          const actor = ev.actor?.login || ev.user?.login || "";
          const created = fmtDate(ev.created_at);
          let detail = "";
          if (type === "labeled")
            detail = `Etiqueta añadida: ${escapeHtml(ev.label?.name ?? "")}`;
          if (type === "unlabeled")
            detail = `Etiqueta removida: ${escapeHtml(ev.label?.name ?? "")}`;
          if (type === "assigned")
            detail = `Asignado a: ${escapeHtml(ev.assignee?.login ?? "")}`;
          if (type === "unassigned")
            detail = `Desasignado: ${escapeHtml(ev.assignee?.login ?? "")}`;
          if (type === "referenced")
            detail = `Referenciado desde: ${escapeHtml(
              ev.commit_id?.slice(0, 7) ?? ""
            )}`;
          if (type === "closed") detail = "PR cerrado";
          if (type === "merged") detail = "PR mergeado";
          if (type === "ready_for_review")
            detail = "Marcado como listo para revisión";
          if (type === "convert_to_draft") detail = "Convertido a draft";
          if (type === "cross-referenced")
            detail = `Cross-reference: ${escapeHtml(
              ev.source?.issue?.html_url ?? ""
            )}`;
          if (!detail) detail = escapeHtml(JSON.stringify(ev));
          return `<tr><td>${created}</td><td>${escapeHtml(
            type
          )}</td><td>${escapeHtml(actor)}</td><td>${detail}</td></tr>`;
        })
        .join("");

  const checksHtml = options.summaryOnly
    ? ""
    : checks
        .map(
          (ch) => `
    <tr>
      <td>${escapeHtml(ch.name)}</td>
      <td>${escapeHtml(ch.status)}</td>
      <td>${escapeHtml(ch.conclusion ?? "")}</td>
      <td>${fmtDate(ch.completed_at ?? ch.started_at)}</td>
      <td><a href="${escapeHtml(ch.details_url ?? "")}">${escapeHtml(
            ch.details_url ?? ""
          )}</a></td>
    </tr>
  `
        )
        .join("");

  const statusesHtml = options.summaryOnly
    ? ""
    : statuses
        .map(
          (st) => `
    <tr>
      <td>${escapeHtml(st.context)}</td>
      <td>${escapeHtml(st.state)}</td>
      <td>${fmtDate(st.created_at)}</td>
      <td><a href="${escapeHtml(st.target_url ?? "")}">${escapeHtml(
            st.target_url ?? ""
          )}</a></td>
    </tr>
  `
        )
        .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>PR #${pr.number} — ${escapeHtml(pr.title)} — ${owner}/${repo}</title>
  <style>
    body { font-family: system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial,sans-serif; margin: 24px; color:#111; }
    h1,h2,h3 { margin:0 0 8px; }
    h2 { margin-top:28px; border-bottom:1px solid #ddd; padding-bottom:4px; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px; }
    th,td { border:1px solid #ddd; padding:6px 8px; text-align:left; vertical-align:top; }
    pre { background:#f6f8fa; border:1px solid #eaecef; border-radius:6px; padding:12px; font-size:11px; overflow:auto; }
    .meta { color:#555; font-size:12px; }
    .box { border:1px solid #ddd; border-radius:6px; padding:12px; background:#fafafa; margin-bottom:16px; }
    .comment,.review { margin:8px 0; padding:8px; border:1px solid #eee; border-radius:6px; }
    details.diff { margin:8px 0; }
    summary { cursor:pointer; font-weight:bold; }
    footer { position:fixed; bottom:0; left:0; right:0; text-align:center; font-size:10px; color:#666; }
    @page { size:A4; margin:16mm; }
    .markdown-body h1 { font-size:20px; }
    .markdown-body h2 { font-size:18px; }
    .markdown-body h3 { font-size:16px; }
    .markdown-body code { background:#f6f8fa; padding:2px 4px; border-radius:4px; font-size:11px; }
    .markdown-body pre code { background:transparent; padding:0; }
    .markdown-body pre { background:#f6f8fa; border:1px solid #eaecef; border-radius:6px; padding:12px; overflow:auto; }
    .markdown-body a { color:#0366d6; text-decoration:none; }
    .markdown-body a:hover { text-decoration:underline; }
    .markdown-body blockquote { border-left:4px solid #dfe2e5; padding:0 12px; color:#6a737d; margin:0 0 16px; }
    .markdown-body ul, .markdown-body ol { padding-left:24px; }
    .markdown-body table { display:block; width:100%; overflow:auto; }
  </style>
</head>
<body>
  <h1>Pull Request #${pr.number}: ${escapeHtml(pr.title)}</h1>
  <div class="meta">Estado: ${status} — Autor: ${escapeHtml(
    pr.user?.login ?? ""
  )} — Creado: ${fmtDate(pr.created_at)} — Cerrado: ${fmtDate(pr.closed_at)} ${
    pr.merged_at ? " — Merge: " + fmtDate(pr.merged_at) : ""
  }</div>
  <div class="box"><strong>URL:</strong> https://github.com/${owner}/${repo}/pull/${
    pr.number
  }<br />Base: ${escapeHtml(pr.base?.ref)} — Head: ${escapeHtml(
    pr.head?.ref
  )} — Merge commit: ${escapeHtml(pr.merge_commit_sha ?? "")}</div>

  <h2>Descripción (Markdown)</h2>
  <div class="box markdown-body">${descriptionHtml}</div>

  <h2>Resumen</h2>
  <div class="box">
    <div>Commits: ${commits.length}</div>
    <div>Archivos cambiados: ${files.length} — Adiciones: ${files.reduce(
    (a, f) => a + f.additions,
    0
  )} — Eliminaciones: ${files.reduce((a, f) => a + f.deletions, 0)}</div>
    <div>Aprobaciones: ${approvals} — Solicitudes de cambio: ${changesRequested}</div>
    <div>Labels: ${escapeHtml(labels)}</div>
    <div>Assignees: ${escapeHtml(assignees)}</div>
    <div>Reviewers solicitados: ${escapeHtml(reviewersRequested)}</div>
    <div>Draft: ${pr.draft ? "Sí" : "No"}</div>
  </div>

  ${
    options.summaryOnly
      ? ""
      : `
  <h2>Commits</h2>
  <table><thead><tr><th>SHA</th><th>Mensaje</th><th>Autor</th><th>Fecha</th></tr></thead><tbody>${
    commitsHtml || '<tr><td colspan="4">(sin commits)</td></tr>'
  }</tbody></table>

  <h2>Archivos modificados</h2>
  <table><thead><tr><th>Archivo</th><th>Estado</th><th>+/-</th><th>Cambios</th></tr></thead><tbody>${
    filesHtml || '<tr><td colspan="4">(sin archivos)</td></tr>'
  }</tbody></table>

  <h2>Revisiones</h2>
  ${reviewsHtml || '<div class="meta">(sin revisiones)</div>'}

  <h2>Comentarios (conversación)</h2>
  ${issueCommentsHtml || '<div class="meta">(sin comentarios)</div>'}

  ${
    options.excludeReviewComments
      ? ""
      : `<h2>Comentarios de revisión (en línea)</h2>
  ${
    reviewCommentsHtml ||
    '<div class="meta">(sin comentarios de revisión)</div>'
  }`
  }

  <h2>Eventos (Timeline)</h2>
  <table><thead><tr><th>Fecha</th><th>Evento</th><th>Actor</th><th>Detalle</th></tr></thead><tbody>${
    timelineHtml || '<tr><td colspan="4">(sin eventos)</td></tr>'
  }</tbody></table>

  <h2>Checks (Check Runs)</h2>
  <table><thead><tr><th>Nombre</th><th>Status</th><th>Conclusión</th><th>Fecha</th><th>URL</th></tr></thead><tbody>${
    checksHtml || '<tr><td colspan="5">(sin checks)</td></tr>'
  }</tbody></table>

  <h2>Status API</h2>
  <table><thead><tr><th>Contexto</th><th>Estado</th><th>Fecha</th><th>URL</th></tr></thead><tbody>${
    statusesHtml || '<tr><td colspan="4">(sin statuses)</td></tr>'
  }</tbody></table>

  <h2>Diff (parche) por archivo</h2>
  <div>${
    options.excludeDiff
      ? '<div class="meta">(differences excluidas)</div>'
      : diffSectionsHtml || '<div class="meta">(sin diff)</div>'
  }</div>
  `
  }

  <footer>Página generada el ${fmtDate(new Date().toISOString())} - PR #${
    pr.number
  } ${owner}/${repo}</footer>
</body>
</html>`;
  return html;
}

async function main() {
  const {
    owner,
    repo,
    prNumber,
    excludeDiff,
    summaryOnly,
    excludeReviewComments,
    forceLargeDiffs,
  } = parseArgs();
  const options = {
    excludeDiff,
    summaryOnly,
    excludeReviewComments,
    forceLargeDiffs,
  };
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const pr = await ghGet(`${base}/pulls/${prNumber}`);
  const commits = summaryOnly
    ? []
    : await ghGet(`${base}/pulls/${prNumber}/commits`);
  const files = await ghGet(`${base}/pulls/${prNumber}/files`);
  const reviews = summaryOnly
    ? []
    : await ghGet(`${base}/pulls/${prNumber}/reviews`).catch(() => []);
  const issueComments = summaryOnly
    ? []
    : await ghGet(
        `${base.replace("/pulls", "")}/issues/${prNumber}/comments`
      ).catch(() => []);
  const reviewComments =
    summaryOnly || excludeReviewComments
      ? []
      : await ghGet(`${base}/pulls/${prNumber}/comments`).catch(() => []);
  const timelineEvents = summaryOnly
    ? []
    : await ghGet(
        `${base.replace("/pulls", "")}/issues/${prNumber}/timeline`,
        "application/vnd.github.mockingbird-preview+json"
      ).catch(() => []);

  let checks = [];
  let statuses = [];
  if (!summaryOnly && pr.head?.sha) {
    checks = await ghGet(`${base}/commits/${pr.head.sha}/check-runs`)
      .then((r) => r.check_runs || [])
      .catch(() => []);
    statuses = await ghGet(`${base}/commits/${pr.head.sha}/statuses`).catch(
      () => []
    );
  }

  const html = buildHtml({
    owner,
    repo,
    pr,
    commits,
    files,
    reviews,
    issueComments,
    reviewComments,
    timelineEvents,
    checks,
    statuses,
    options,
  });

  const outDir = path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, `pr-${prNumber}.html`);
  fs.writeFileSync(htmlPath, html, "utf8");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfPath = path.join(outDir, `pr-${prNumber}.pdf`);
  await page.pdf({
    path: pdfPath,
    format: "A4",
    margin: { top: "16mm", left: "16mm", right: "16mm", bottom: "20mm" },
  });
  await browser.close();

  console.log(`PDF generado: ${pdfPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
