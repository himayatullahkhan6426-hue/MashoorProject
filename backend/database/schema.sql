CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    full_name VARCHAR(100) NOT NULL,

    username VARCHAR(50) UNIQUE NOT NULL,

    email VARCHAR(150) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'OWNER'
        CHECK (role IN ('OWNER', 'ADMIN', 'SALESPERSON')),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);



-- Products
CREATE TABLE IF NOT EXISTS products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CHECK (purchase_price >= 0),
    CHECK (selling_price >= 0),
    CHECK (stock_quantity >= 0)
);

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    delivery_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CHECK (subtotal >= 0),
    CHECK (discount >= 0),
    CHECK (total_amount >= 0)
);

-- Individual products in each delivery
CREATE TABLE IF NOT EXISTS delivery_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delivery_id BIGINT NOT NULL REFERENCES deliveries(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    product_name VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    line_total NUMERIC(12,2) NOT NULL,

    CHECK (quantity > 0),
    CHECK (unit_price >= 0),
    CHECK (line_total >= 0)
);

-- Shop payments
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    amount NUMERIC(12,2) NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(30) DEFAULT 'CASH',
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CHECK (amount > 0)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_shop
ON deliveries(shop_id);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery
ON delivery_items(delivery_id);

CREATE INDEX IF NOT EXISTS idx_payments_shop
ON payments(shop_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_date
ON deliveries(delivery_date);

CREATE INDEX IF NOT EXISTS idx_payments_date
ON payments(payment_date);