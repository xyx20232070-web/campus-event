// ==========================================================
// js/login.js —— 1号负责：登录页面逻辑（支持中韩双语）
// 功能：两种登录方式 —— 学号/密码登录、手机号验证码登录
// ==========================================================
import {
  db, collection, query, where, getDocs, isDemo, setSession, isCloudBlocked, errMsg
} from "./firebase.js";
import { t } from "./i18n.js";
import { isValidPhone, normalizePhone, sendCode, verifyCode, findUsersByPhone } from "./sms.js";

document.title = t("login.title.tag");

let role = "student";        // 密码登录时的角色选择
let mode = "password";       // password | code
let countdown = 0;
let timer = null;

// 登录方式切换
document.getElementById("modeSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest(".role-btn");
  if (!btn) return;
  document.querySelectorAll("#modeSwitch .role-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  mode = btn.dataset.mode;
  // 验证码登录时账号角色由手机号自动识别，无需选择
  document.getElementById("roleSwitch").style.display = mode === "code" ? "none" : "flex";
  document.getElementById("pwdFields").style.display = mode === "code" ? "none" : "block";
  document.getElementById("codeFields").style.display = mode === "code" ? "block" : "none";
  document.getElementById("loginError").textContent = "";
});

// 角色切换（仅密码登录）
document.getElementById("roleSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest(".role-btn");
  if (!btn) return;
  document.querySelectorAll("#roleSwitch .role-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  role = btn.dataset.role;
});

// 演示模式提示（含云端被拒后自动降级的情况）
if (isDemo || isCloudBlocked()) {
  document.getElementById("loginTip").innerHTML = t("login.demoTip");
}

// 验证码倒计时
function startCountdown() {
  const btn = document.getElementById("sendCodeBtn");
  countdown = 60;
  btn.disabled = true;
  btn.textContent = t("auth.resendIn", { s: countdown });
  timer = setInterval(() => {
    countdown -= 1;
    if (countdown <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = t("auth.sendCode");
    } else {
      btn.textContent = t("auth.resendIn", { s: countdown });
    }
  }, 1000);
}

// 获取验证码
document.getElementById("sendCodeBtn").addEventListener("click", async () => {
  const errorEl = document.getElementById("loginError");
  const btn = document.getElementById("sendCodeBtn");
  errorEl.textContent = "";
  const phone = document.getElementById("phone").value.trim();

  if (!isValidPhone(phone)) {
    errorEl.textContent = t("auth.phoneInvalid");
    return;
  }
  btn.disabled = true;
  btn.textContent = t("auth.sending");
  try {
    const code = await sendCode(phone);
    alert(t("auth.codeSent", { code: code })); // 演示环境直接展示验证码
    startCountdown();
  } catch (err) {
    errorEl.textContent = errMsg(err);
    btn.disabled = false;
    btn.textContent = t("auth.sendCode");
  }
});

// 登录提交
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = t("login.logging");

  try {
    let user = null;
    if (mode === "code") {
      // ---------- 手机号验证码登录 ----------
      const phone = document.getElementById("phone").value.trim();
      const code = document.getElementById("smsCode").value.trim();
      if (!isValidPhone(phone)) {
        errorEl.textContent = t("auth.phoneInvalid");
      } else if (!code) {
        errorEl.textContent = t("reg.phoneRequired");
      } else if (!(await verifyCode(phone, code))) {
        errorEl.textContent = t("auth.codeWrong");
      } else {
        const list = await findUsersByPhone(phone);
        if (list.length === 0) {
          errorEl.textContent = t("auth.noAccount");
        } else if (list.length > 1) {
          errorEl.textContent = t("auth.multiAccount");
        } else {
          user = list[0];
        }
      }
    } else {
      // ---------- 学号 / 密码登录 ----------
      const userId = document.getElementById("userId").value.trim();
      const password = document.getElementById("password").value;
      if (!userId || !password) {
        errorEl.textContent = t("login.emptyErr");
      } else {
        const snap = await getDocs(
          query(collection(db, "users"), where("userId", "==", userId))
        );
        snap.forEach((d) => (user = d.data()));
        if (!user || user.password !== password) {
          errorEl.textContent = t("login.wrongErr");
          user = null;
        } else if (user.role !== role) {
          errorEl.textContent = t("login.roleErr", {
            role: t(user.role === "admin" ? "role.admin" : "role.student")
          });
          user = null;
        }
      }
    }

    if (user) {
      setSession({
        userId: user.userId,
        name: user.name,
        phone: normalizePhone(user.phone || ""),
        role: user.role,
        mustChangePassword: !!user.mustChangePassword
      });
      // 首次登录（初始密码）→ 强制先修改密码
      location.href = user.mustChangePassword ? "change-password.html" : "events.html";
      return;
    }
  } catch (err) {
    errorEl.textContent = errMsg(err);
  }

  btn.disabled = false;
  btn.textContent = t("login.submit");
});
