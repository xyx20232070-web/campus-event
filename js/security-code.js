// ==========================================================
// js/security-code.js —— 安全验证卡
// 管理员：为任意账号生成 / 重新生成 10×10 口令卡；
// 学生：只能查看自己账号的口令卡（不能生成）。
// 口令卡为 001~100 的随机排列，每个账号顺序各不相同，
// 学生在「找回密码」页面按随机坐标 (行, 列) 输入对应数字验证身份。
// ==========================================================
import {
  db, collection, doc, getDocs, updateDoc,
  requireRole, initNav, errMsg
} from "./firebase.js";
import { t } from "./i18n.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

document.title = t("sc.title.tag");

const me = requireRole(); // 管理员与学生均可访问
initNav("securityCode");

let users = [];     // 全部账号
let current = null; // 当前选中账号

// 生成 001~100 的随机排列（Fisher-Yates 洗牌）
function genCard() {
  const nums = Array.from({ length: 100 }, (_, i) => String(i + 1).padStart(3, "0"));
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

// ---------------- 载入账号列表 ----------------
// 管理员：可选任意账号；学生：仅自己的账号，且隐藏发卡操作
async function loadAccounts() {
  const snap = await getDocs(collection(db, "users"));
  users = [];
  snap.forEach((d) => users.push({ id: d.id, ...d.data() }));
  if (me.role === "student") {
    users = users.filter((u) => u.userId === me.userId);
  }
  users.sort((a, b) => (a.userId || "").localeCompare(b.userId || ""));

  // 管理面板（选人 + 发卡）仅管理员可见
  const isAdmin = me.role === "admin";
  document.getElementById("adminPanel").style.display = isAdmin ? "block" : "none";

  const select = document.getElementById("accountSelect");
  select.innerHTML = users
    .map((u) => {
      const hasCard = Array.isArray(u.securityCard) && u.securityCard.length === 100;
      return `<option value="${u.id}">${esc(u.userId)} - ${esc(u.name)}（${
        u.role === "admin" ? t("role.admin") : t("role.student")
      }）${hasCard ? " · " + t("sc.hasCard") : ""}</option>`;
    })
    .join("");
  select.addEventListener("change", pick);
  pick();
}

// ---------------- 渲染选中账号的口令卡 ----------------
function pick() {
  const id = document.getElementById("accountSelect").value;
  current = users.find((u) => u.id === id) || null;
  document.getElementById("scError").textContent = "";
  document.getElementById("scSuccess").textContent = "";

  const wrap = document.getElementById("cardWrap");
  const tableEl = document.getElementById("cardTable");
  const genBtn = document.getElementById("genBtn");

  const card = current && Array.isArray(current.securityCard) ? current.securityCard : null;
  if (card && card.length === 100) {
    // 10×10 表格：行号 1~10，列号 1~10，单元格为口令卡数字
    let html = '<table class="sc-table"><thead><tr><th></th>';
    for (let c = 1; c <= 10; c++) html += `<th>${c}</th>`;
    html += "</tr></thead><tbody>";
    for (let r = 1; r <= 10; r++) {
      html += `<tr><th>${r}</th>`;
      for (let c = 1; c <= 10; c++) {
        html += `<td>${esc(card[(r - 1) * 10 + (c - 1)])}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    tableEl.innerHTML = html;
    wrap.style.display = "block";
    genBtn.textContent = t("sc.regen");
  } else {
    tableEl.innerHTML = "";
    if (isAdmin()) {
      wrap.style.display = "none";
      genBtn.textContent = t("sc.gen");
    } else {
      // 学生：管理员还没发卡
      tableEl.innerHTML = `<div class="empty">${t("sc.noCardYet")}</div>`;
      wrap.style.display = "block";
    }
  }
}

function isAdmin() {
  return me.role === "admin";
}

// ---------------- 生成 / 重新生成口令卡 ----------------
document.getElementById("genBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("scError");
  const okEl = document.getElementById("scSuccess");
  const btn = document.getElementById("genBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  if (!current) {
    errEl.textContent = t("sc.noAccount");
    return;
  }
  btn.disabled = true;
  try {
    await updateDoc(doc(db, "users", current.id), {
      securityCard: genCard(),
      securityCardAt: new Date().toISOString()
    });
    okEl.textContent = t("sc.genOk");
    await loadAccounts();
    const hit = users.find((u) => u.id === current.id);
    if (hit) document.getElementById("accountSelect").value = hit.id;
    pick();
    return;
  } catch (err) {
    errEl.textContent = errMsg(err);
  }
  btn.disabled = false;
});

loadAccounts().catch((err) => {
  document.getElementById("scError").textContent = errMsg(err);
});
