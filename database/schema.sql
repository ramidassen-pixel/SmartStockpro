-- SmartStock Pro V5 — Supabase PostgreSQL Schema
-- Run in Supabase SQL Editor

CREATE TABLE ssp_settings (key text PRIMARY KEY, value jsonb, updated_at timestamptz DEFAULT now());
CREATE TABLE ssp_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL,
  sku text, category text, qty int DEFAULT 0, low_level int DEFAULT 5,
  cost numeric(12,2) DEFAULT 0, price numeric(12,2) NOT NULL, unit text DEFAULT 'Pcs',
  status text DEFAULT 'active', desc text, created_at timestamptz DEFAULT now()
);
CREATE TABLE ssp_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL,
  phone text, email text, address text, credit numeric(12,2) DEFAULT 0,
  status text DEFAULT 'Active', total_spent numeric(12,2) DEFAULT 0, purchases int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE ssp_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, customer text,
  customer_id uuid REFERENCES ssp_customers(id), total numeric(12,2) NOT NULL,
  discount numeric(5,2) DEFAULT 0, payment text DEFAULT 'Cash',
  status text DEFAULT 'Paid', notes text, date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE ssp_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid REFERENCES ssp_sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES ssp_products(id), name text, qty int NOT NULL,
  price numeric(12,2) NOT NULL, cost numeric(12,2) DEFAULT 0
);
CREATE TABLE ssp_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, category text NOT NULL,
  description text, amount numeric(12,2) NOT NULL, date date DEFAULT CURRENT_DATE,
  recurring boolean DEFAULT false, created_at timestamptz DEFAULT now()
);
CREATE TABLE ssp_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL,
  role text, dept text, salary numeric(12,2) DEFAULT 0, phone text,
  status text DEFAULT 'active', created_at timestamptz DEFAULT now()
);
CREATE TABLE ssp_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, employee_id uuid REFERENCES ssp_employees(id),
  employee_name text, amount numeric(12,2) NOT NULL, month text NOT NULL, paid_at timestamptz DEFAULT now()
);
CREATE TABLE ssp_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL,
  contact text, phone text, email text, address text, balance numeric(12,2) DEFAULT 0,
  status text DEFAULT 'Active', created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ssp_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_employees  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_payroll    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_suppliers  ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust to your auth setup)
CREATE POLICY "Users own data" ON ssp_products    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ssp_customers   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ssp_sales       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ssp_expenses    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ssp_employees   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ssp_payroll     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ssp_suppliers   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_products_user   ON ssp_products(user_id);
CREATE INDEX idx_sales_user      ON ssp_sales(user_id);
CREATE INDEX idx_sales_date      ON ssp_sales(date);
CREATE INDEX idx_expenses_user   ON ssp_expenses(user_id);
