// ==========================================================
// js/security-code.js —— 我的专属安全验证卡
// 每个账号（学生 / 管理员）都有一张 10×10 口令卡：
//   · 新账号在创建时自动生成；
//   · 老账号首次登录时自动补发；
//   · 若仍无卡，进入本页时自动生成；
//   · 可随时「重新生成」，旧卡立即作废。
// 找回密码时系统随机给出坐标 (行, 列)，按卡输入对应数字即可验证身份。
// ==========================================================
import {
  db, collection, doc, query, where, getDocs, updateDoc,
  requireRole, initNav, errMsg, genSecurityCard
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("sc.title.tag");

const me = requireRole(); // 学生与管理员均可查看自己的卡
initNav("securityCode");

let myDocId = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------------- 渲染口令卡 ----------------
function renderCard(card) {
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
  document.getElementById("cardTable").innerHTML = html;
  document.getElementById("cardWrap").style.display = "block";
}

// ---------------- 载入自己的口令卡 ----------------
async function loadCard() {
  const snap = await getDocs(
    query(collection(db, "users"), where("userId", "==", me.userId))
  );
  myDocId = null;
  let card = null;
  snap.forEach((d) => {
    myDocId = d.id;
    card = d.data().securityCard;
  });

  if (!myDocId) {
    document.getElementById("scError").textContent = t("fpw.notFound");
    return;
  }
  // 没有卡（极端情况）→ 进入页面时自动生成
  if (!Array.isArray(card) || card.length !== 100) {
    card = genSecurityCard();
    await updateDoc(doc(db, "users", myDocId), {
      securityCard: card,
      securityCardAt: new Date().toISOString()
    });
    document.getElementById("scSuccess").textContent = t("sc.autoGen");
  }
  renderCard(card);
}

// ---------------- 重新生成（旧卡作废） ----------------
document.getElementById("regenBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("scError");
  const okEl = document.getElementById("scSuccess");
  const btn = document.getElementById("regenBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  btn.disabled = true;
  try {
    const card = genSecurityCard();
    await updateDoc(doc(db, "users", myDocId), {
      securityCard: card,
      securityCardAt: new Date().toISOString()
    });
    renderCard(card);
    okEl.textContent = t("sc.regenOk");
    return;
  } catch (err) {
    errEl.textContent = errMsg(err);
  }
  btn.disabled = false;
});

loadCard().catch((err) => {
  document.getElementById("scError").textContent = errMsg(err);
});
