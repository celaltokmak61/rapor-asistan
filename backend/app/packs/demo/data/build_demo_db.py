import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent / "commerce.db"

SCHEMA = """
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS warehouses;

CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    segment TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    status INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE warehouses (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL
);

CREATE TABLE inventory (
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    PRIMARY KEY (product_id, warehouse_id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    order_no TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    status TEXT NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
"""

CUSTOMERS = [
    (1, "C-100", "Northwind Retail", "Istanbul", "Retail", 1),
    (2, "C-101", "Marmara Wholesale", "Istanbul", "Wholesale", 1),
    (3, "C-102", "Ankara Cafe Group", "Ankara", "HoReCa", 1),
    (4, "C-103", "Ege Markets", "Izmir", "Retail", 1),
    (5, "C-104", "Black Sea Trading", "Samsun", "Wholesale", 1),
    (6, "C-105", "Closed Partner Ltd", "Bursa", "Retail", 0),
]

PRODUCTS = [
    (1, "SKU-TEA-01", "Earl Grey Tea 500g", "Beverages", "pack", 85.0, 1),
    (2, "SKU-COF-01", "Espresso Beans 1kg", "Beverages", "kg", 420.0, 1),
    (3, "SKU-OLV-01", "Extra Virgin Olive Oil 5L", "Grocery", "bottle", 890.0, 1),
    (4, "SKU-HNY-01", "Flower Honey 850g", "Grocery", "jar", 195.0, 1),
    (5, "SKU-NUT-01", "Roasted Hazelnut 1kg", "Grocery", "kg", 310.0, 1),
    (6, "SKU-CHC-01", "Dark Chocolate 70%", "Confectionery", "box", 64.0, 1),
    (7, "SKU-FLR-01", "Bread Flour 10kg", "Bakery", "sack", 240.0, 1),
    (8, "SKU-YST-01", "Dry Yeast 500g", "Bakery", "pack", 48.0, 1),
    (9, "SKU-MIL-01", "UHT Milk 1L", "Dairy", "carton", 32.0, 1),
    (10, "SKU-CHS-01", "Aged Kashkaval 500g", "Dairy", "pack", 175.0, 1),
    (11, "SKU-OLD-01", "Discontinued Syrup", "Beverages", "bottle", 55.0, 0),
]

WAREHOUSES = [
    (1, "IST", "Istanbul warehouse", "Istanbul"),
    (2, "ANK", "Ankara warehouse", "Ankara"),
    (3, "IZM", "Izmir warehouse", "Izmir"),
]

INVENTORY = [
    (1, 1, 140), (1, 2, 40), (1, 3, 18),
    (2, 1, 55), (2, 2, 12), (2, 3, 8),
    (3, 1, 70), (3, 2, 22), (3, 3, 16),
    (4, 1, 90), (4, 2, 35), (4, 3, 28),
    (5, 1, 15), (5, 2, 6), (5, 3, 4),
    (6, 1, 210), (6, 2, 80), (6, 3, 60),
    (7, 1, 48), (7, 2, 20), (7, 3, 11),
    (8, 1, 160), (8, 2, 70), (8, 3, 45),
    (9, 1, 320), (9, 2, 150), (9, 3, 90),
    (10, 1, 38), (10, 2, 14), (10, 3, 9),
]

ORDERS = [
    (1, "SO-2026-001", 1, 1, "2026-08-03", "completed", 2550.0),
    (2, "SO-2026-002", 2, 1, "2026-08-07", "completed", 6240.0),
    (3, "SO-2026-003", 3, 2, "2026-08-12", "completed", 1980.0),
    (4, "SO-2026-004", 4, 3, "2026-08-18", "completed", 3120.0),
    (5, "SO-2026-005", 5, 1, "2026-08-22", "completed", 4410.0),
    (6, "SO-2026-006", 1, 1, "2026-09-02", "completed", 1870.0),
    (7, "SO-2026-007", 2, 1, "2026-09-05", "completed", 8900.0),
    (8, "SO-2026-008", 3, 2, "2026-09-09", "completed", 2460.0),
    (9, "SO-2026-009", 4, 3, "2026-09-14", "completed", 1640.0),
    (10, "SO-2026-010", 1, 1, "2026-09-18", "open", 980.0),
    (11, "SO-2026-011", 5, 1, "2026-09-20", "completed", 3720.0),
    (12, "SO-2026-012", 2, 2, "2026-09-22", "completed", 5100.0),
]

ITEMS = [
    (1, 1, 1, 10, 85.0, 850.0), (2, 1, 6, 20, 64.0, 1280.0), (3, 1, 9, 13, 32.0, 416.0),
    (4, 2, 3, 6, 890.0, 5340.0), (5, 2, 5, 3, 310.0, 930.0),
    (6, 3, 2, 4, 420.0, 1680.0), (7, 3, 8, 6, 48.0, 288.0),
    (8, 4, 7, 8, 240.0, 1920.0), (9, 4, 10, 6, 175.0, 1050.0), (10, 4, 9, 5, 32.0, 160.0),
    (11, 5, 3, 3, 890.0, 2670.0), (12, 5, 4, 8, 195.0, 1560.0), (13, 5, 6, 3, 64.0, 192.0),
    (14, 6, 1, 12, 85.0, 1020.0), (15, 6, 6, 10, 64.0, 640.0), (16, 6, 9, 6, 32.0, 192.0),
    (17, 7, 2, 10, 420.0, 4200.0), (18, 7, 3, 4, 890.0, 3560.0), (19, 7, 5, 4, 310.0, 1240.0),
    (20, 8, 4, 6, 195.0, 1170.0), (21, 8, 10, 6, 175.0, 1050.0), (22, 8, 8, 5, 48.0, 240.0),
    (23, 9, 1, 8, 85.0, 680.0), (24, 9, 6, 15, 64.0, 960.0),
    (25, 10, 9, 20, 32.0, 640.0), (26, 10, 8, 7, 48.0, 336.0),
    (27, 11, 7, 9, 240.0, 2160.0), (28, 11, 5, 4, 310.0, 1240.0), (29, 11, 4, 2, 195.0, 390.0),
    (30, 12, 2, 6, 420.0, 2520.0), (31, 12, 3, 2, 890.0, 1780.0), (32, 12, 10, 4, 175.0, 700.0),
]


def build() -> Path:
    DB.parent.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()
    conn = sqlite3.connect(DB)
    try:
        conn.executescript(SCHEMA)
        conn.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?)", CUSTOMERS)
        conn.executemany("INSERT INTO products VALUES (?,?,?,?,?,?,?)", PRODUCTS)
        conn.executemany("INSERT INTO warehouses VALUES (?,?,?,?)", WAREHOUSES)
        conn.executemany("INSERT INTO inventory VALUES (?,?,?)", INVENTORY)
        conn.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?,?)", ORDERS)
        conn.executemany("INSERT INTO order_items VALUES (?,?,?,?,?,?)", ITEMS)
        conn.commit()
    finally:
        conn.close()
    return DB


if __name__ == "__main__":
    path = build()
    print(f"demo db ready: {path}")
