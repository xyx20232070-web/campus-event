// ==========================================================
// js/firebase.js —— Firebase 初始化及数据库连接（小组公共文件）
// 使用方法：
//   1. 在 Firebase 控制台创建项目，开启 Cloud Firestore；
//   2. 把 Web 应用的配置填入下面的 firebaseConfig；
//   3. 所有页面 JS 通过 `import { db, collection ... } from "./firebase.js"` 使用。
// 说明：firebaseConfig 仍为占位符时自动进入“本地演示模式”，
//       数据保存在浏览器 localStorage 中，方便离线开发与课堂演示。
// ==========================================================
import { t, langSwitchHTML, bindLangSwitch } from "./i18n.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbzUJSzbrJ01IIHWeutoF13j6lLsEfHyw",
  authDomain: "campus-management-projec-46a65.firebaseapp.com",
  projectId: "campus-management-projec-46a65",
  storageBucket: "campus-management-projec-46a65.firebasestorage.app",
  messagingSenderId: "764471833615",
  appId: "1:764471833615:web:a8478204f62a64efaf5f7a",
  measurementId: "G-10L7K8VC3Q"
};

export const isDemo =
  !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_");

export let db;
export let collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs;
export let query, where, serverTimestamp;

if (isDemo) {
  // ---------------- 本地演示模式（localStorage 模拟 Firestore） ----------------
  Object.assign(globalThis, {}); // 占位，保持模块结构清晰
  const api = buildMockApi();
  db = api.db;
  collection = api.collection;
  doc = api.doc;
  addDoc = api.addDoc;
  setDoc = api.setDoc;
  updateDoc = api.updateDoc;
  deleteDoc = api.deleteDoc;
  getDoc = api.getDoc;
  getDocs = api.getDocs;
  query = api.query;
  where = api.where;
  serverTimestamp = api.serverTimestamp;
} else {
  // ---------------- 真实 Firebase Cloud Firestore ----------------
  const appMod = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
  );
  const fsMod = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );
  const app = appMod.initializeApp(firebaseConfig);
  db = fsMod.getFirestore(app);
  collection = fsMod.collection;
  doc = fsMod.doc;
  addDoc = fsMod.addDoc;
  setDoc = fsMod.setDoc;
  updateDoc = fsMod.updateDoc;
  deleteDoc = fsMod.deleteDoc;
  getDoc = fsMod.getDoc;
  getDocs = fsMod.getDocs;
  query = fsMod.query;
  where = fsMod.where;
  serverTimestamp = fsMod.serverTimestamp;
}

// ----------------------------------------------------------
// 本地演示模式的模拟 Firestore API（接口与 Firebase SDK 保持一致）
// ----------------------------------------------------------
function buildMockApi() {
  const KEY = "campus_demo_db";
  const now = () => new Date().toISOString();

  function load() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* 数据损坏则重新生成 */ }
    }
    const seed = {
      users: [
        { userId: "A001", password: "admin123", name: "王老师", role: "admin" },
        { userId: "S001", password: "123456", name: "李同学", role: "student" },
        { userId: "S002", password: "123456", name: "张同学", role: "student" }
      ],
      events: [
        { name: "Python 编程入门讲座", date: "2026-10-12", time: "14:00", place: "第一教学楼 301", maxPeople: 50, description: "面向零基础同学的 Python 编程讲座，内容包括环境搭建、基础语法和一个小案例演示。", createdAt: now() },
        { name: "秋季运动会", date: "2026-10-18", time: "08:30", place: "学校田径场", maxPeople: 100, description: "一年一度的校园秋季运动会，包含田赛、径赛及趣味项目，欢迎各年级同学报名参加。" },
        { name: "校园歌手大赛", date: "2026-11-01", time: "19:00", place: "大学生活动中心", maxPeople: 200, description: "展示歌唱才艺的舞台，设一、二、三等奖及最佳人气奖，现场观众可参与投票。" }
      ],
      applications: []
    };
    // 为种子数据生成固定 Document ID
    seed.users.forEach((u) => (u.__id = "u_" + u.userId));
    seed.events.forEach((e, i) => (e.__id = "e" + (i + 1)));
    localStorage.setItem(KEY, JSON.stringify(seed));
    return seed;
  }
  const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
  const rows = (name) => load()[name] || [];
  const refCol = (name) => ({ __mockCol: true, name });
  const refDoc = (name, id) => ({ __mockDoc: true, name, id });

  return {
    db: { __demo: true },
    collection: (_db, name) => refCol(name),
    doc: (...args) => refDoc(args[args.length - 2], args[args.length - 1]),
    query: (col, ...filters) => ({ __mockQuery: true, col, filters }),
    where: (field, op, value) => ({ field, op, value }),
    serverTimestamp: () => now(),

    addDoc: async (col, data) => {
      const d = load();
      const id = "id_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      d[col.name].push({ __id: id, ...data });
      save(d);
      return refDoc(col.name, id);
    },
    setDoc: async (ref, data) => {
      const d = load();
      const i = d[ref.name].findIndex((r) => r.__id === ref.id);
      if (i >= 0) d[ref.name][i] = { ...d[ref.name][i], ...data };
      else d[ref.name].push({ __id: ref.id, ...data });
      save(d);
    },
    updateDoc: async (ref, patch) => {
      const d = load();
      const i = d[ref.name].findIndex((r) => r.__id === ref.id);
      if (i < 0) throw new Error("文档不存在：" + ref.name + "/" + ref.id);
      Object.assign(d[ref.name][i], patch);
      save(d);
    },
    deleteDoc: async (ref) => {
      const d = load();
      d[ref.name] = d[ref.name].filter((r) => r.__id !== ref.id);
      save(d);
    },
    getDoc: async (ref) => {
      const row = rows(ref.name).find((r) => r.__id === ref.id);
      return {
        id: ref.id,
        exists: () => !!row,
        data: () => (row ? { ...row } : undefined)
      };
    },
    getDocs: async (q) => {
      let list = rows(q.col.name).map((r) => ({
        id: r.__id,
        data: () => ({ ...r })
      }));
      for (const f of q.filters) {
        list = list.filter((item) => {
          const v = item.data()[f.field];
          if (f.op === "==") return v === f.value;
          if (f.op === "!=") return v !== f.value;
          return false;
        });
      }
      return {
        empty: list.length === 0,
        size: list.length,
        docs: list,
        forEach: (cb) => list.forEach(cb)
      };
    }
  };
}

