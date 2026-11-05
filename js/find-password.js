// ==========================================================
// js/find-password.js —— 找回密码：学号 + 指纹（WebAuthn）验证
// 流程：输入学号 → 浏览器弹出指纹/面容/PIN 验证 →
//       设备返回的凭证 ID 与账号绑定的凭证一致 → 显示密码
// ==========================================================
import { db, collection, query, where, getDocs, errMsg } from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("fpd.title.tag");

// ---------- WebAuthn 工具函数 ----------
function toB64(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function randChallenge() {
  return crypto.getRandomValues(new Uint8Array(32));
}
// 是否支持：需要 HTTPS（或 localhost）+ 支持 WebAuthn 的浏览器
function supported() {
  return window.isSecureContext && window.PublicKeyCredential;
}

document.getElementById("findForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("findError");
  const okEl = document.getElementById("findSuccess");
  const btn = document.getElementById("findBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  if (!supported()) {
    errEl.textContent = t("fp.unsupported");
    return;
  }

  const userId = document.getElementById("fpUserId").value.trim();
  if (!userId) return;

  btn.disabled = true;
  btn.textContent = t("fpd.verifying");

  try {
    // 1. 查找账号
    const snap = await getDocs(
      query(collection(db, "users"), where("userId", "==", userId))
    );
    let user = null;
    snap.forEach((d) => (user = { id: d.id, ...d.data() }));
    if (!user) {
      errEl.textContent = t("fpd.notFound");
      return;
    }
    if (!user.fingerprintId) {
      errEl.textContent = t("fpd.noFp");
      return;
    }

    // 2. 弹出系统级指纹 / 面容 / PIN 验证（只允许该账号绑定的那枚凭证）
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randChallenge(),
        rpId: location.hostname,
        allowCredentials: [{ id: fromB64(user.fingerprintId), type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });

    // 3. 核对设备返回的凭证与账号绑定的是否为同一枚
    if (toB64(assertion.rawId) !== user.fingerprintId) {
      errEl.textContent = t("fpd.mismatch");
      return;
    }

    okEl.textContent = t("fpd.ok") + user.password;
  } catch (err) {
    // NotAllowedError = 用户取消或超时，其余交给通用提示
    errEl.textContent = err && err.name === "NotAllowedError"
      ? t("fpd.fail") + t("fp.cancelled")
      : errMsg(err);
  }

  btn.disabled = false;
  btn.textContent = t("fpd.verifyBtn");
});
