// ==========================================================
// js/login.js —— 1号负责：登录页面逻辑（支持中韩双语）
// 功能：学号/管理员账号 + 密码登录，角色选择后跳转对应页面
// ==========================================================
import {
  db, collection, doc, query, where, getDocs, updateDoc,
  isDemo, setSession, isCloudBlocked, errMsg, genSecurityCard
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("login.title.tag");

let role = "student"; // 登录角色选择

// 角色切换
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

// 登录提交
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = t("login.logging");

  try {
    const userId = document.getElementById("userId").value.trim();
    const password = document.getElementById("password").value;
    let user = null;

    if (!userId || !password) {
      errorEl.textContent = t("login.emptyErr");
    } else {
      const snap = await getDocs(
        query(collection(db, "users"), where("userId", "==", userId))
      );
      snap.forEach((d) => (user = { id: d.id, ...d.data() }));
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

    if (user) {
      // 老账号首次登录时自动补发专属安全验证卡（新账号在创建时已生成）
      if (!user.securityCard) {
        try {
          await updateDoc(doc(db, "users", user.id), {
            securityCard: genSecurityCard(),
            securityCardAt: new Date().toISOString()
          });
        } catch (e) { /* 补发失败不阻塞登录 */ }
      }
      setSession({
        userId: user.userId,
        name: user.name,
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