// ----------------------------------------------------------
// 登录会话（保存在 localStorage，刷新后仍保持登录状态）
// ----------------------------------------------------------
const SESSION_KEY = "campus_session";

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch (e) { return null; }
}
export function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
export function logout() {
  clearSession();
  location.href = "index.html";
}
// 页面访问控制：未登录跳转登录页，角色不符跳转活动列表；
// 首次登录（仍在使用初始密码）的学生强制跳转修改密码页
export function requireRole(role) {
  const u = getSession();
  if (!u) { location.replace("index.html"); return null; }
  if (role && u.role !== role) {
    alert(t("common.noAccess"));
    location.replace("events.html");
    return null;
  }
  if (u.mustChangePassword && !location.pathname.includes("change-password")) {
    location.replace("change-password.html");
    return null;
  }
  return u;
}

// ----------------------------------------------------------
// 公共导航栏：根据登录角色显示不同菜单（支持中韩双语）
// ----------------------------------------------------------
export function initNav(active) {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const u = getSession();
  if (!u) {
    nav.innerHTML = '<a class="nav-link" href="index.html">' + t("nav.login") + "</a>";
    return;
  }
  const links = [];
  const add = (key, href, text) =>
    links.push(`<a class="nav-link ${key === active ? "active" : ""}" href="${href}">${text}</a>`);
  add("events", "events.html", t("nav.events"));
  if (u.role === "admin") add("add", "add-event.html", t("nav.publish"));
  add("qr", "qr.html", t("nav.qr"));
  if (u.role === "student") add("history", "history.html", t("nav.records"));
  if (u.role === "admin") add("users", "users.html", t("nav.accounts"));
  if (u.role === "student") add("pwd", "change-password.html", t("nav.password"));
  nav.innerHTML =
    links.join("") +
    `<span class="nav-user">${escHtml(u.name)}（${u.role === "admin" ? t("role.admin") : t("role.student")}）</span>` +
    langSwitchHTML() +
    `<button class="btn btn-outline btn-sm" id="btnLogout">${t("action.logout")}</button>`;
  document.getElementById("btnLogout").addEventListener("click", logout);
  bindLangSwitch();
}
function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ----------------------------------------------------------
// 工具函数
// ----------------------------------------------------------
// 生成二维码图片地址（内容为 JSON 字符串，扫码可读取学生/活动信息）
export function qrImageUrl(payload) {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
    encodeURIComponent(payload)
  );
}
// 格式化 Firestore 时间戳或字符串
export function fmtTime(v) {
  if (!v) return "-";
  if (typeof v.toDate === "function") return v.toDate().toLocaleString("zh-CN");
  return String(v).replace("T", " ").slice(0, 19);
}
