// ==========================================================
// js/change-password.js —— 学生首次登录强制修改密码（支持中韩双语）
// 功能：校验原密码 → 更新 users.password，
//       清除 mustChangePassword 标志后进入系统
// ==========================================================
import {
  db, collection, doc, getDocs, updateDoc,
  query, where, requireRole, setSession
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("pwd.title.tag");

const user = requireRole(); // 学生与管理员都可进入（管理员一般无此标志）

// 已登录用户信息提示
document.getElementById("pwdTip").textContent = t("pwd.subUser", {
  name: user.name,
  id: user.userId
});
document.getElementById("reloginTip").textContent = t("pwd.relogin");

document.getElementById("pwdForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("pwdError");
  const btn = document.getElementById("submitBtn");
  errEl.textContent = "";

  const oldPwd = document.getElementById("oldPassword").value;
  const newPwd = document.getElementById("newPassword").value;
  const confirmPwd = document.getElementById("confirmPassword").value;

  // 前端校验
  if (newPwd.length < 6) {
    errEl.textContent = t("pwd.lenErr");
    return;
  }
  if (newPwd !== confirmPwd) {
    errEl.textContent = t("pwd.mismatchErr");
    return;
  }
  if (newPwd === oldPwd) {
    errEl.textContent = t("pwd.sameErr");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("pwd.submitting");
  try {
    // 查询当前用户在 users 集合中的文档
    const snap = await getDocs(
      query(collection(db, "users"), where("userId", "==", user.userId))
    );
    let docId = null, dbUser = null;
    snap.forEach((d) => { docId = d.id; dbUser = d.data(); });

    if (!docId) {
      errEl.textContent = t("pwd.noUser");
    } else if (dbUser.password !== oldPwd) {
      errEl.textContent = t("pwd.oldErr");
    } else {
      // 更新密码并清除“需修改初始密码”标志
      await updateDoc(doc(db, "users", docId), {
        password: newPwd,
        mustChangePassword: false
      });
      setSession({
        userId: user.userId,
        name: user.name,
        role: user.role,
        mustChangePassword: false
      });
      alert(t("pwd.success"));
      location.href = "events.html";
      return;
    }
  } catch (err) {
    errEl.textContent = t("pwd.fail") + err.message;
  }
  btn.disabled = false;
  btn.textContent = t("pwd.submit");
});
