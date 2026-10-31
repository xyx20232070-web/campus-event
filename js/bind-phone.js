// ==========================================================
// js/bind-phone.js —— 管理员：为账号绑定 / 修改手机号
// 规则：
//   未绑定手机号 → 直接绑定；
//   已绑定手机号 → 先通过「原手机号验证码」认证，才能修改为新手机号。
// ==========================================================
import {
  db, collection, doc, query, where, getDocs, updateDoc,
  requireRole, initNav, errMsg
} from "./firebase.js";
import { t } from "./i18n.js";
import { isValidPhone, normalizePhone, sendCode, verifyCode } from "./sms.js";

document.title = t("bp.title.tag");

const me = requireRole(); // 管理员与学生均可访问
initNav("bindPhone");

let users = [];        // 全部账号
let current = null;    // 当前选中账号
let oldVerified = false; // 原手机号是否已通过验证码认证

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// 验证码倒计时
function countdown(btn) {
  let left = 60;
  btn.disabled = true;
  btn.textContent = t("auth.resendIn", { s: left });
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = t("auth.sendCode");
    } else {
      btn.textContent = t("auth.resendIn", { s: left });
    }
  }, 1000);
}

// ---------------- 载入账号列表 ----------------
// 管理员可操作全部账号；学生只能操作自己的账号
async function loadAccounts() {
  const snap = await getDocs(collection(db, "users"));
  users = [];
  snap.forEach((d) => users.push({ id: d.id, ...d.data() }));
  if (me.role === "student") {
    users = users.filter((u) => u.userId === me.userId);
  }
  users.sort((a, b) => (a.userId || "").localeCompare(b.userId || ""));

  const select = document.getElementById("accountSelect");
  select.innerHTML = users
    .map(
      (u) =>
        `<option value="${u.id}">${esc(u.userId)} - ${esc(u.name)}（${
          u.role === "admin" ? t("role.admin") : t("role.student")
        }）${u.phone ? "" : " · " + t("bp.notBound")}</option>`
    )
    .join("");

  // 支持从账号管理页跳转过来时预选：bind-phone.html?userId=S003
  const preset = new URLSearchParams(location.search).get("userId");
  if (preset) {
    const hit = users.find((u) => u.userId === preset);
    if (hit) select.value = hit.id;
  }
  // 返回账号管理的入口只对管理员显示
  document.getElementById("backToUsers").style.display =
    me.role === "admin" ? "flex" : "none";

  select.addEventListener("change", pick);
  pick();
}

// 选中某个账号后刷新界面状态
function pick() {
  const id = document.getElementById("accountSelect").value;
  current = users.find((u) => u.id === id) || null;
  const hasPhone = !!(current && current.phone);
  oldVerified = false;

  document.getElementById("oldError").textContent = "";
  document.getElementById("oldSuccess").textContent = "";
  document.getElementById("bindError").textContent = "";
  document.getElementById("bindSuccess").textContent = "";
  document.getElementById("oldCode").value = "";
  document.getElementById("newPhone").value = "";
  document.getElementById("newCode").value = "";

  document.getElementById("accountInfo").innerHTML = `
    <p>${t("bp.currentPhone")}：<b>${
      hasPhone ? esc(current.phone) : `<span class="badge badge-orange">${t("bp.notBound")}</span>`
    }</b></p>`;

  // 已绑定 → 需要先验证原手机号；未绑定 → 直接绑定
  document.getElementById("oldCard").style.display = hasPhone ? "block" : "none";
  if (hasPhone) {
    document.getElementById("oldPhoneTip").textContent = t("bp.oldPhoneTip", {
      phone: current.phone
    });
  }
  const needVerify = hasPhone && !oldVerified;
  document.getElementById("newCard").style.display = needVerify ? "none" : "block";
  document.getElementById("newTitle").textContent = hasPhone
    ? t("bp.stepNewAfterVerify")
    : t("bp.stepNew");
}

