# 账号密码登录 · 后端交接文档

- 版本：v1（2026-11-20）
- 前端：`apps/web/src/account/remoteAuth.ts`（已接入，默认登录入口）
- 目标：账号密码存云数据库，登录时检索；密码只存 bcrypt 摘要

---

## 1. 现在的行为

- 账号卡片默认展示「账号密码」：注册 / 登录 / 退出。
- 账号密码通过云数据库的两个函数完成：`quiz_register`、`quiz_login`。
- 登录成功后前端只在 `localStorage` 保存会话（30 天），不保存密码、不保存摘要。
- 手机验证码 / 微信入口保留；账号密码登录与应用云登录互不影响。
- 学习数据仍按 `userId` 隔离在本机 IndexedDB；账号密码登录**不做跨端数据同步**。

> 也就是说：这次解决的是「账号存在服务器、任何设备都能登录」；学习记录的跨设备同步仍要使用手机验证码 / 微信登录后的云同步。

如果数据库函数还没建，前端会提示「账号服务尚未部署，请按交接文档执行数据库初始化 SQL」。

---

## 2. 前端调用契约

```ts
// 注册
await client.database.rpc("quiz_register", {
  p_username: "alice",
  p_password: "至少 8 位",
});
// → { userId: "uuid", username: "alice" }

// 登录
await client.database.rpc("quiz_login", {
  p_username: "alice",
  p_password: "…",
});
// → { userId: "uuid", username: "alice" }
```

约定：

- 成功返回单个 JSON 对象（或单行数组），字段 `userId`、`username`。
- 失败用 `RAISE EXCEPTION '<错误码>'`，前端按错误码映射中文：
  - `INVALID_CREDENTIALS` → 账号或密码不正确
  - `USERNAME_TAKEN` → 该账号已存在，请直接登录
  - `USERNAME_INVALID` → 账号格式错误
  - `PASSWORD_TOO_SHORT` → 密码至少 8 位
- 账号大小写不敏感（用 `username_key = lower(username)` 唯一约束）。

---

## 3. 数据库初始化 SQL

在应用云数据库（PostgREST 所连的 Postgres）里执行：

```sql
create extension if not exists pgcrypto;

create table if not exists public.quiz_accounts (
  user_id       uuid primary key default gen_random_uuid(),
  username      text not null,
  username_key  text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- 表不允许客户端直接读写：只能通过下面的函数
alter table public.quiz_accounts enable row level security;
revoke all on public.quiz_accounts from anon, authenticated;

create or replace function public.quiz_register(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := btrim(p_username);
  v_key  text := lower(btrim(p_username));
  v_id   uuid;
begin
  if length(v_name) < 2 or length(v_name) > 20 then
    raise exception 'USERNAME_INVALID';
  end if;
  if length(p_password) < 8 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;
  if exists (select 1 from public.quiz_accounts where username_key = v_key) then
    raise exception 'USERNAME_TAKEN';
  end if;

  insert into public.quiz_accounts (username, username_key, password_hash)
  values (v_name, v_key, crypt(p_password, gen_salt('bf', 12)))
  returning user_id into v_id;

  return jsonb_build_object('userId', v_id::text, 'username', v_name);
end;
$$;

create or replace function public.quiz_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := lower(btrim(p_username));
  v_row public.quiz_accounts%rowtype;
begin
  select * into v_row from public.quiz_accounts where username_key = v_key;
  if not found or v_row.password_hash <> crypt(p_password, v_row.password_hash) then
    raise exception 'INVALID_CREDENTIALS';
  end if;
  return jsonb_build_object('userId', v_row.user_id::text, 'username', v_row.username);
end;
$$;

grant execute on function public.quiz_register(text, text) to anon, authenticated;
grant execute on function public.quiz_login(text, text) to anon, authenticated;
```

注意：

- 函数必须是 `security definer`，否则匿名角色没有表权限。
- `search_path = public, extensions` 是为了让 `crypt` / `gen_salt` 能从 `extensions` schema 找到（不同环境 pgcrypto 安装位置不同，可按实际调整）。
- 不要给 `quiz_accounts` 建 SELECT 策略：客户端只能调函数，拿不到密码摘要。

---

## 4. 部署步骤

1. 在应用云数据库执行第 3 节 SQL。
2. 验证函数存在：
   ```sql
   select proname from pg_proc where proname in ('quiz_register', 'quiz_login');
   ```
3. 发布前端到应用云正式域（`CLOUD_PUBLIC_CONFIG.endpoint` 对应域名）。
4. 打开「我的 → 账号与登录」，用账号密码注册一次，再用同一账号在另一台设备登录，确认拿到同一 `userId`（可在 DevTools 看 IndexedDB 的库名 `quiz-web-user-<userId>`）。
5. 如果需要 Trae 等其它域名也能用：把域名加入应用云 Origin 白名单，并设置构建变量
   `VITE_CLOUD_ALLOWED_ORIGINS=https://你的域名`（多个用逗号分隔，不要用通配符）。

### 如果你的 WorkBuddy 环境不能执行 SQL

前端只依赖第 2 节的契约。可以改用任意后端实现同名接口，然后把
`apps/web/src/account/remoteAuth.ts` 的 `callRpc` 换成 `fetch`：

```
POST {BASE}/auth/register  { username, password } → { userId, username }
POST {BASE}/auth/login     { username, password } → { userId, username }
```

错误码仍按第 2 节返回，前端错误映射不用改。

---

## 5. 安全与边界

- 密码使用 bcrypt（cost 12）存摘要，不存明文；前端也从不保存密码。
- 会话只存在当前浏览器 `localStorage`（键 `quiz.remote.session.v1`），30 天过期。
  它不是服务端 token，不能用于调用受保护接口；只用于本地判定登录态与账号库隔离。
- 账号密码登录后，学习数据仍然按账号存在本机 IndexedDB；换设备能登录，但学习记录不会自动同步。
- 未实现找回密码 / 修改密码；需要时优先用「验证码登录」。
- 退出登录会同时清空账号密码会话与应用云会话，避免另一套会话把用户"登"回去。

---

## 6. 自测清单

- [ ] 注册：新账号返回 `userId`，重复账号提示「该账号已存在」
- [ ] 登录：正确密码成功；错误密码与不存在账号都提示「账号或密码不正确」
- [ ] 密码 < 8 位注册被拒
- [ ] 两台设备用同一账号登录，`userId` 一致
- [ ] 退出登录后刷新页面仍是未登录
- [ ] 手机验证码 / 微信登录仍可用，互不覆盖
- [ ] 账号密码登录时，账号卡片不显示「立即同步」（没有云会话）

---

## 7. 回滚

- 前端：把账号卡片默认入口切回本机账号，或删除 `remoteAuth.ts` 的调用；
  云函数与表保留不影响其它功能。
- 数据库：`drop function quiz_register(text, text); drop function quiz_login(text, text);`
  再按需删除 `quiz_accounts` 表（会丢失全部账号）。
