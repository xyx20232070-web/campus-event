// ==========================================================
// js/login.js —— 1号负责：登录页面逻辑（支持中韩双语）
// 功能：角色选择、ID/密码输入、登录检查（users 集合）、角色页面跳转
// ==========================================================
import { db, collection, query, where, getDocs, isDemo, setSession } from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("login.title.tag");

let role = "student"; // 默认学生角色

// 角色切换按钮
document.getElementById("roleSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest(".role-btn");
  if (!btn) return;
  document.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  role = btn.dataset.role;
});

// 演示模式提示
if (isDemo) {
  document.getElementById("loginTip").innerHTML = t("login.demoTip");
}

// 登录提交
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const userId = document.getElementById("userId").value.trim();
  const password = document.getElementById("password").value;
  const errorEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  errorEl.textContent = "";

  if (!userId || !password) {
    errorEl.textContent = t("login.emptyErr");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("login.logging");

  try {
    // 在 users 集合中查询该用户
    const snap = await getDocs(
      query(collection(db, "users"), where("userId", "==", userId))
    );
    let user = null;
    snap.forEach((d) => (user = d.data()));

    if (!user || user.password !== password) {
      errorEl.textContent = t("login.wrongErr");
    } else if (user.role !== role) {
      errorEl.textContent = t("login.roleErr", {
        role: t(user.role === "admin" ? "role.admin" : "role.student")
      });
    } else {
      setSession({
        userId: user.userId,
        name: user.name,
        role: user.role,
        mustChangePassword: !!user.mustChangePassword // 是否仍在使用初始密码
      });
      // 首次登录（初始密码）→ 强制先修改密码
      location.href = user.mustChangePassword ? "change-password.html" : "events.html";
      return;
    }
  } catch (err) {
    errorEl.textContent = t("login.fail") + err.message;
  }

  btn.disabled = false;
  btn.textContent = t("login.submit");
});
