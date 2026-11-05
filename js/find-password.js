// ==========================================================
// js/find-password.js —— 找回密码：安全验证卡坐标验证
// 流程：输入学号 → 系统随机给出坐标 (行, 列) →
//       用户按本人专属口令卡输入该位置的数字 → 验证通过显示密码
// ==========================================================
import { db, collection, query, where, getDocs, errMsg } from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("fpw.title.tag");

let account = null;  // 当前验证的账号 { id, securityCard, ... }
let coord = null;    // 当前坐标 { x: 行, y: 列 }

// 随机坐标：x 为行、y 为列（1~10）
function newCoord() {
  coord = {
    x: Math.floor(Math.random() * 10) + 1,
    y: Math.floor(Math.random() * 10) + 1
  };
  document.getElementById("coordTip").textContent = t("fpw.coordTip", {
    x: coord.x, y: coord.y
  });
  document.getElementById("coordInput").value = "";
}

// ---------------- 第 1 步：查找账号 ----------------
document.getElementById("nextBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("findError");
  const btn = document.getElementById("nextBtn");
  errEl.textContent = "";

  const userId = document.getElementById("fpUserId").value.trim();
  if (!userId) return;

  btn.disabled = true;
  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("userId", "==", userId))
    );
    account = null;
    snap.forEach((d) => (account = { id: d.id, ...d.data() }));

    if (!account) {
      errEl.textContent = t("fpw.notFound");
      return;
    }
    if (!Array.isArray(account.securityCard) || account.securityCard.length !== 100) {
      errEl.textContent = t("fpw.noCard");
      return;
    }

    // 进入第 2 步：给出随机坐标
    document.getElementById("step1").style.display = "none";
    document.getElementById("step2").style.display = "block";
    newCoord();
    return;
  } catch (err) {
    errEl.textContent = errMsg(err);
  }
  btn.disabled = false;
});

// ---------------- 第 2 步：按坐标验证 ----------------
document.getElementById("verifyBtn").addEventListener("click", () => {
  const errEl = document.getElementById("coordError");
  const okEl = document.getElementById("coordSuccess");
  errEl.textContent = "";
  okEl.textContent = "";

  const raw = document.getElementById("coordInput").value.replace(/\D/g, "");
  if (!raw) {
    errEl.textContent = t("fpw.empty");
    return;
  }
  const input = raw.padStart(3, "0");
  const answer = account.securityCard[(coord.x - 1) * 10 + (coord.y - 1)];

  if (input !== answer) {
    // 错误：更换新坐标，防止反复尝试同一个位置
    errEl.textContent = t("fpw.wrong");
    newCoord();
    return;
  }

  okEl.textContent = t("fpw.ok") + account.password;
  document.getElementById("verifyBtn").disabled = true;
});
