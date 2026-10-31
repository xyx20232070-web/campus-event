// ==========================================================
// js/sms.js —— 手机验证码（小组公共文件）
// 说明：
//   课堂演示版本：系统随机生成 6 位验证码并写入 Firestore 的
//   smsCodes 集合，同时在界面上显示出来（相当于“模拟短信”）。
//   如需真实发送短信，把 sendCode 换成调用短信网关或
//   Firebase Authentication 的手机号登录即可，其余代码不用改。
// ==========================================================
import {
  db, collection, doc, query, where, getDocs, addDoc, updateDoc
} from "./firebase.js";

// 去掉空格和连字符
export function normalizePhone(p) {
  return String(p || "").replace(/[\s-]/g, "");
}

// 支持中国大陆手机号(13x~19x)与韩国手机号(010xxxxxxxx)
export function isValidPhone(p) {
  const n = normalizePhone(p);
  return /^(1[3-9]\d{9}|01[016789]\d{7,8})$/.test(n);
}

// 发送验证码：返回验证码本身，便于演示模式直接展示
export async function sendCode(phone) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await addDoc(collection(db, "smsCodes"), {
    phone: normalizePhone(phone),
    code: code,
    used: false,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 分钟有效
    createdAt: new Date().toISOString()
  });
  return code;
}

// 校验验证码：正确且未过期、未使用才算通过，通过后标记为已使用
export async function verifyCode(phone, code) {
  const p = normalizePhone(phone);
  const input = String(code || "").trim();
  const snap = await getDocs(
    query(collection(db, "smsCodes"), where("phone", "==", p))
  );
  let hit = null;
  snap.forEach((d) => {
    const c = d.data();
    if (c.code === input && !c.used && c.expiresAt > Date.now()) {
      if (!hit || c.createdAt > hit.createdAt) hit = { id: d.id, createdAt: c.createdAt };
    }
  });
  if (!hit) return false;
  await updateDoc(doc(db, "smsCodes", hit.id), { used: true });
  return true;
}

// 查询 users 集合中该手机号是否已注册
export async function findUsersByPhone(phone) {
  const snap = await getDocs(
    query(collection(db, "users"), where("phone", "==", normalizePhone(phone)))
  );
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}
