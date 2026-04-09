# Deploy — Partners Platform en Dokploy

## Pre-requisitos

- VPS con Dokploy instalado y funcionando
- Repositorio en GitHub (público o privado con acceso configurado en Dokploy)
- Proyecto en Supabase Cloud con la migración `001_initial_schema.sql` aplicada

---

## Paso 1: Configurar Supabase Cloud

1. Ve a [supabase.com](https://supabase.com) y abre tu proyecto
2. En **Settings > API** copia estos 3 valores:
   - `Project URL` → será tu `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → será tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → será tu `SUPABASE_SERVICE_ROLE_KEY`
3. En **SQL Editor**, ejecuta el contenido de `supabase/migrations/001_initial_schema.sql` si aún no lo has hecho
4. En **Authentication > URL Configuration**, agrega la URL de tu app:
   - Site URL: `http://TU_IP:3000` (o tu dominio cuando lo tengas)
   - Redirect URLs: `http://TU_IP:3000/**`

---

## Paso 2: Crear la aplicación en Dokploy

1. Abre el panel de Dokploy en tu VPS
2. Click en **Create Service** → **Application**
3. Configuración del source:
   - Provider: **GitHub**
   - Repository: selecciona tu repo `partners-platform`
   - Branch: `main` (o la que uses)
   - Build Type: **Dockerfile**
   - Dockerfile Path: `./Dockerfile`

---

## Paso 3: Configurar Build Args (IMPORTANTE)

Next.js necesita las variables `NEXT_PUBLIC_*` en tiempo de build porque las incrusta en el JavaScript del cliente.

En Dokploy, ve a la sección **Build** de tu aplicación y agrega estos **Build Args**:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...tu-anon-key` |

---

## Paso 4: Configurar Environment Variables

En la sección **Environment** de Dokploy, agrega las variables de entorno de runtime:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...tu-service-role-key
```

> **Importante**: `SUPABASE_SERVICE_ROLE_KEY` es secreto y solo se usa server-side. Nunca lo pongas como Build Arg.

---

## Paso 5: Configurar Puerto y Red

En la sección **Domains/Ports** de Dokploy:

- Container Port: `3000`
- Si usas IP directa: configura un port mapping (ej: `3000:3000` o `80:3000`)
- Si tienes dominio: agrega el dominio y Dokploy configurará el proxy automáticamente

---

## Paso 6: Deploy

1. Click en **Deploy** en Dokploy
2. Espera a que el build termine (puede tardar 2-3 minutos la primera vez)
3. Verifica los logs de build para asegurarte de que no hay errores
4. Accede a `http://TU_IP:3000` para verificar que funciona

---

## Paso 7: Crear el primer usuario admin

1. Ve a Supabase Dashboard > Authentication > Users
2. Click en **Add User** > **Create new user**
3. Ingresa email y contraseña para el super admin
4. Copia el UUID del auth user creado
5. Ve a SQL Editor y ejecuta:

```sql
-- Crear el usuario en la tabla de la app
INSERT INTO users (auth_user_id, email, name, user_type)
VALUES (
  'UUID-DEL-AUTH-USER',
  'tu@email.com',
  'Tu Nombre',
  'system_user'
);

-- Crear un partner (si aún no existe)
INSERT INTO partners (name, description)
VALUES ('BoxFi', 'Partner principal')
RETURNING id;

-- Asignar rol de super_admin (usa el ID del partner que se generó)
INSERT INTO user_partner_roles (user_id, partner_id, role)
VALUES (
  (SELECT id FROM users WHERE email = 'tu@email.com'),
  (SELECT id FROM partners WHERE name = 'BoxFi'),
  'super_admin'
);
```

6. Ahora puedes hacer login en `http://TU_IP:3000/login`

---

## Actualizar (re-deploy)

Cada vez que hagas push a la branch configurada:
- Dokploy puede hacer auto-deploy si activas **Auto Deploy** en la configuración
- O puedes hacer click en **Deploy** manualmente desde el panel

---

## Troubleshooting

### El build falla con "Module not found"
- Verifica que hiciste `npm install` y que `package-lock.json` está commiteado en el repo

### "Invalid Supabase URL" o errores de auth
- Verifica que los **Build Args** estén configurados (las variables `NEXT_PUBLIC_*` se necesitan en build time)
- Verifica que las **Environment Variables** también estén configuradas (se necesitan en runtime también)

### La app carga pero no muestra datos
- Revisa que `SUPABASE_SERVICE_ROLE_KEY` esté en las Environment Variables
- Verifica que la migración SQL se haya ejecutado en Supabase
- Revisa las RLS policies en Supabase

### Error de CORS o redirect
- En Supabase > Auth > URL Configuration, agrega tu URL en "Redirect URLs"
- Formato: `http://TU_IP:3000/**`

### PDFKit no funciona en Docker
- El Dockerfile usa `node:18-alpine` que incluye todo lo necesario
- Si hay problemas de fonts, agrega `RUN apk add --no-cache fontconfig` en el stage runner
