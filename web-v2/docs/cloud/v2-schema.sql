-- =============================================================================
-- S6 · T6-1 — V2 云表结构（五表）
-- =============================================================================
-- 目标库：本项目应用（wbapp_g64vX7uZdYwdm0BJTVINDk）的 WorkBuddy Cloud（PostgreSQL）。
-- 旧版四表（wrong_questions / quiz_mastery / exam_records / drill_progress）在**另一个**
-- 云端（wbapp-x4curlcgbt2kilpzdqg6lh），本脚本**完全不触碰**它们，只建全新 V2 表。
--
-- 执行方式（见 cloud-service database/management.md）：
--   * 逐条语句、每条一次 workbuddy_cloudservice_db_exec_sql、mode = "migrate"（管理员角色）
--   * 本文件不含 RLS 策略：RLS 是 T6-2（用户隔离 + 显式拒绝 anon）
--   * 本文件把 GRANT 限定到 authenticated（G6-1「匿名不可读写」）：
--     不给 anon 授权 = 匿名拿不到表（配合 T6-2 的 RLS 双保险）
--
-- 三条设计红线：
--   1. owner_id TEXT DEFAULT auth.uid() —— 归属由服务端定，客户端不传（伪造归属被挡）。
--   2. 幂等键 —— 重复写入同一键不产生新行（迁移/同步可重放）。
--   3. 不存题干/代码正文 —— 只存题目 ID + 作答结果（规避旧版网关拦代码正文，S6 §3）。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) attempts —— 答题事件（对应 core: Attempt，只追加 + 幂等）
-- -----------------------------------------------------------------------------
CREATE TABLE attempts (
  attempt_id        TEXT        PRIMARY KEY,            -- 幂等键（Attempt.attemptId）
  owner_id          TEXT        NOT NULL DEFAULT auth.uid(),
  bank_id           TEXT        NOT NULL,
  question_id       TEXT        NOT NULL,
  question_revision TEXT        NOT NULL,
  mode              TEXT        NOT NULL,
  is_first_attempt  BOOLEAN     NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL,
  submitted_at      TIMESTAMPTZ NOT NULL,
  answer            JSONB,                              -- 用户作答（非题干）
  correct           BOOLEAN,                            -- 主观题/未判为 NULL
  score             NUMERIC     NOT NULL,
  max_score         NUMERIC     NOT NULL,
  session_id        TEXT,
  duration_ms       BIGINT,                             -- 缺省表示未记录（不拿 0 冒充）
  imported_from     TEXT,                               -- 迁移来源标记（如 exam_records:17）
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attempts_mode_ck CHECK (mode IN ('practice','exam','review')),
  CONSTRAINT attempts_score_ck CHECK (score >= 0 AND max_score > 0)
);

COMMENT ON TABLE attempts IS '答题事件（不可变、幂等）；不存题干/代码正文，只存 ID 与作答结果';

CREATE INDEX attempts_owner_bank_time_idx ON attempts (owner_id, bank_id, submitted_at);
CREATE INDEX attempts_owner_question_idx  ON attempts (owner_id, question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE attempts TO authenticated;


-- -----------------------------------------------------------------------------
-- 2) question_progress —— 学习进度（对应 core: QuestionProgress，派生可覆盖）
-- -----------------------------------------------------------------------------
CREATE TABLE question_progress (
  owner_id         TEXT        NOT NULL DEFAULT auth.uid(),
  bank_id          TEXT        NOT NULL,
  question_id      TEXT        NOT NULL,
  attempts_count   INTEGER     NOT NULL DEFAULT 0,
  wrong_count      INTEGER     NOT NULL DEFAULT 0,
  first_correct_at TIMESTAMPTZ,
  last_attempt_at  TIMESTAMPTZ,
  mastered         BOOLEAN     NOT NULL DEFAULT false,
  status           TEXT        NOT NULL DEFAULT 'new',
  streak           INTEGER     NOT NULL DEFAULT 0,
  next_review_at   TIMESTAMPTZ,
  error_cause      TEXT,
  note             TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 记账列（非 core 字段）
  PRIMARY KEY (owner_id, bank_id, question_id),
  CONSTRAINT qp_status_ck    CHECK (status IN ('new','learning','reviewing','mastered')),
  CONSTRAINT qp_nonneg_ck    CHECK (attempts_count >= 0 AND wrong_count >= 0 AND streak >= 0)
);

COMMENT ON TABLE question_progress IS '学习进度（派生数据，可由 attempts 重算）；一人一题一份';

CREATE INDEX question_progress_owner_bank_idx ON question_progress (owner_id, bank_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE question_progress TO authenticated;


-- -----------------------------------------------------------------------------
-- 3) practice_sessions —— 续刷会话（对应 core: PracticeSession，一人一题库一份）
-- -----------------------------------------------------------------------------
CREATE TABLE practice_sessions (
  owner_id     TEXT        NOT NULL DEFAULT auth.uid(),
  bank_id      TEXT        NOT NULL,
  session_id   TEXT        NOT NULL,
  mode         TEXT        NOT NULL,
  question_ids JSONB       NOT NULL,
  cursor       INTEGER     NOT NULL DEFAULT 0,
  results      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  started_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  finished_at  TIMESTAMPTZ,
  PRIMARY KEY (owner_id, bank_id),                      -- 一人一题库一份（S3 口径）
  CONSTRAINT ps_mode_ck   CHECK (mode IN ('practice','review')),
  CONSTRAINT ps_cursor_ck CHECK (cursor >= 0)
);

COMMENT ON TABLE practice_sessions IS '续刷/复习会话；一人一题库一份，upsert 于 (owner_id,bank_id)';

