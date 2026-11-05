// ==========================================================
// js/security-code.js —— 安全验证卡（管理员）
// 为每个账号生成一张 10×10 口令卡：001~100 随机排列，
// 每个账号的排列顺序各不相同，保存在该账号的 users 文档中。
// 学生在「找回密码」页面按随机坐标 (行, 列) 输入对应数字即可验证身份。
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

requireRole("admin"); // 仅管理员可生成 / 查看口令卡
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
async function loadAccounts() {
  const snap = await getDocs(collection(db, "users"));
  users = [];
  snap.forEach((d) => users.push({ id: d.id, ...d.data() }));
  users.sort((a, b) => (a.userId || "").localeCompare(b.userId || ""));

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
    wrap.style.display = "none";
    genBtn.textContent = t("sc.gen");
  }
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