// ---------------- 第 1 步：向原手机号发送验证码并验证 ----------------
document.getElementById("sendOldCodeBtn").addEventListener("click", async () => {
  const btn = document.getElementById("sendOldCodeBtn");
  const errEl = document.getElementById("oldError");
  errEl.textContent = "";
  if (!current || !current.phone) return;
  btn.disabled = true;
  btn.textContent = t("auth.sending");
  try {
    const code = await sendCode(current.phone);
    alert(t("auth.codeSent", { code: code }));
    countdown(btn);
  } catch (err) {
    errEl.textContent = errMsg(err);
    btn.disabled = false;
    btn.textContent = t("auth.sendCode");
  }
});

document.getElementById("verifyOldBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("oldError");
  const okEl = document.getElementById("oldSuccess");
  errEl.textContent = "";
  okEl.textContent = "";
  const code = document.getElementById("oldCode").value.trim();
  if (!code) {
    errEl.textContent = t("reg.phoneRequired");
    return;
  }
  document.getElementById("verifyOldBtn").disabled = true;
  try {
    if (!(await verifyCode(current.phone, code))) {
      errEl.textContent = t("auth.codeWrong");
      return;
    }
    oldVerified = true;
    okEl.textContent = t("bp.verified");
    document.getElementById("newCard").style.display = "block";
  } catch (err) {
    errEl.textContent = errMsg(err);
  } finally {
    document.getElementById("verifyOldBtn").disabled = false;
  }
});

// ---------------- 第 2 步：绑定新手机号 ----------------
document.getElementById("sendNewCodeBtn").addEventListener("click", async () => {
  const btn = document.getElementById("sendNewCodeBtn");
  const errEl = document.getElementById("bindError");
  errEl.textContent = "";
  const phone = document.getElementById("newPhone").value.trim();
  if (!isValidPhone(phone)) {
    errEl.textContent = t("auth.phoneInvalid");
    return;
  }
  btn.disabled = true;
  btn.textContent = t("auth.sending");
  try {
    // 新手机号不能已被其他账号占用
    const snap = await getDocs(
      query(collection(db, "users"), where("phone", "==", normalizePhone(phone)))
    );
    if (!snap.empty) {
      errEl.textContent = t("reg.phoneExists");
      btn.disabled = false;
      btn.textContent = t("auth.sendCode");
      return;
    }
    const code = await sendCode(phone);
    alert(t("auth.codeSent", { code: code }));
    countdown(btn);
  } catch (err) {
    errEl.textContent = errMsg(err);
    btn.disabled = false;
    btn.textContent = t("auth.sendCode");
  }
});

document.getElementById("bindBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("bindError");
  const okEl = document.getElementById("bindSuccess");
  const btn = document.getElementById("bindBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  if (!current) {
    errEl.textContent = t("bp.notSelected");
    return;
  }
  // 已绑定却没通过原手机号验证 → 不允许修改
  if (current.phone && !oldVerified) {
    errEl.textContent = t("bp.verifyFirst");
    return;
  }
  const phone = document.getElementById("newPhone").value.trim();
  const code = document.getElementById("newCode").value.trim();
  if (!isValidPhone(phone)) {
    errEl.textContent = t("auth.phoneInvalid");
    return;
  }
  if (!code) {
    errEl.textContent = t("reg.phoneRequired");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("bp.submitting");
  try {
    if (!(await verifyCode(phone, code))) {
      errEl.textContent = t("auth.codeWrong");
    } else {
      await updateDoc(doc(db, "users", current.id), { phone: normalizePhone(phone) });
      okEl.textContent = current.phone
        ? t("bp.updated", { phone: normalizePhone(phone) })
        : t("bp.success", { phone: normalizePhone(phone) });
      await loadAccounts(); // 刷新列表中的绑定状态
      const hit = users.find((u) => u.id === current.id);
      if (hit) document.getElementById("accountSelect").value = hit.id;
      pick();
      return;
    }
  } catch (err) {
    errEl.textContent = errMsg(err);
  }
  btn.disabled = false;
  btn.textContent = t("bp.submit");
});

loadAccounts().catch((err) => {
  document.getElementById("accountInfo").innerHTML =
    `<div class="empty">${errMsg(err)}</div>`;
});
