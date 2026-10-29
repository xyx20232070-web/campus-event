// ==========================================================
// js/users.js —— 管理员：学生账号管理（支持中韩双语）
// 功能：手动录入学生账号（设置初始密码）、查看账号列表、
//       重置密码（重置后学生需再次修改密码）
// ==========================================================
import {
  db, collection, doc, getDocs, addDoc, updateDoc,
  query, where, requireRole, initNav
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("users.title.tag");

const user = requireRole("admin"); // 仅管理员可访问
initNav("users");
document.getElementById("userLoading").textContent = t("common.loading");

// 从菜单“注册管理员”进入时（users.html?role=admin）默认选中管理员角色
if (new URLSearchParams(location.search).get("role") === "admin") {
  document.getElementById("newUserRole").value = "admin";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// 读取所有用户
async function getUsers() {
  const snap = await getDocs(collection(db, "users"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  list.sort((a, b) => (a.userId || "").localeCompare(b.userId || ""));
  return list;
}

// ---------------- 录入新学生账号 ----------------
document.getElementById("addUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("addUserError");
  const okEl = document.getElementById("addUserSuccess");
  const btn = document.getElementById("addUserBtn");
  errEl.textContent = "";
  okEl.textContent = "";

  const userId = document.getElementById("newUserId").value.trim();
  const name = document.getElementById("newUserName").value.trim();
  const password = document.getElementById("initPassword").value;
  const role = document.getElementById("newUserRole").value; // student / admin

  if (password.length < 6) {
    errEl.textContent = t("users.pwdLenErr");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("users.submitting");
  try {
    // 学号查重
    const snap = await getDocs(
      query(collection(db, "users"), where("userId", "==", userId))
    );
    if (!snap.empty) {
      errEl.textContent = t("users.exists", { id: userId });
    } else {
      // 新增 users 文档：
      // 学生账号强制首次登录改密；管理员账号无需强制改密
      await addDoc(collection(db, "users"), {
        userId: userId,
        name: name,
        role: role,
        password: password,
        mustChangePassword: role === "student",
        createdBy: user.userId,
        createdAt: new Date().toISOString()
      });
      okEl.textContent = t("users.success", { name: name, id: userId, pwd: password });
      e.target.reset();
      document.getElementById("initPassword").value = "123456";
      loadTable();
    }
  } catch (err) {
    errEl.textContent = t("users.addFail") + err.message;
  }
  btn.disabled = false;
  btn.textContent = t("users.submit");
});

// ---------------- 账号列表 + 重置密码 ----------------
async function loadTable() {
  const users = await getUsers();
  document.getElementById("userLoading").style.display = "none";
  const box = document.getElementById("userTable");

  if (users.length === 0) {
    box.innerHTML = `<div class="empty">${t("users.empty")}</div>`;
    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr><th>${t("col.studentId")}</th><th>${t("col.studentName")}</th><th>${t("users.col.role")}</th><th>${t("users.col.pwdStatus")}</th><th>${t("col.action")}</th></tr>
      </thead>
      <tbody>
        ${users
          .map((u) => {
            const needChange = u.role === "student" && u.mustChangePassword;
            return `
          <tr>
            <td>${esc(u.userId)}</td>
            <td>${esc(u.name)}</td>
            <td><span class="badge ${u.role === "admin" ? "badge-blue" : "badge-gray"}">${u.role === "admin" ? t("role.admin") : t("role.student")}</span></td>
            <td>${
              u.role === "admin"
                ? '<span class="badge badge-gray">—</span>'
                : needChange
                  ? `<span class="badge badge-orange">${t("users.pwdNotChanged")}</span>`
                  : `<span class="badge badge-green">${t("users.pwdChanged")}</span>`
            }</td>
            <td class="actions">
              ${u.role === "student"
                ? `<button class="btn btn-outline btn-sm" data-reset="${u.id}" data-name="${esc(u.name)}" data-uid="${esc(u.userId)}">${t("users.reset")}</button>`
                : ""}
            </td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;

  // 重置密码：设置新的初始密码，学生下次登录需重新修改
  box.querySelectorAll("[data-reset]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid;
      const name = btn.dataset.name;
      const newPwd = prompt(t("users.resetMsg", { name: name, id: uid }));
      if (newPwd === null) return;
      if (newPwd.length < 6) {
        alert(t("users.pwdLenErr"));
        return;
      }
      btn.disabled = true;
      try {
        await updateDoc(doc(db, "users", btn.dataset.reset), {
          password: newPwd,
          mustChangePassword: true
        });
        alert(t("users.resetOk", { name: name }));
        loadTable();
      } catch (err) {
        alert(t("users.resetFail") + err.message);
        btn.disabled = false;
      }
    })
  );
}

loadTable().catch((err) => {
  document.getElementById("userLoading").textContent = t("common.error") + err.message;
});
