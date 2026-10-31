// ==========================================================
// js/qr.js —— 5号负责：QR 二维码及入场确认（支持中韩双语）
// 功能：
//   学生 —— 查看自己报名活动的 QR 码与入场状态；
//   管理员 —— 查看某活动的报名列表，核对 QR 信息后
//             修改 applications.entryStatus 为“已入场”
// ==========================================================
import {
  db, collection, doc, getDocs, updateDoc,
  query, where, requireRole, initNav, qrImageUrl, errMsg
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("qr.title.tag");

const user = requireRole();
initNav("qr");
document.getElementById("loading").textContent = t("qr.loading");

// 从地址栏读取活动 ID（可选）：qr.html?eventId=xxx
const eventIdParam = new URLSearchParams(location.search).get("eventId");

// 生成 QR 码内容（JSON 字符串，包含学生与活动信息）
function qrPayload(a) {
  return JSON.stringify({
    studentId: a.studentId,
    studentName: a.studentName,
    eventId: a.eventId,
    eventName: a.eventName
  });
}

function qrImg(payload) {
  return (
    `<img src="${qrImageUrl(payload)}" alt="QR" onerror="this.replaceWith(Object.assign(document.createElement('p'),{textContent:'${t("qr.qrFail")}' + ${JSON.stringify(payload)}}))">`
  );
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// 查询某活动的所有报名记录
async function getApplications(eventId) {
  const snap = await getDocs(
    query(collection(db, "applications"), where("eventId", "==", eventId))
  );
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

// 查询所有活动
async function getEvents() {
  const snap = await getDocs(collection(db, "events"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return list;
}

// ---------------- 学生视图：显示我的 QR 码 ----------------
async function renderStudent() {
  document.getElementById("pageSub").textContent = t("qr.subStudent");

  // 查询我的报名记录
  const snap = await getDocs(
    query(collection(db, "applications"), where("studentId", "==", user.userId))
  );
  const mine = [];
  snap.forEach((d) => mine.push({ id: d.id, ...d.data() }));
  mine.sort((a, b) => (b.applyTime || "").localeCompare(a.applyTime || ""));

  document.getElementById("loading").style.display = "none";
  const card = document.getElementById("studentQrCard");

  if (mine.length === 0) {
    card.style.display = "block";
    document.getElementById("studentQrBox").innerHTML =
      `<div class="empty">${t("qr.noApply")}<br><a href="events.html">${t("qr.goEvents")}</a></div>`;
    return;
  }

  // 若地址栏指定了活动，优先显示该活动
  let current = eventIdParam
    ? mine.find((a) => a.eventId === eventIdParam)
    : null;
  if (!current) current = mine.find((a) => a.applyStatus !== "已取消") || mine[0];

  function show(a) {
    const entered = a.entryStatus === "已入场";
    document.getElementById("studentQrBox").innerHTML = `
      <h3>${esc(a.eventName || "")}</h3>
      ${qrImg(qrPayload(a))}
      <div class="qr-info">
        <p><b>${esc(user.name)}</b>（${esc(user.userId)}）</p>
        <p>${t("col.applyStatus")}：<span class="badge ${a.applyStatus === "已取消" ? "badge-gray" : "badge-green"}">${a.applyStatus === "已取消" ? t("status.cancelled") : t("status.applied")}</span>
           ${t("col.entryStatus")}：<span class="badge ${entered ? "badge-green" : "badge-orange"}">${entered ? t("status.entered") : t("status.notEntered")}</span></p>
      </div>`;
    const actions = document.getElementById("studentQrActions");
    actions.innerHTML = mine
      .filter((x) => x.id !== a.id)
      .map(
        (x) =>
          `<button class="btn btn-outline btn-sm" data-qr="${x.id}">${esc(x.eventName || "")}</button>`
      )
      .join("");
    actions.querySelectorAll("[data-qr]").forEach((btn) =>
      btn.addEventListener("click", () => {
        show(mine.find((x) => x.id === btn.dataset.qr));
      })
    );
  }
  card.style.display = "block";
  show(current);
}

// ==========================================================
// 管理员：扫描入场码（摄像头识别 + 手动输入兜底）
// ==========================================================
let scanStream = null;
let scanning = false;
let refreshTable = () => {}; // 由管理员表格刷新函数赋值

async function startScan() {
  const video = document.getElementById("scanVideo");
  const resultBox = document.getElementById("scanResult");
  if (typeof window.jsQR === "undefined") {
    alert(t("qr.scanNoLib"));
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = scanStream;
    video.style.display = "block";
    await video.play();
    scanning = true;
    resultBox.innerHTML = "";
    document.getElementById("startScanBtn").style.display = "none";
    document.getElementById("stopScanBtn").style.display = "";
    requestAnimationFrame(tick);
  } catch (err) {
    alert(t("qr.scanOpenFail") + err.message);
  }
}

function stopScan() {
  scanning = false;
  if (scanStream) {
    scanStream.getTracks().forEach((tr) => tr.stop());
    scanStream = null;
  }
  const video = document.getElementById("scanVideo");
  if (video) {
    video.style.display = "none";
    video.srcObject = null;
  }
  document.getElementById("startScanBtn").style.display = "";
  document.getElementById("stopScanBtn").style.display = "none";
}

// 逐帧识别二维码
function tick() {
  if (!scanning) return;
  const video = document.getElementById("scanVideo");
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(tick);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = window.jsQR(img.data, canvas.width, canvas.height);
  if (code && code.data) {
    stopScan();
    handleScanned(code.data);
    return;
  }
  requestAnimationFrame(tick);
}

// 处理扫描结果（二维码内容为 JSON）
async function handleScanned(raw) {
  const box = document.getElementById("scanResult");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    // 不是 JSON 时按纯学号处理
    payload = { studentId: raw.trim() };
  }
  if (!payload.studentId) {
    box.innerHTML = `<div class="empty">${t("qr.notFound")}</div>`;
    return;
  }

  // 查询该学生的报名记录
  const conditions = [where("studentId", "==", payload.studentId)];
  if (payload.eventId) conditions.push(where("eventId", "==", payload.eventId));
  const snap = await getDocs(query(collection(db, "applications"), ...conditions));
  let app = null;
  snap.forEach((d) => {
    if (!app) app = { id: d.id, ...d.data() };
  });

  if (!app) {
    box.innerHTML = `<div class="empty">${t("qr.notFound")}</div>`;
    return;
  }
  if (app.applyStatus === "已取消") {
    box.innerHTML = `<div class="empty">${t("status.cancelled")}</div>`;
    return;
  }

  const entered = app.entryStatus === "已入场";
  box.className = "scan-result";
  box.innerHTML = `
    <p><b>${t("qr.scanResultTitle")}</b></p>
    <p>${t("col.studentName")}：${esc(app.studentName || "-")}（${esc(app.studentId)}）</p>
    <p>${t("hist.col.eventName")}：${esc(app.eventName || "-")}</p>
    <p>${t("col.entryStatus")}：<span class="badge ${entered ? "badge-green" : "badge-orange"}">${entered ? t("status.entered") : t("status.notEntered")}</span></p>
    ${entered
      ? `<p class="form-success">${t("qr.alreadyEntered")}</p>`
      : `<button class="btn btn-success btn-sm" id="scanConfirmBtn">${t("action.confirmEntry")}</button>`}`;

  if (!entered) {
    document.getElementById("scanConfirmBtn").addEventListener("click", async () => {
      const btn = document.getElementById("scanConfirmBtn");
      btn.disabled = true;
      btn.textContent = t("action.processing");
      try {
        await updateDoc(doc(db, "applications", app.id), { entryStatus: "已入场" });
        alert(t("qr.enteredOk"));
        refreshTable();
        handleScanned(raw); // 刷新显示状态
      } catch (err) {
        alert(errMsg(err));
        btn.disabled = false;
        btn.textContent = t("action.confirmEntry");
      }
    });
  }
}

// ---------------- 管理员视图：确认入场 ----------------
async function renderAdmin() {
  document.getElementById("pageSub").textContent = t("qr.subAdmin");
  document.getElementById("eventSelectLabel").textContent = t("qr.selectEvent");

  const events = await getEvents();
  if (events.length === 0) {
    document.getElementById("loading").innerHTML =
      `<div class="empty">${t("qr.noEvents")}</div>`;
    return;
  }

  document.getElementById("loading").style.display = "none";

  // 显示扫码区域并绑定事件
  document.getElementById("scanCard").style.display = "block";
  document.getElementById("startScanBtn").addEventListener("click", startScan);
  document.getElementById("stopScanBtn").addEventListener("click", stopScan);
  document.getElementById("manualBtn").addEventListener("click", () => {
    const raw = document.getElementById("manualQr").value.trim();
    if (!raw) return;
    handleScanned(raw);
  });
  // 离开页面时关闭摄像头
  window.addEventListener("beforeunload", stopScan);

  const card = document.getElementById("adminCard");
  const select = document.getElementById("eventSelect");
  select.innerHTML = events
    .map((e) => `<option value="${e.id}">${esc(e.name)}（${e.date}）</option>`)
    .join("");
  if (eventIdParam) select.value = eventIdParam;
  card.style.display = "block";

  async function showTable() {
    const apps = await getApplications(select.value);
    const box = document.getElementById("adminTable");
    document.getElementById("adminQrBox").style.display = "none";
    document.getElementById("adminQrBox").innerHTML = "";

    if (apps.length === 0) {
      box.innerHTML = `<div class="empty">${t("qr.noApps")}</div>`;
      return;
    }
    const rows = apps
      .map((a) => {
        const cancelled = a.applyStatus === "已取消";
        const entered = a.entryStatus === "已入场";
        return `
        <tr>
          <td>${esc(a.studentName || "-")}</td>
          <td>${esc(a.studentId)}</td>
          <td><span class="badge ${cancelled ? "badge-gray" : "badge-green"}">${cancelled ? t("status.cancelled") : t("status.applied")}</span></td>
          <td><span class="badge ${entered ? "badge-green" : "badge-orange"}">${entered ? t("status.entered") : t("status.notEntered")}</span></td>
          <td class="actions">
            <button class="btn btn-outline btn-sm" data-show="${a.id}" ${cancelled ? "disabled" : ""}>${t("action.viewQr")}</button>
            <button class="btn btn-success btn-sm" data-enter="${a.id}" ${cancelled || entered ? "disabled" : ""}>${t("action.confirmEntry")}</button>
          </td>
        </tr>`;
      })
      .join("");
    box.innerHTML = `
      <table>
        <thead><tr><th>${t("col.studentName")}</th><th>${t("col.studentId")}</th><th>${t("col.applyStatus")}</th><th>${t("col.entryStatus")}</th><th>${t("col.action")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    // 查看学生 QR 信息
    box.querySelectorAll("[data-show]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const a = apps.find((x) => x.id === btn.dataset.show);
        const qrBox = document.getElementById("adminQrBox");
        qrBox.style.display = "block";
        qrBox.innerHTML = `
          <h3>${esc(a.eventName || "")}</h3>
          ${qrImg(qrPayload(a))}
          <div class="qr-info"><p><b>${esc(a.studentName || "-")}</b>（${esc(a.studentId)}）</p></div>`;
        qrBox.scrollIntoView({ behavior: "smooth" });
      })
    );

    // 确认入场：修改 applications.entryStatus
    box.querySelectorAll("[data-enter]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const a = apps.find((x) => x.id === btn.dataset.enter);
        if (!confirm(t("qr.confirmMsg", { name: a.studentName, id: a.studentId }))) return;
        btn.disabled = true;
        btn.textContent = t("action.processing");
        try {
          await updateDoc(doc(db, "applications", a.id), { entryStatus: "已入场" });
          alert(t("qr.enteredOk"));
          showTable();
        } catch (err) {
          alert(errMsg(err));
          btn.disabled = false;
          btn.textContent = t("action.confirmEntry");
        }
      })
    );
  }

  select.addEventListener("change", showTable);
  document.getElementById("refreshBtn").addEventListener("click", showTable);
  refreshTable = showTable; // 扫码确认入场后同步刷新列表
  showTable();
}

// 根据角色加载对应视图
(user.role === "admin" ? renderAdmin() : renderStudent()).catch((err) => {
  document.getElementById("loading").textContent = errMsg(err);
});
