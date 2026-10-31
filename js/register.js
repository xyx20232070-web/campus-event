// ==========================================================
// js/register.js —— 学生自助注册（手机号绑定 + 验证码校验）
// 功能：学号/姓名/手机号/密码 → 验证码校验 → 写入 users 集合
// ==========================================================
import { db, collection, query, where, getDocs, addDoc } from "./firebase.js";
import { t } from "./i18n.js";
import { isValidPhone, normalizePhone, sendCode, verifyCode } from "./sms.js";

document.title = t("reg.title.tag");

let countdown = 0;   // 验证码重发倒计时
let timer = null;

// 显示倒计时，结束后恢复按钮
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
  const errEl = document.getElementById("regError");
  const okEl = document.getElementById("regSuccess");
  const btn = document.getElementById("sendCodeBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  const phone = document.getElementById("regPhone").value.trim();
  if (!isValidPhone(phone)) {
    errEl.textContent = t("auth.phoneInvalid");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("auth.sending");
  try {
    // 手机号查重
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
    alert(t("auth.codeSent", { code: code })); // 演示环境直接显示验证码
    startCountdown();
  } catch (err) {
    errEl.textContent = t("reg.fail") + err.message;
    btn.disabled = false;
    btn.textContent = t("auth.sendCode");
  }
});

// 提交注册
document.getElementById("regForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("regError");
  const okEl = document.getElementById("regSuccess");
  const btn = document.getElementById("regBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  const userId = document.getElementById("regId").value.trim();
  const name = document.getElementById("regName").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const code = document.getElementById("regCode").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirm").value;

  // 前端校验
  if (!isValidPhone(phone)) {
    errEl.textContent = t("auth.phoneInvalid");
    return;
  }
  if (password.length < 6) {
    errEl.textContent = t("reg.pwdLenErr");
    return;
  }
  if (password !== confirm) {
    errEl.textContent = t("reg.pwdMismatch");
    return;
  }
  if (!code) {
    errEl.textContent = t("reg.phoneRequired");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("reg.submitting");
  try {
    // 学号查重
    const idSnap = await getDocs(
      query(collection(db, "users"), where("userId", "==", userId))
    );
    if (!idSnap.empty) {
      errEl.textContent = t("reg.idExists");
      btn.disabled = false;
      btn.textContent = t("reg.submit");
      return;
    }

    // 验证码校验
    const ok = await verifyCode(phone, code);
    if (!ok) {
      errEl.textContent = t("auth.codeWrong");
      btn.disabled = false;
      btn.textContent = t("reg.submit");
      return;
    }

    // 写入 users 文档（自行注册的学生无需强制改密）
    await addDoc(collection(db, "users"), {
      userId: userId,
      name: name,
      phone: normalizePhone(phone),
      password: password,
      role: "student",
      mustChangePassword: false,
      selfRegistered: true,
      createdAt: new Date().toISOString()
    });

    alert(t("reg.success"));
    location.href = "index.html";
  } catch (err) {
    errEl.textContent = t("reg.fail") + err.message;
    btn.disabled = false;
    btn.textContent = t("reg.submit");
  }
});
