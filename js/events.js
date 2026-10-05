// ==========================================================
// js/events.js —— 2号负责：活动列表逻辑（支持中韩双语）
// 功能：从 Firestore events 集合查询活动并显示，
//       统计报名人数（applications 集合），提供详情入口
// ==========================================================
import {
  db, collection, getDocs, isDemo,
  requireRole, initNav
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("events.title.tag");

const user = requireRole(); // 学生与管理员都可访问
initNav("events");

if (isDemo) document.getElementById("demoBanner").style.display = "block";

const today = new Date().toISOString().slice(0, 10);

// 加载所有活动
async function loadEvents() {
  let events = [];
  const snap = await getDocs(collection(db, "events"));
  snap.forEach((d) => events.push({ id: d.id, ...d.data() }));
  events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // 统计每个活动的有效报名人数
  const counts = {};
  const appSnap = await getDocs(collection(db, "applications"));
  appSnap.forEach((d) => {
    const a = d.data();
    if (a.applyStatus !== "已取消") {
      counts[a.eventId] = (counts[a.eventId] || 0) + 1;
    }
  });

  render(events, counts);
}

// 渲染活动卡片
function render(events, counts) {
  document.getElementById("loading").style.display = "none";
  const box = document.getElementById("eventList");

  if (events.length === 0) {
    box.innerHTML = `<div class="empty">${t("events.empty")}</div>`;
    return;
  }

  box.innerHTML = events
    .map((e) => {
      const applied = counts[e.id] || 0;
      const remaining = Math.max(0, (e.maxPeople || 0) - applied);
      const ended = (e.date || "") < today;
      const full = remaining <= 0;

      let badge;
      if (ended) badge = `<span class="badge badge-gray">${t("events.badge.ended")}</span>`;
      else if (full) badge = `<span class="badge badge-orange">${t("events.badge.full")}</span>`;
      else badge = `<span class="badge badge-green">${t("events.badge.open")}</span>`;

      return `
        <div class="event-card">
          <div>${badge}</div>
          <h3>${esc(e.name)}</h3>
          <div class="event-meta">📅 ${e.date || "-"} ${e.time || ""}</div>
          <div class="event-meta">📍 ${esc(e.place || "-")}</div>
          <div class="event-meta">${t("events.seats", { a: applied, m: e.maxPeople ?? "-", r: remaining })}</div>
          <p class="event-desc">${esc(e.description || t("events.noIntro"))}</p>
          <div class="event-footer">
            <a class="btn btn-primary btn-sm" href="detail.html?eventId=${e.id}">${t("action.viewDetail")}</a>
            ${user && user.role === "admin"
              ? `<a class="btn btn-outline btn-sm" href="qr.html?eventId=${e.id}">${t("nav.qr")}</a>`
              : ""}
          </div>
        </div>`;
    })
    .join("");
}

// HTML 转义，防止内容破坏页面结构
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

loadEvents().catch((err) => {
  document.getElementById("loading").textContent = t("common.error") + err.message;
});
