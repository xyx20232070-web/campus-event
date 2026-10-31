# 智慧校园活动管理系统（基于 QR 二维码）

学生小组 Web 开发项目 · 6 人协作 · 纯 HTML / CSS / JavaScript + Firebase Cloud Firestore · 支持中韩双语切换。

## 中韩双语切换

- 页面右上角提供 `中 / 한` 语言按钮，选择保存在浏览器 localStorage 中，刷新后仍然生效；
- 翻译内容统一放在 `js/i18n.js`（小组公共文件）；
- HTML 中静态文本使用 `data-i18n="key"`（文本）/ `data-i18n-ph="key"`（占位符）标记，JS 中使用 `t("key")` / `t("key", {参数})`。

## 快速开始（本地演示模式）

无需任何配置即可运行：未配置 Firebase 时自动进入**本地演示模式**，数据保存在浏览器 localStorage。

```powershell
cd campus-event
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

> 页面使用 ES Module，需通过 HTTP 服务访问，不能直接双击打开 HTML 文件。

演示账号：
| 角色 | 用户 ID | 密码 |
|------|---------|------|
| 管理员 | A001 | admin123 |
| 学生 | S001 | 123456 |
| 学生 | S002 | 123456 |

## 连接真实 Firebase

1. 在 [Firebase 控制台](https://console.firebase.google.com/) 创建项目，创建 Web 应用并**开启 Cloud Firestore**；
2. 将配置填入 `js/firebase.js` 中的 `firebaseConfig`；
3. 在 Firestore 中创建 `users` / `events` / `applications` 三个集合并添加测试数据；
4. 建议在 Firestore 规则中先行配置（开发期可用测试模式）。

## 数据结构（Cloud Firestore）

- `users`：`userId`、`name`、`role`（student / admin）、`password`、`mustChangePassword`（true = 学生仍在使用初始密码，首次登录强制修改）
- `events`：`name`、`date`、`time`、`place`、`maxPeople`、`description`、`createdAt`
- `applications`：`studentId`、`studentName`、`eventId`、`eventName`、`applyStatus`（已报名/已取消）、`entryStatus`（未入场/已入场）、`applyTime`

## 账号机制

系统提供**两种**账号创建方式：

1. **管理员录入**：管理员在「账号管理」页面手动录入账号（学号、姓名、初始密码、手机号、角色），适用于统一管理；
2. **学生自助注册**：学生在登录页点「立即注册」自行注册，需绑定手机号并通过短信验证码校验（注册后可立即用学号或手机号登录）。

所有账号均绑定手机号，手机号唯一，既用于验证码登录，也便于管理员联系。

登录支持**两种方式**（登录页顶部切换）：
- **学号 / 密码登录**：选择角色后输入账号密码；
- **手机号验证码登录**：输入绑定的手机号 → 获取验证码 → 输入验证码登录（角色由账号自动识别，无需选择）。

> 关于验证码：本项目为课堂演示版本，验证码由系统随机生成后写入 Firestore 的 `smsCodes` 集合，并**直接显示在界面上**（相当于“模拟短信”）。如需真实发送短信，只需把 `js/sms.js` 中的 `sendCode` 换成调用短信网关或 Firebase Authentication 的手机号登录，其余代码无需改动。

## 分工与文件

| 负责人 | 页面 | 逻辑文件 |
|--------|------|----------|
| 1号 登录 | `index.html` | `js/login.js` |
| 2号 活动列表 | `events.html` | `js/events.js` |
| 3号 活动发布 | `add-event.html` | `js/add-event.js` |
| 4号 详情/报名 | `detail.html` | `js/detail.js` |
| 5号 QR入场 | `qr.html` | `js/qr.js` |
| 6号 参加记录 | `history.html` | `js/history.js` |
| 公共 | — | `css/style.css`、`js/firebase.js` |
| 扩展 | `change-password.html` | `js/change-password.js`（首次登录改密） |
| 扩展 | `users.html` | `js/users.js`（管理员账号管理） |

## 发布（GitHub Pages）

推送代码到 GitHub 后，在仓库 Settings → Pages 选择 `main` 分支即可发布静态网站。
