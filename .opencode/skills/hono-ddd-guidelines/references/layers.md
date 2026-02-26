# レイヤー責務と依存方向

## 依存方向（必須）

- controller -> application -> domain
- infrastructure -> domain（実装がapplicationのポートに合わせる場合は application 依存を許可）
- domain は他レイヤーに依存しない
- controller は infrastructure に依存しない（DIを介して結合）

## domain

- entity: 不変条件とビジネスルールを保持する
- service: entity横断のドメインロジック（副作用なし）
- repository: 永続化の抽象（interface）
- gateway: 外部サービスの抽象（interface）
- error: ドメイン例外

**禁止**

- Hono/Drizzleなどインフラ依存
- I/O（DB/外部API/HTTP）

## application

- usecase: ユースケース単位のオーケストレーション
- service: usecase間で共有するアプリケーションロジック
- port: repository/gatewayの抽象（interface）

**責務**

- トランザクション境界の明示（必要時UoW）
- 認可・整合性などの業務フロー制御

**禁止**

- ORMモデルやHTTP概念の直利用

## infrastructure

- repository: domainのrepository実装
- gateway: domainのgateway実装
- di: 依存注入の組み立て
- middleware: 共通インフラ処理
- db: Drizzleのスキーマ/接続/トランザクション

**責務**

- ORM/外部API/キャッシュ等の実体
- 技術的最適化
- Hono公式ミドルウェア/プラグインの適用

## controller

- router: Honoのルーティング
- schemas: 入出力スキーマ
- factory: 依存解決/ユースケース生成
- errors: 例外のHTTP変換

**責務**

- HTTP境界（入力検証/例外変換/レスポンス）
- ミドルウェア組み込み（logger, cors, secure headers などは公式のものを優先）

**禁止**

- 直接DBアクセス
- ドメインルールの実装
