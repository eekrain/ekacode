# ディレクトリ構成と実装テンプレ

## 例: ディレクトリ構成

```
app/
  domain/
    entity/
    repository/
    gateway/
    error/
    service/
  application/
    usecase/
    service/
    port/
    uow/
  infrastructure/
    repository/
    gateway/
    di/
    middleware/
    db/
    uow/
  controller/
    router/
    schemas/
    factory/
    errors/
```

## 例: domain entity

```ts
// app/domain/entity/user.ts
export class User {
  constructor(
    readonly id: string,
    readonly email: string
  ) {}

  changeEmail(newEmail: string): User {
    return new User(this.id, newEmail);
  }
}
```

## 例: repository interface

```ts
// app/domain/repository/user-repository.ts
import type { User } from "../entity/user";

export interface UserRepository {
  get(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

## 例: application usecase

```ts
// app/application/usecase/change-user-email.ts
import type { UserRepository } from "../port/user-repository";

export class ChangeUserEmail {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string, email: string): Promise<void> {
    const user = await this.users.get(userId);
    if (!user) throw new Error("user_not_found");
    await this.users.save(user.changeEmail(email));
  }
}
```

## 例: controller router (OpenAPI + Zod)

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

## 例: Hono公式ミドルウェアの適用

```ts
// app/controller/router/index.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { usersRouter } from "./users";
import { buildUsecases } from "../factory/usecases";

export const createApp = () => {
  const app = new OpenAPIHono();
  app.use("*", logger());
  app.use("*", secureHeaders());
  app.use("*", cors());

  const { changeUserEmail } = buildUsecases();
  app.route("/", usersRouter(changeUserEmail));

  return app;
};
```

## 例: infrastructure repository (Drizzle)

```ts
// app/infrastructure/repository/user-repository.ts
import type { UserRepository } from "../../domain/repository/user-repository";
import type { User } from "../../domain/entity/user";
import type { DrizzleDb } from "../db/types";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DrizzleDb) {}

  async get(id: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!row) return null;
    return new User(row.id, row.email);
  }

  async save(user: User): Promise<void> {
    await this.db.insert(users).values({ id: user.id, email: user.email });
  }
}
```
