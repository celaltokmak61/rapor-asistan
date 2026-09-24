# Demo commerce pack

Bundled SQLite sample used for `docker compose up` and local try-without-MSSQL.

Tables: `customers`, `products`, `warehouses`, `inventory`, `orders`, `order_items`.

Rebuild the database:

```bash
python backend/app/packs/demo/data/build_demo_db.py
```
