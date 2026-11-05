// ==========================================================
// js/register.js —— 学生自助注册
// 功能：学号 / 姓名 / 密码 → 查重 → 写入 users 集合
// ==========================================================
import { db, collection, query, where, getDocs, addDoc } from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("reg.title.tag");

// 提交注册
document.getElementById("regForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("regError");
  const btn = document.getElementById("regBtn");
  errEl.textContent = "";
  document.getElementById("regSuccess").textContent = "";

  const userId = document.getElementById("regId").value.trim();
  const name = document.getElementById("regName").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirm").value;

  // 前端校验
  if (password.length < 6) {
    errEl.textContent = t("reg.pwdLenErr");
    return;
  }
  if (password !== confirm) {
    errEl.textContent = t("reg.pwdMismatch");
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

    // 写入 users 文档（自行注册的学生无需强制改密）
    await addDoc(collection(db, "users"), {
      userId: userId,
      name: name,
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
