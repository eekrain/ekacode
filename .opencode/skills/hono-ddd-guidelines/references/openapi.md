# OpenAPI/Zodプラグイン運用

## 方針

- OpenAPIは必ず `hono-openapi` を使用する
- 入出力の型/検証は `zod-openapi` を必須にする
- ルート定義はスキーマ駆動で行い、HTTP境界の責務はcontrollerに集約する
- OpenAPIの登録・ドキュメント公開はHono公式の推奨パターンを使う

## 例: OpenAPI + Zod

```ts
// app/controller/router/users.ts
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import type { ChangeUserEmail } from "../../application/usecase/change-user-email";

const app = new OpenAPIHono();

const changeEmailRoute = createRoute({
  method: "post",
  path: "/users/{id}/email",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": { schema: z.object({ email: z.string().email() }) },
      },
    },
  },
  responses: {
    200: {
      description: "ok",
      content: {
        "application/json": { schema: z.object({ status: z.literal("ok") }) },
      },
    },
  },
});

export const usersRouter = (uc: ChangeUserEmail) =>
  app.openapi(changeEmailRoute, async c => {
    const { id } = c.req.valid("param");
    const { email } = c.req.valid("json");
    await uc.execute(id, email);
    return c.json({ status: "ok" });
  });
```

## 注意

- 直接 `Hono` を使うルートは作らず、OpenAPI対応のHonoを基準にする
- 入出力の検証は `zod-openapi` の `z` を通して定義し、同一スキーマを再利用する
- スキーマはcontroller層に置き、domain/applicationに持ち込まない
