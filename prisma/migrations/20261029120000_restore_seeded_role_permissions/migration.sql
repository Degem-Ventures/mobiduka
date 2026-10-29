WITH seeded_roles(name, description, permissions) AS (
  VALUES
    (
      'Admin',
      'Store owner',
      ARRAY[
        'pos', 'discount', 'void', 'credit', 'inventory_v', 'inventory_e',
        'categories', 'reports', 'export', 'customers', 'suppliers', 'expenses',
        'credit_book', 'employees', 'register', 'settings', 'payments', 'roles',
        'shifts', 'shifts_v'
      ]::TEXT[]
    ),
    (
      'Manager',
      'Store manager',
      ARRAY[
        'pos', 'discount', 'inventory_v', 'inventory_e', 'categories', 'reports',
        'export', 'customers', 'suppliers', 'expenses', 'credit_book', 'shifts_v'
      ]::TEXT[]
    ),
    (
      'Cashier',
      'Shift cashier',
      ARRAY['pos', 'discount', 'credit', 'customers']::TEXT[]
    )
  ),
empty_seeded_roles AS MATERIALIZED (
  SELECT role.id, seeded_roles.permissions
  FROM "Role" AS role
  JOIN seeded_roles
    ON role.name = seeded_roles.name
    AND role.description = seeded_roles.description
  WHERE NOT EXISTS (
    SELECT 1
    FROM "RolePermission" AS existing_permission
    WHERE existing_permission."roleId" = role.id
  )
),
inserted_permissions AS (
  INSERT INTO "RolePermission" ("roleId", "permissionKey")
  SELECT empty_seeded_roles.id, permission.permission_key
  FROM empty_seeded_roles
  CROSS JOIN LATERAL unnest(empty_seeded_roles.permissions) AS permission(permission_key)
  ON CONFLICT ("roleId", "permissionKey") DO NOTHING
  RETURNING "roleId"
)
UPDATE "Role" AS role
SET "isSystem" = TRUE
FROM empty_seeded_roles
WHERE role.id = empty_seeded_roles.id
  AND EXISTS (
    SELECT 1
    FROM inserted_permissions
    WHERE inserted_permissions."roleId" = role.id
  );