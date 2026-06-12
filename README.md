# 社食管理システム

社員食堂の在庫・納品・販売数を管理するウェブアプリ。

**技術スタック**: Next.js 14 (App Router) + Supabase (PostgreSQL) + Vercel（無料枠で完結）

## セットアップ手順

### 1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQL Editor で `supabase/migrations/001_initial.sql` を実行

### 2. 環境変数設定

```bash
cp .env.local.example .env.local
# .env.local を編集して各値を設定
```

`AUTH_TOKEN_VALUE` はランダム文字列を生成して設定:
```bash
openssl rand -hex 32
```

### 3. ローカル起動

```bash
npm install
npm run dev
```

### 4. Vercel デプロイ

1. GitHub にプッシュ
2. [vercel.com](https://vercel.com) でリポジトリをインポート
3. Vercel の Environment Variables に `.env.local` の内容を全て設定

## 主な機能

| ページ | 機能 |
|--------|------|
| `/` (日次チェック) | 日付選択・監視カメラ確認日時・商品ごとの納品数/前日在庫/販売数/実在庫入力・差異の赤字表示 |
| `/products` (商品管理) | 商品追加・編集・有効/無効切替・削除 |

## DBスキーマ

- `products` — 商品マスタ
- `daily_checks` — 日次チェック（日付・カメラ確認日時・メモ）
- `inventory_records` — 在庫記録（チェック×商品の納品数・前日在庫・販売数・実在庫）
