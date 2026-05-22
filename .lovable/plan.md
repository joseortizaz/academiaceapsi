## Asignar rol de administrador a admin@ceapsird.com

El usuario `admin@ceapsird.com` ya existe (id `0b6d07b7-7891-458e-8044-2a7f1669e48d`) y actualmente solo tiene el rol `estudiante`.

### Cambios

1. Insertar una fila en `public.user_roles` con `role = 'admin'` para ese `user_id` (se mantiene también su rol `estudiante`; ambos pueden coexistir).

### Resultado

Al iniciar sesión con `admin@ceapsird.com`, el usuario tendrá acceso completo al panel `/admin` y a todas las acciones protegidas por `has_role(auth.uid(), 'admin')`.
