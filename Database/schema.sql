-- SmartStock Pro — PostgreSQL Schema (Supabase)
-- Run this in your Supabase SQL editor

-- USERS & ROLES
CREATE TABLE roles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL  -- 'admin','manager','staff','viewer'
);
INSERT INTO roles(name) VALUES('admin'),('manager'),('staff'),('viewer');

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) UNIQUE NOT NULL,
  name       VARCHAR(255) NOT NULL,
  role_id    INT REFERENCES roles(id) DEFAULT 4,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  sku        VARCHAR(100) UNIQUE,
  category   VARCHAR(100),
  qty        INT NOT NULL DEFAULT 0,
  low_stock  INT NOT NULL DEFAULT 50,
  cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status     VARCHAR(50) DEFAULT 'In Stock',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_products_sku      ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status   ON products(status);

-- CUSTOMERS
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255),
  phone      VARCHAR(50),
  address    TEXT,
  credit     NUMERIC(12,2) DEFAULT 0,
  status     VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SUPPLIERS
CREATE TABLE suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  contact    VARCHAR(255),
  email      VARCHAR(255),
  phone      VARCHAR(50),
  balance    NUMERIC(12,2) DEFAULT 0,
  status     VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SALES
CREATE TABLE sales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no  VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount    NUMERIC(5,2) DEFAULT 0,
  tax         NUMERIC(5,2) DEFAULT 0,
  paid        BOOLEAN DEFAULT FALSE,
  status      VARCHAR(50) DEFAULT 'Pending',
  notes       TEXT,
  sale_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date    DATE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status   ON sales(status);
CREATE INDEX idx_sales_date     ON sales(sale_date);

-- SALE ITEMS
CREATE TABLE sale_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty        INT NOT NULL,
  price      NUMERIC(12,2) NOT NULL,
  cost       NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- EXPENSES
CREATE TABLE expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    VARCHAR(100) NOT NULL,
  description TEXT,
  amount      NUMERIC(12,2) NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring   BOOLEAN DEFAULT FALSE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- PAYROLL
CREATE TABLE employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  role       VARCHAR(100),
  department VARCHAR(100),
  salary     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status     VARCHAR(50) DEFAULT 'Active',
  joined_at  DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  month       VARCHAR(20) NOT NULL,
  salary      NUMERIC(12,2) NOT NULL,
  deductions  NUMERIC(12,2) DEFAULT 0,
  net         NUMERIC(12,2) GENERATED ALWAYS AS (salary - deductions) STORED,
  paid        BOOLEAN DEFAULT FALSE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- INVENTORY MOVEMENTS
CREATE TABLE inventory_movements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  type       VARCHAR(20) NOT NULL,  -- 'in','out','adjustment'
  qty        INT NOT NULL,
  reference  VARCHAR(255),
  note       TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QUOTATIONS
CREATE TABLE quotations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no     VARCHAR(50) UNIQUE NOT NULL,
  customer_id  UUID REFERENCES customers(id),
  total        NUMERIC(12,2) DEFAULT 0,
  status       VARCHAR(50) DEFAULT 'Draft',  -- Draft, Sent, Accepted, Rejected, Converted
  converted_to UUID REFERENCES sales(id),
  valid_until  DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  read       BOOLEAN DEFAULT FALSE,
  user_id    UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SETTINGS
CREATE TABLE settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
