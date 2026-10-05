// ==========================================================
// js/detail.js —— 4号负责：活动详情及报名（学生，支持中韩双语）
// 功能：读取活动详情、计算剩余名额、写入 applications 报名数据；
//       管理员访问时显示报名情况列表
// ==========================================================
import {
  db, collection, doc, getDoc, getDocs, addDoc,
  query, where, requireRole, initNav
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("detail.title.tag");

const user = requireRole();
initNav("events");

// 从地址栏读取活动 ID：detail.html?eventId=xxx
const eventId = new URLSearchParams(location.search).get("eventId");

async function load() {
  if (!eventId) {
    showError(t("detail.missingId"));
    return;
  }

  // 1. 读取活动详情（events 集合）
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) {
    showError(t("detail.notFound"));
    return;
  }
  const event = snap.data();

  // 2. 读取该活动的报名记录（applications 集合）
  const appSnap = await getDocs(
    query(collection(db, "applications"), where("eventId", "==", eventId))
  );
  const apps = [];
  appSnap.forEach((d) => apps.push({ id: d.id, ...d.data() }));
  const valid = apps.filter((a) => a.applyStatus !== "已取消");
  const applied = valid.length;
  const remaining = Math.max(0, (event.maxPeople || 0) - applied);

  renderEvent(event, applied, remaining);

  if (user.role === "student") {
    // 3. 学生：检查是否已报名
    const mine = valid.find((a) => a.studentId === user.userId);
    renderStudentArea(mine, event, remaining);
  } else {
    // 4. 管理员：显示报名情况
    renderAdminArea(apps);
  }
}

function showError(msg) {
  document.getElementById("loading").innerHTML =
    `<div class="empty">${msg} <br><a href="events.html">${t("action.back")}</a></div>`;
}

function renderEvent(e, applied, remaining) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("eventCard").style.display = "block";
  document.getElementById("eventName").textContent = e.name;
  document.getElementById("eventMeta").innerHTML = `
    <span class="badge badge-blue">📅 ${e.date || "-"} ${e.time || ""}</span>
    <span class="badge badge-blue">📍 ${esc(e.place || "-")}</span>
    <span class="badge badge-green">${t("detail.seats", { a: applied, m: e.maxPeople ?? "-", r: remaining })}</span>`;
  document.getElementById("eventDesc").textContent = e.description || t("detail.noIntro");
}

function renderStudentArea(mine, event, remaining) {
  const area = document.getElementById("studentArea");
  if (mine) {
    // 已报名：显示 QR 入口
    area.innerHTML = `
      <p class="form-success">${t("detail.appliedMsg", { name: esc(event.name) })}</p>
      <div class="actions">
        <a class="btn btn-primary" href="qr.html?eventId=${eventId}">${t("detail.viewQr")}</a>
        <a class="btn btn-outline" href="history.html">${t("detail.myRecords")}</a>
      </div>`;
  } else if (remaining <= 0) {
    area.innerHTML = `<p class="form-error">${t("detail.full")}</p>`;
  } else {
    // 未报名：显示报名按钮
    area.innerHTML = `
      <p style="color:#495057">${t("detail.applyTip")}</p>
      <button class="btn btn-primary" id="applyBtn">${t("detail.apply", { n: remaining })}</button>
      <p class="form-error" id="applyError"></p>`;
    document.getElementById("applyBtn").addEventListener("click", () => apply(event));
  }
}

// 报名：向 applications 集合新增一条文档
async function apply(event) {
  const btn = document.getElementById("applyBtn");
  const errEl = document.getElementById("applyError");
  btn.disabled = true;
  btn.textContent = t("detail.applying");
  try {
    await addDoc(collection(db, "applications"), {
      studentId: user.userId,
      studentName: user.name,
      eventId: eventId,
      eventName: event.name, // 冗余保存活动名，方便记录页展示
      applyStatus: "已报名",
      entryStatus: "未入场",
      applyTime: new Date().toISOString()
    });
    alert(t("detail.applyOk"));
    location.reload();
  } catch (err) {
    errEl.textContent = t("detail.applyFail") + err.message;
    btn.disabled = false;
    btn.textContent = t("detail.apply");
  }
}

function renderAdminArea(apps) {
  document.getElementById("applicantsTitle").textContent = t("detail.applicants");
  document.getElementById("adminArea").style.display = "block";
  const box = document.getElementById("applicantTable");
  if (apps.length === 0) {
    box.innerHTML = `<div class="empty">${t("detail.noApplicants")}</div>`;
    return;
  }
  const rows = apps
    .map(
      (a) => `
      <tr>
        <td>${esc(a.studentName || "-")}</td>
        <td>${esc(a.studentId)}</td>
        <td><span class="badge ${a.applyStatus === "已取消" ? "badge-gray" : "badge-green"}">${a.applyStatus === "已取消" ? t("status.cancelled") : t("status.applied")}</span></td>
        <td><span class="badge ${a.entryStatus === "已入场" ? "badge-green" : "badge-orange"}">${a.entryStatus === "已入场" ? t("status.entered") : t("status.notEntered")}</span></td>
      </tr>`
    )
    .join("");
  box.innerHTML = `
    <table>
      <thead><tr><th>${t("col.studentName")}</th><th>${t("col.studentId")}</th><th>${t("col.applyStatus")}</th><th>${t("col.entryStatus")}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="mt"><a class="btn btn-primary btn-sm" href="qr.html?eventId=${eventId}">${t("detail.goQr")}</a></p>`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

load().catch((err) => showError(t("common.error") + err.message));
