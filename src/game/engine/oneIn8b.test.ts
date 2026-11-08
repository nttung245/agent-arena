import { afterEach, describe, expect, it, vi } from "vitest";
import { LifeEngineError } from "@/game/engine/types";
import {
  LIFE_KEY_STORAGE,
  clearLifeKey,
  createOneIn8bTransport,
  readLifeKey,
  writeLifeKey,
} from "@/game/engine/oneIn8b";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const baseResponse = {
  state: { age: 0, name: "Lan" },
  events: [],
  decision: null,
  token: "tok_1",
  ended: false,
  meta: { engine: "0.9.22", kind: "live" },
  usage: { used: 1, quota: 2000 },
};

afterEach(() => {
  localStorage.clear();
});

describe("createOneIn8bTransport", () => {
  it("starts a Vietnam life with the key in the header only", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => ok(baseResponse),
    );
    const transport = createOneIn8bTransport(
      "k8b_test",
      fetchMock as unknown as typeof fetch,
    );

    const res = await transport.start({
      country: "VNM",
      sex: "female",
      year: 1995,
      sensitive: 0,
      suicide: 0,
    });

    expect(res.state.name).toBe("Lan");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://1in8b.life/api/v1/live");
    expect(init).toMatchObject({ method: "POST" });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer k8b_test",
    });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      country: "VNM",
      sex: "female",
      year: 1995,
      sensitive: 0,
      suicide: 0,
    });
    expect(body.key).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("k8b_test");
  });

  it("sends step choices without losing the token", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => ok(baseResponse),
    );
    const transport = createOneIn8bTransport(
      "k8b_test",
      fetchMock as unknown as typeof fetch,
    );
    await transport.step({ token: "tok_1", choose: "study", focus: "books" });
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]![1] as RequestInit).body),
    );
    expect(body).toEqual({
      token: "tok_1",
      choose: "study",
      focus: "books",
    });
  });

  it("maps a 401 to a key error", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: "bad key", code: "key", status: 401 }),
          { status: 401 },
        ),
    );
    const transport = createOneIn8bTransport(
      "k8b_bad",
      fetchMock as unknown as typeof fetch,
    );
    await expect(transport.start({ country: "VNM" })).rejects.toMatchObject({
      code: "key",
      status: 401,
    });
    await expect(transport.start({ country: "VNM" })).rejects.toBeInstanceOf(
      LifeEngineError,
    );
  });

  it("tolerates a loose state with missing optional fields", async () => {
    const fetchMock = vi.fn(async () =>
      ok({
        state: { age: 0 },
        events: [],
        decision: null,
        token: "tok_1",
        ended: false,
      }),
    );
    const transport = createOneIn8bTransport(
      "k8b_test",
      fetchMock as unknown as typeof fetch,
    );
    const res = await transport.start({ country: "VNM" });
    expect(res.state).toEqual({ age: 0 });
    expect(res.state.name).toBeUndefined();
  });
});

describe("life key storage", () => {
  it("stores, reads, and clears the key under its own localStorage key", () => {
    expect(readLifeKey()).toBeNull();
    writeLifeKey("k8b_test");
    expect(localStorage.getItem(LIFE_KEY_STORAGE)).toBe("k8b_test");
    expect(readLifeKey()).toBe("k8b_test");
    clearLifeKey();
    expect(readLifeKey()).toBeNull();
  });
});
