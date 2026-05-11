-- Seed sample products (idempotent — only inserts if catalog is empty)

INSERT INTO products (name, category, price, stock, image_url, description)
SELECT * FROM (VALUES
    ('Amul Gold Milk 1L', 'Dairy', 72.00, 150, 'https://cdn.example.com/products/amul-gold-1l.jpg', 'Full cream homogenised toned milk, 1 litre pouch'),
    ('Britannia Brown Bread', 'Bakery', 45.00, 80, 'https://cdn.example.com/products/britannia-brown.jpg', 'Whole wheat brown bread, 400g'),
    ('Tata Salt 1kg', 'Pantry Staples', 28.00, 300, 'https://cdn.example.com/products/tata-salt-1kg.jpg', 'Iodised refined free flow salt'),
    ('Aashirvaad Atta 5kg', 'Pantry Staples', 295.00, 120, 'https://cdn.example.com/products/aashirvaad-atta.jpg', '100% whole wheat atta, 5kg pack'),
    ('Coca Cola 750ml', 'Beverages', 40.00, 200, 'https://cdn.example.com/products/coke-750ml.jpg', 'Chilled Coca Cola PET bottle')
) AS seed(name, category, price, stock, image_url, description)
WHERE NOT EXISTS (SELECT 1 FROM products);