CREATE INDEX practice_sessions_owner_idx ON practice_sessions (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE practice_sessions TO authenticated;


-- -----------------------------------------------------------------------------
-- 4) exam_records_v2 —— 模考成绩（对应 core: ExamRecord，只增不改，自评单字段可改）
-- -----------------------------------------------------------------------------
CREATE TABLE exam_records_v2 (
  record_id      TEXT        PRIMARY KEY,               -- 幂等键（ExamRecord.recordId）
  owner_id       TEXT        NOT NULL DEFAULT auth.uid(),
  bank_id        TEXT        NOT NULL,
  template_id    TEXT        NOT NULL,
  session_id     TEXT        NOT NULL,
  seed           INTEGER     NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL,
  submitted_at   TIMESTAMPTZ NOT NULL,
  duration_sec   INTEGER     NOT NULL DEFAULT 0,
  timed_out      BOOLEAN     NOT NULL DEFAULT false,
  objective_score NUMERIC    NOT NULL DEFAULT 0,
  objective_max  NUMERIC     NOT NULL DEFAULT 0,
  self_score     NUMERIC     NOT NULL DEFAULT 0,
  self_max       NUMERIC     NOT NULL DEFAULT 0,
  total_score    NUMERIC     NOT NULL DEFAULT 0,
  total_max      NUMERIC     NOT NULL,
  items          JSONB       NOT NULL,                  -- 逐题明细（含 selfRating，自评可改）
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT er_seed_ck  CHECK (seed >= 0),
  CONSTRAINT er_score_ck CHECK (
    objective_score >= 0 AND objective_max >= 0 AND self_score >= 0
    AND self_max >= 0 AND total_score >= 0 AND total_max > 0
  )
);

COMMENT ON TABLE exam_records_v2 IS '模考成绩（只增不改）；仅 selfRating 可改，其余字段无 UPDATE 路径';

CREATE INDEX exam_records_v2_owner_bank_time_idx ON exam_records_v2 (owner_id, bank_id, submitted_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE exam_records_v2 TO authenticated;


-- -----------------------------------------------------------------------------
-- 5) user_preferences —— 用户偏好（对应 core: AppSettings + FavoriteEntry[]）
-- -----------------------------------------------------------------------------
-- favorites 是 S3 引入的「收藏」（独立于错题/进度，见 core 注释）：方案限定五表，
-- 故整块 JSONB 收进 user_preferences，与 progress 分列存储，绝不因进度重算被带走。
CREATE TABLE user_preferences (
  owner_id      TEXT        NOT NULL DEFAULT auth.uid(),
  active_bank_id TEXT,
  practice      JSONB       NOT NULL DEFAULT '{}'::jsonb,   -- bankId -> PracticeSettings
  favorites     JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- FavoriteEntry[]（收藏）
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id)
);

COMMENT ON TABLE user_preferences IS '用户偏好（AppSettings）+ 收藏（FavoriteEntry[]）；一人一行 upsert';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_preferences TO authenticated;

-- =============================================================================
-- 说明：
--  * 五表与 core 字段对齐的证据见 packages/data/src/cloud/schema-map.test.ts（10 断言全绿）。
--  * 旧版四表不在本脚本范围内，保持只读备份（迁移见 T6-5/T6-6 runbook）。
--  * RLS 策略见下方「T6-2」段落（已部署）。
-- =============================================================================


-- =============================================================================
-- T6-2 · RLS 策略（已部署 2026-11-18）
-- =============================================================================
-- 五表 ENABLE ROW LEVEL SECURITY，并逐表建立 4 条策略（SELECT/INSERT/UPDATE/DELETE），
-- 条件统一为 owner_id = auth.uid()，角色限定 authenticated。
--
-- ⚠ 冲突与修正（必须记）：WorkBuddy 云对新表**默认 UN 授 SELECT 给 anon**（默认权限）。
--   方案 G6-1 要求"匿名显式拒绝、不是默认就查不到"，而 anon 有 SELECT 时只会被 RLS 过滤成空
--   —— 正是方案不接受的形态。故对五表执行 `REVOKE ALL ... FROM anon`，让匿名访问直接 42501。
--
-- 部署方式：单条 DO $$ ... $$ 块（原子执行）。每表四条策略骨架（以 attempts 为例）：
--   ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS attempts_select_own ON attempts;
--   CREATE POLICY attempts_select_own ON attempts FOR SELECT TO authenticated USING (owner_id = auth.uid());
--   DROP POLICY IF EXISTS attempts_insert_own ON attempts;
--   CREATE POLICY attempts_insert_own ON attempts FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
--   DROP POLICY IF EXISTS attempts_update_own ON attempts;
--   CREATE POLICY attempts_update_own ON attempts FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
--   DROP POLICY IF EXISTS attempts_delete_own ON attempts;
--   CREATE POLICY attempts_delete_own ON attempts FOR DELETE TO authenticated USING (owner_id = auth.uid());
-- 其余四表（question_progress / practice_sessions / exam_records_v2 / user_preferences）同名替换。
--
-- 匿名撤销（对抗云默认授权）：
--   REVOKE ALL ON TABLE attempts FROM anon;  -- 其余四表同理
--
-- 验证证据（2026-11-18 实测）：
--   * list_tables → 五表 RLSOn=true
--   * pg_policies → 20 条策略，roles={authenticated}
--   * information_schema.role_table_grants → anon 对五表**零权限**
--   * 模拟 A/B（SET LOCAL ROLE authenticated + request.jwt.claim.sub + auth.uid()）：
--     A 仅见自己 1 条、B 仅见自己 1 条、库内共 2 条 → 用户隔离成立
-- =============================================================================
