// ==========================================================
// js/users.js —— 管理员：学生账号管理（支持中韩双语）
// 功能：手动录入学生账号（设置初始密码）、查看账号列表、
//       重置密码（重置后学生需再次修改密码）
// ==========================================================
import {
  db, collection, doc, getDocs, addDoc, updateDoc,
  query, where, requireRole, initNav, errMsg
} from "./firebase.js";
import { t } from "./i18n.js";
import { isValidPhone, normalizePhone } from "./sms.js";

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

let allUsers = []; // 缓存已加载的账号，供导出与批量重置使用

// ---------------- 导出账号列表（CSV） ----------------
document.getElementById("exportBtn").addEventListener("click", () => {
  if (allUsers.length === 0) {
    alert(t("users.empty"));
    return;
  }
  const header = [
    t("col.studentId"), t("col.studentName"), t("users.phone"),
    t("users.col.role"), t("login.password"), t("users.col.pwdStatus")
  ];
  const rows = allUsers.map((u) => [
    u.userId, u.name, u.phone || "-",
    u.role === "admin" ? t("role.admin") : t("role.student"),
    u.password,
    u.role === "admin" ? "-" : (u.mustChangePassword ? t("users.pwdNotChanged") : t("users.pwdChanged"))
  ]);
  // CSV 转义：含逗号/引号时用引号包裹并转义内部引号
  const escCsv = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [header, ...rows].map((r) => r.map(escCsv).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "accounts_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  alert(t("users.exportDone"));
});

// ---------------- 全部重置为初始密码 ----------------
document.getElementById("resetAllBtn").addEventListener("click", async () => {
  if (allUsers.length === 0) {
    alert(t("users.empty"));
    return;
  }
  const btn = document.getElementById("resetAllBtn");
  const pwd = prompt(t("users.resetAllMsg"), "123456");
  if (pwd === null) return;
  if (String(pwd).length < 6) {
    alert(t("users.pwdLenErr"));
    return;
  }
  if (!confirm(t("users.resetAllConfirm", { n: allUsers.length, pwd: pwd }))) return;

  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = t("action.processing");
  let ok = 0;
  try {
    for (const u of allUsers) {
      await updateDoc(doc(db, "users", u.id), {
        password: pwd,
        mustChangePassword: u.role === "student"
      });
      ok += 1;
    }
    alert(t("users.resetAllOk", { n: ok, pwd: pwd }));
    loadTable();
  } catch (err) {
    alert(t("users.resetFail") + err.message);
  }
  btn.disabled = false;
  btn.textContent = oldText;
});

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
  const phone = document.getElementById("newUserPhone").value.trim();

  if (password.length < 6) {
    errEl.textContent = t("users.pwdLenErr");
    return;
  }
  if (!isValidPhone(phone)) {
    errEl.textContent = t("auth.phoneInvalid");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("users.submitting");
  try {
    // 学号查重
    const snap = await getDocs(
      query(collection(db, "users"), where("userId", "==", userId))
    );
    // 手机号查重（手机号必须唯一，用于验证码登录）
    const phoneSnap = await getDocs(
      query(collection(db, "users"), where("phone", "==", normalizePhone(phone)))
    );
    if (!snap.empty) {
      errEl.textContent = t("users.exists", { id: userId });
    } else if (!phoneSnap.empty) {
      errEl.textContent = t("reg.phoneExists");
    } else {
      // 新增 users 文档：
      // 学生账号强制首次登录改密；管理员账号无需强制改密
      await addDoc(collection(db, "users"), {
        userId: userId,
        name: name,
        role: role,
        password: password,
        phone: normalizePhone(phone), // 绑定手机号
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
  allUsers = users; // 缓存，供导出与批量重置使用
  document.getElementById("userLoading").style.display = "none";
  const box = document.getElementById("userTable");

  if (users.length === 0) {
    box.innerHTML = `<div class="empty">${t("users.empty")}</div>`;
    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr><th>${t("col.studentId")}</th><th>${t("col.studentName")}</th><th>${t("users.phone")}</th><th>${t("users.col.role")}</th><th>${t("users.col.pwdStatus")}</th><th>${t("col.action")}</th></tr>
      </thead>
      <tbody>
        ${users
          .map((u) => {
            const needChange = u.role === "student" && u.mustChangePassword;
            return `
          <tr>
            <td>${esc(u.userId)}</td>
            <td>${esc(u.name)}</td>
            <td>${esc(u.phone || "-")}</td>
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
  document.getElementById("userLoading").textContent = errMsg(err);
});
