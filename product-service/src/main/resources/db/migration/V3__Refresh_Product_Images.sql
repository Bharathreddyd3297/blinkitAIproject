-- Replace placeholder cdn.example.com URLs (which never resolved) with real
-- Unsplash photos so the storefront actually shows product images. Matches by
-- name to stay safe across re-seeded ID sequences. Idempotent: re-runs are
-- harmless because each UPDATE just rewrites the same value.

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=900&q=80&auto=format&fit=crop' WHERE name = 'Amul Gold Milk 1L';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=900&q=80&auto=format&fit=crop' WHERE name = 'Britannia Brown Bread';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1550623685-2227f7bbef18?w=900&q=80&auto=format&fit=crop' WHERE name = 'Tata Salt 1kg';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1627735483792-233bf632619b?w=900&q=80&auto=format&fit=crop' WHERE name = 'Aashirvaad Atta 5kg';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1648569883125-d01072540b4c?w=900&q=80&auto=format&fit=crop' WHERE name = 'Coca Cola 750ml';
