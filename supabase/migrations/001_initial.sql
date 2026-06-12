-- 商品マスタ
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 日次チェック（1日1レコード）
create table daily_checks (
  id uuid primary key default gen_random_uuid(),
  check_date date not null unique,
  camera_checked_at timestamptz,
  memo text,
  created_at timestamptz not null default now()
);

-- 在庫記録（日次チェック × 商品）
create table inventory_records (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references daily_checks(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  delivery_qty int not null default 0,       -- 当日納品数
  prev_stock int not null default 0,         -- 前日在庫
  sold_qty int not null default 0,           -- 販売数
  actual_stock int not null default 0,       -- 実測在庫
  created_at timestamptz not null default now(),
  unique (check_id, product_id)
);

-- インデックス
create index on inventory_records(check_id);
create index on inventory_records(product_id);
create index on daily_checks(check_date desc);
