## Objetivo
Hacer que el portal público de docentes tome como fuente los datos que el propio docente actualiza en su perfil dentro de la plataforma, sin perder los campos de visibilidad/orden/configuración que hoy maneja administración.

## Plan
1. **Unificar la fuente de datos pública**
   - Cambiar el flujo para que el listado público de docentes no dependa solo de datos manuales cargados por administración.
   - Mantener en la tabla de docentes solo los campos administrativos y profesionales que deban seguir controlándose desde el panel (por ejemplo: visibilidad, orden, título, especialidad, LinkedIn y vínculo con el usuario).
   - Hacer que nombre, apellido, biografía y foto pública salgan del perfil personal del docente.

2. **Corregir la sincronización entre perfil y portal público**
   - Implementar sincronización automática entre el perfil personal y el registro docente vinculado.
   - Asegurar que al guardar nombre, apellido, biografía o foto en el perfil, esos cambios queden disponibles inmediatamente para el portal público.
   - Verificar el caso en que el docente aún no esté vinculado a un registro docente y dejar resuelto ese enlace.

3. **Resolver el problema de vinculación actual**
   - Revisar y corregir los registros de docentes que hoy no tienen `user_id` asociado, porque así el sistema no puede saber qué perfil personal corresponde a cada ficha pública.
   - Definir una estrategia segura de enlace para que cada docente autenticado actualice su propia ficha pública y no la de otro usuario.

4. **Ajustar refresco e invalidación de caché**
   - Mantener e integrar la invalidación de consultas del perfil y del portal público para que el cambio se vea al instante tras guardar o subir una foto.
   - Revisar el `queryKey` del portal público para confirmar que se refresque contra la fuente correcta.

5. **Validar fotografía y render del avatar**
   - Confirmar que la subida de imagen actualiza la URL persistida y que el portal público renderiza esa misma URL actualizada.
   - Mantener el corte de caché del navegador para fotos nuevas.

## Hallazgo principal
Hoy el portal público lee desde `teachers_public` (que sale de `teachers`), pero el docente edita `profiles`. Además, en los registros actuales de `teachers` visibles el `user_id` está vacío, por lo que no existe vínculo real entre la ficha pública y la cuenta del docente. Por eso el portal sigue mostrando lo cargado por administración.

## Detalles técnicos
- **Portal público actual:** `src/routes/docentes.tsx` consulta `teachers_public` con `queryKey: ["public", "teachers"]`.
- **Edición del docente:** `src/routes/_authenticated/docente.cuenta.tsx` guarda en `profiles`.
- **Foto:** `src/components/AvatarUploader.tsx` sube al bucket público `avatars` y guarda `avatar_url` en `profiles`.
- **Problema estructural detectado:** la vista `teachers_public` sale de `teachers`, no de `profiles`, y no hay trigger activo en base de datos que sincronice `profiles` -> `teachers`.

## Validación final
- Probar edición de nombre, biografía y foto desde la cuenta docente.
- Confirmar reflejo inmediato en `/docentes` y en la ficha pública del programa.
- Verificar que solo aparezcan docentes visibles y correctamente vinculados.