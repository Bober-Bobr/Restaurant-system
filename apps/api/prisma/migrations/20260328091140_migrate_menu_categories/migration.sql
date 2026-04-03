-- Migrate existing menu item categories to new enum values
UPDATE MenuItem SET category = 'HOT_APPETIZERS' WHERE category IN ('Appetizers', 'Hot Appetizers', 'Starters', 'appetizers', 'hot appetizers', 'starters');
UPDATE MenuItem SET category = 'FIRST_COURSE' WHERE category IN ('Soups', 'Salads', 'First Course', 'Starters', 'soups', 'salads', 'first course', 'starters');
UPDATE MenuItem SET category = 'SECOND_COURSE' WHERE category IN ('Main Courses', 'Main Course', 'Entrees', 'Mains', 'main courses', 'main course', 'entrees', 'mains');

-- Set any remaining categories to SECOND_COURSE as default
UPDATE MenuItem SET category = 'SECOND_COURSE' WHERE category NOT IN ('HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE');