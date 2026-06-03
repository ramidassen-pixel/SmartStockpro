-- SmartStock Pro v2 — PostgreSQL Schema (Supabase)
-- Run this in your Supabase SQL editor

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  qty INT DEFAULT 0,
  low_stock INT DEFAULT 50,
  cost NUMERIC(12,2) DEFAULT 0,
  price NUMERIC(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'In Stock',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  credit NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  purchases INT DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255),
  total NUMERIC(12,2) NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'Pending',
  sale_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_name VARCHAR(255),
  qty INT NOT NULL,
  price NUMERIC(12,2) NOT NULL
);
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  department VARCHAR(100),
  salary NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Enable Row Level Security
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
