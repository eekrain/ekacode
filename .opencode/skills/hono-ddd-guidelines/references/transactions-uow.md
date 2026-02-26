# Drizzleのトランザクション/UoW/DI

## 方針

- 1リクエスト1DBコンテキストを基本にする
- applicationはDB実装に依存しない
- 複数リポジトリをまたぐ処理はUoWを明示する
- HonoのミドルウェアでDBコンテキストを注入する

## Honoコンテキストへの注入

- `app.use()` でコンテキストにDBを載せる
- ルートごとに必要ならサブアプリ単位で注入する

## UoW（トランザクション境界）

- applicationで `UnitOfWork` interface を定義する
- infrastructureでDrizzleのトランザクションを使って実装する
- usecaseは `with uow:` または `await uow.run()` の形で境界を明確化する

## 例: UoW interface

```ts
// app/application/uow.ts
export interface UnitOfWork<T> {
  run<R>(fn: (tx: T) => Promise<R>): Promise<R>;
}
```

## 例: Drizzle UoW実装

```ts
// app/infrastructure/uow/drizzle-uow.ts
import type { DrizzleDb } from "../db/types";
import type { UnitOfWork } from "../../application/uow";

export class DrizzleUnitOfWork implements UnitOfWork<DrizzleDb> {
  constructor(private readonly db: DrizzleDb) {}

  run<R>(fn: (tx: DrizzleDb) => Promise<R>): Promise<R> {
    return this.db.transaction(tx => fn(tx));
  }
}
```

## 例: Honoミドルウェアで注入

```ts
// app/infrastructure/di/db.ts
import type { MiddlewareHandler } from "hono";
import { createDb } from "../db/client";

export const withDb: MiddlewareHandler = async (c, next) => {
  c.set("db", createDb());
  await next();
};
```

## 例: usecaseで利用

```ts
// app/application/usecase/change-user-email.ts
import type { UnitOfWork } from "../uow";
import type { UserRepository } from "../port/user-repository";

export class ChangeUserEmail {
  constructor(
    private readonly users: UserRepository,
    private readonly uow: UnitOfWork<unknown>
  ) {}

  async execute(userId: string, email: string): Promise<void> {
    await this.uow.run(async () => {
      const user = await this.users.get(userId);
      if (!user) throw new Error("user_not_found");
      await this.users.save(user.changeEmail(email));
    });
  }
}
```

## 注意

- DB接続の共有はインフラ層で管理し、controllerで生成しない
- contextキーは型安全に扱う（Context型拡張）
- ミドルウェアはHono公式のものを優先し、独自は最小限にする
