// ==========================================================
// js/fingerprint.js —— 指纹绑定：为当前登录账号录入专属指纹
// 使用浏览器 WebAuthn 平台认证器（指纹 / 面容 / 锁屏 PIN），
// 凭证 ID 保存在本人 users 文档中，每个账号仅绑定一枚。
// ==========================================================
import {
  db, collection, query, where, getDocs, updateDoc, doc,
  requireRole, initNav, errMsg, fmtTime
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("fp.title.tag");

const me = requireRole(); // 学生与管理员均可绑定自己的指纹
initNav("fingerprint");

let myDocId = null;
let boundAt = null;

// ---------- WebAuthn 工具函数 ----------
function toB64(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function supported() {
  return window.isSecureContext && window.PublicKeyCredential;
}

// ---------- 载入绑定状态 ----------
async function loadStatus() {
  const snap = await getDocs(
    query(collection(db, "users"), where("userId", "==", me.userId))
  );
  myDocId = null;
  boundAt = null;
  snap.forEach((d) => {
    myDocId = d.id;
    boundAt = d.data().fingerprintAt || null;
  });

  const statusEl = document.getElementById("fpStatus");
  const btn = document.getElementById("enrollBtn");
  if (!myDocId) {
    statusEl.textContent = t("fp.notFound");
    btn.disabled = true;
    return;
  }
  if (boundAt) {
    statusEl.innerHTML = `<span class="badge badge-blue">${t("fp.statusBound")}</span> ${t("fp.boundAt", { time: fmtTime(boundAt) })}`;
    btn.textContent = t("fp.reenroll");
  } else {
    statusEl.innerHTML = `<span class="badge badge-gray">${t("fp.statusNone")}</span>`;
    btn.textContent = t("fp.enroll");
  }
}

// ---------- 录入指纹 ----------
document.getElementById("enrollBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("fpError");
  const okEl = document.getElementById("fpSuccess");
  const btn = document.getElementById("enrollBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  if (!supported()) {
    errEl.textContent = t("fp.unsupported");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("fp.enrolling");
  try {
    // 创建平台凭证：绑定 当前域名 + 当前账号，需指纹/面容/PIN 验证
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { id: location.hostname, name: "Campus Event" },
        user: {
          id: new TextEncoder().encode(me.userId),
          name: me.userId,
          displayName: me.name || me.userId
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // 只用本机生物识别
          userVerification: "required",
          residentKey: "discouraged"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    // 覆盖保存：每个账号只保留最新一枚专属指纹
    await updateDoc(doc(db, "users", myDocId), {
      fingerprintId: toB64(cred.rawId),
      fingerprintAt: new Date().toISOString()
    });

    okEl.textContent = t("fp.enrollOk");
    await loadStatus();
    return;
  } catch (err) {
    errEl.textContent =
      err && err.name === "NotAllowedError"
        ? t("fp.enrollFail") + t("fp.cancelled")
        : errMsg(err);
  }
  btn.disabled = false;
  btn.textContent = t("fp.enroll");
});

loadStatus().catch((err) => {
  document.getElementById("fpStatus").textContent = errMsg(err);
});
