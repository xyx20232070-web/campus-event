// ==========================================================
// js/add-event.js —— 3号负责：管理员活动发布逻辑（支持中韩双语）
// 功能：读取表单内容，新增 events 文档到 Firestore，显示发布结果
// ==========================================================
import {
  db, collection, addDoc, serverTimestamp,
  requireRole, initNav
} from "./firebase.js";
import { t } from "./i18n.js";

document.title = t("add.title.tag");

const user = requireRole("admin"); // 仅管理员可访问
initNav("add");

document.getElementById("eventForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("formError");
  const successEl = document.getElementById("formSuccess");
  const btn = document.getElementById("submitBtn");
  errorEl.textContent = "";
  successEl.textContent = "";

  // 读取表单数据
  const data = {
    name: document.getElementById("name").value.trim(),
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    place: document.getElementById("place").value.trim(),
    maxPeople: parseInt(document.getElementById("maxPeople").value, 10),
    description: document.getElementById("description").value.trim(),
    createdAt: serverTimestamp(),
    createdBy: user ? user.userId : ""
  };

  if (!(data.maxPeople > 0)) {
    errorEl.textContent = t("add.maxErr");
    return;
  }

  btn.disabled = true;
  btn.textContent = t("add.submitting");
  try {
    // 新增一条 events 文档
    await addDoc(collection(db, "events"), data);
    successEl.textContent = t("add.success", { name: data.name });
    e.target.reset();
  } catch (err) {
    errorEl.textContent = t("add.fail") + err.message;
  }
  btn.disabled = false;
  btn.textContent = t("add.submit");
});
