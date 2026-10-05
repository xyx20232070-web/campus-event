// ==========================================================
// js/history.js —— 6号负责：我的参加记录（支持中韩双语）
// 功能：按 studentId 查询 applications，关联 events 显示活动信息，
//       支持取消报名（更新 applyStatus）及查看 QR
// ==========================================================
import {
  db, collection, doc, getDoc, getDocs, updateDoc,
  query, where, requireRole, initNav, fmtTime
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("hist.title.tag");

const user = requireRole("student"); // 仅学生可访问
initNav("history");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function load() {
  // 1. 查询我的所有报名记录（applications 集合）
  const snap = await getDocs(
    query(collection(db, "applications"), where("studentId", "==", user.userId))
  );
  const apps = [];
  snap.forEach((d) => apps.push({ id: d.id, ...d.data() }));
  apps.sort((a, b) => (b.applyTime || "").localeCompare(a.applyTime || ""));

  document.getElementById("loading").style.display = "none";
  const box = document.getElementById("historyBox");

  if (apps.length === 0) {
    box.innerHTML =
      `<div class="card"><div class="empty">${t("hist.empty")}<br><a href="events.html">${t("qr.goEvents")}</a></div></div>`;
    return;
  }

  // 2. 关联活动信息（events 集合），兼容活动被删除的情况
  const eventCache = {};
  for (const a of apps) {
    if (!a.eventName && !eventCache[a.eventId]) {
      try {
        const s = await getDoc(doc(db, "events", a.eventId));
        eventCache[a.eventId] = s.exists() ? s.data() : null;
      } catch (e) {
        eventCache[a.eventId] = null;
      }
    }
  }

  const rows = apps
    .map((a) => {
      const ev = eventCache[a.eventId];
      const cancelled = a.applyStatus === "已取消";
      const entered = a.entryStatus === "已入场";
      return `
      <tr>
        <td>${esc(a.eventName || (ev ? ev.name : t("hist.deleted")))}</td>
        <td>${ev ? `${ev.date} ${ev.time || ""}` : "-"}</td>
        <td>${esc(ev ? ev.place : "-")}</td>
        <td><span class="badge ${cancelled ? "badge-gray" : "badge-green"}">${cancelled ? t("status.cancelled") : t("status.applied")}</span></td>
        <td><span class="badge ${entered ? "badge-green" : "badge-orange"}">${entered ? t("status.entered") : t("status.notEntered")}</span></td>
        <td>${a.applyTime ? fmtTime(a.applyTime) : "-"}</td>
        <td class="actions">
          ${!cancelled
            ? `<a class="btn btn-outline btn-sm" href="qr.html?eventId=${esc(a.eventId)}">${t("action.viewQr")}</a>`
            : ""}
          ${!cancelled && !entered
            ? `<button class="btn btn-danger btn-sm" data-cancel="${a.id}">${t("hist.cancel")}</button>`
            : ""}
        </td>
      </tr>`;
    })
    .join("");

  box.innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>${t("hist.col.eventName")}</th><th>${t("hist.col.datetime")}</th><th>${t("hist.col.place")}</th><th>${t("col.applyStatus")}</th><th>${t("col.entryStatus")}</th><th>${t("hist.col.applyTime")}</th><th>${t("col.action")}</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;

  // 3. 取消报名：更新 applyStatus 为“已取消”
  box.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const a = apps.find((x) => x.id === btn.dataset.cancel);
      if (!confirm(t("hist.cancelMsg", { name: a.eventName || "" }))) return;
      btn.disabled = true;
      btn.textContent = t("hist.cancelling");
      try {
        await updateDoc(doc(db, "applications", a.id), { applyStatus: "已取消" });
        alert(t("hist.cancelOk"));
        load(); // 重新加载列表
      } catch (err) {
        alert(t("hist.fail") + err.message);
        btn.disabled = false;
        btn.textContent = t("hist.cancel");
      }
    })
  );
}

load().catch((err) => {
  document.getElementById("loading").textContent = t("hist.queryFail") + err.message;
});
