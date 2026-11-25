// @vitest-environment jsdom
/**
 * 跨库复制（M4-B）：目标为空才复制、跳过元信息键、游客库不被误删。
 * 用内存版 KeyValueStore 替代 IndexedDB（jsdom 没有 indexedDB）。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  stores: new Map<string, Map<string, string>>(),
}));

vi.mock("@quiz/platform-web", () => ({
  openIndexedDbStore: async (options: { dbName?: string } = {}) => {
    const name = options.dbName ?? "quiz-web";
    const map = state.stores.get(name) ?? new Map<string, string>();
    state.stores.set(name, map);
    return {
      keys: async (): Promise<readonly string[]> => [...map.keys()],
      get: async (key: string): Promise<string | null> => map.get(key) ?? null,
      set: async (key: string, value: string): Promise<void> => {
        map.set(key, value);
      },
    };
  },
}));

import { accountDbName, copyDataBetweenDbs, copyGuestDataIfEmpty } from "./userStorage";

function store(name: string): Map<string, string> {
  const map = state.stores.get(name) ?? new Map<string, string>();
  state.stores.set(name, map);
  return map;
}

beforeEach(() => {
  state.stores.clear();
});

describe("跨库复制", () => {
  it("目标为空时复制全部非元信息键并返回数量", async () => {
    store("quiz-web-user-local_a").set("bank:1", "A");
    store("quiz-web-user-local_a").set("progress:1", "B");
    store("quiz-web-user-local_a").set("__meta__schema", "1");

    const copied = await copyDataBetweenDbs(
      accountDbName("local_a"),
      accountDbName("cloud_1"),
    );

    expect(copied).toBe(2);
    const target = store(accountDbName("cloud_1"));
    expect(target.get("bank:1")).toBe("A");
    expect(target.get("progress:1")).toBe("B");
    expect(target.has("__meta__schema")).toBe(false);
  });

  it("目标已有数据时跳过并返回 0", async () => {
    store(accountDbName("local_a")).set("bank:1", "A");
    store(accountDbName("cloud_1")).set("bank:2", "existing");

    const copied = await copyDataBetweenDbs(
      accountDbName("local_a"),
      accountDbName("cloud_1"),
    );

    expect(copied).toBe(0);
    expect(store(accountDbName("cloud_1")).get("bank:2")).toBe("existing");
    expect(store(accountDbName("cloud_1")).has("bank:1")).toBe(false);
  });

  it("游客库复制到账号库，原游客库保留", async () => {
    store("quiz-web").set("bank:1", "guest");
    store("quiz-web").set("__probe__", "x");

    await copyGuestDataIfEmpty("user_1");

    expect(store(accountDbName("user_1")).get("bank:1")).toBe("guest");
    expect(store(accountDbName("user_1")).has("__probe__")).toBe(false);
    expect(store("quiz-web").get("bank:1")).toBe("guest");
  });
});
