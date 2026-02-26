# テストガイドライン

## 方針

- Honoの公式ガイドに沿って `app.request()` を使ったリクエスト/レスポンス検証を基本にする
- ランタイム別の推奨ツールに従う（例: Cloudflare Workers は Vitest 推奨）
- ルーティングはE2Eに近い形で検証し、usecaseはユニットで検証する
- `c.env` を使うハンドラは `app.request` の第3引数でモックする

## 例: GET

```ts
import { describe, expect, test } from "vitest";
import { createApp } from "../../app/controller/router";

describe("posts", () => {
  test("GET /posts", async () => {
    const app = createApp();
    const res = await app.request("/posts");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Many posts");
  });
});
```

## 例: POST (JSON)

```ts
import { describe, expect, test } from "vitest";
import { createApp } from "../../app/controller/router";

test("POST /posts", async () => {
  const app = createApp();
  const res = await app.request("/posts", {
    method: "POST",
    body: JSON.stringify({ message: "hello hono" }),
    headers: new Headers({ "Content-Type": "application/json" }),
  });
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ message: "Created" });
});
```

## 例: envのモック

```ts
import { describe, expect, test } from "vitest";
import { createApp } from "../../app/controller/router";

const MOCK_ENV = {
  API_HOST: "example.com",
};

test("GET /posts with env", async () => {
  const app = createApp();
  const res = await app.request("/posts", {}, MOCK_ENV);
  expect(res.status).toBe(200);
});
```
