-- Categories are removed: every category held exactly one product, so products now stand alone.
ALTER TABLE products DROP FOREIGN KEY fk_products_category;
ALTER TABLE products DROP INDEX idx_products_category;
ALTER TABLE products DROP COLUMN category_id;

ALTER TABLE coupons DROP FOREIGN KEY fk_coupons_category;
ALTER TABLE coupons DROP INDEX idx_coupons_category;
ALTER TABLE coupons DROP COLUMN category_id;

DROP TABLE categories;
