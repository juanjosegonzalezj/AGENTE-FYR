# FindYourRival – Agente IA Backend

Backend del agente de matchmaking deportivo de FindYourRival.  
Registra jugadores, encuentra rivales compatibles y les envía mensajes automáticos por WhatsApp.

---

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- WhatsApp activo en tu celular

---

## Instalación

```bash
cd "Agente IA FYR"
npm install
```

---

## Configurar variables de entorno

Copia el ejemplo y rellena tus valores:

```bash
cp .env.example .env
```

Edita `.env`:

```env
PORT=3001
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_service_role_key
TABLE_NAME=jugadores
```

> **Importante:** Para operaciones de escritura en el servidor usa la clave `service_role` (no la `anon`).  
> La encuentras en Supabase → Project Settings → API → Service Role Key.

---

## Configurar Supabase

1. Entra a [supabase.com](https://supabase.com) → tu proyecto → **Table Editor**.
2. Crea la tabla `jugadores` con estas columnas:

| Columna          | Tipo    | Notas                        |
|------------------|---------|------------------------------|
| `id`             | uuid    | Primary key, auto-generado   |
| `nombre_capitan` | text    | Requerido                    |
| `telefono`       | text    | Requerido, único             |
| `sport_type`     | text    | `fútbol`, `pádel` o `ambas`  |
| `created_at`     | timestamptz | Default: `now()`         |

3. Si el nombre de tu tabla es diferente, ajusta `TABLE_NAME` en `.env`.

---

## Correr el backend

```bash
npm start
# o en modo desarrollo (recarga automática):
npm run dev
```

La terminal mostrará algo como:

```
[HH:MM:SS] OK    Servidor corriendo en http://localhost:3001
[HH:MM:SS] INFO  QR de WhatsApp disponible en http://localhost:3001/whatsapp/qr
```

---

## Conectar WhatsApp (escanear QR)

1. Con el servidor corriendo, abre en tu navegador:  
   **http://localhost:3001/whatsapp/qr**

2. Aparecerá un código QR. Ábrelo desde tu celular:  
   WhatsApp → ⋮ (tres puntos) → **Dispositivos vinculados** → **Vincular dispositivo**

3. Escanea el QR. La página se actualizará automáticamente y verás:  
   `✅ WhatsApp ya está conectado.`

4. La sesión se guarda en `.wwebjs_auth/` — **no necesitas escanear el QR cada vez**.

---

## Endpoint principal

### `POST /join-matchmaking`

Registra un jugador y notifica automáticamente a rivales compatibles por WhatsApp.

**Body (JSON):**

```json
{
  "nombre_capitan": "Carlos López",
  "telefono": "3001234567",
  "sport_type": "fútbol"
}
```

**Valores válidos para `sport_type`:** `fútbol`, `pádel`, `ambas`

**Lógica de matchmaking:**

| Deporte solicitado | Capitanes contactados        |
|--------------------|------------------------------|
| `fútbol`           | fútbol + ambas               |
| `pádel`            | pádel + ambas                |
| `ambas`            | fútbol + pádel + ambas       |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "message": "Registro exitoso. Se encontraron 3 rival(es) compatible(s).",
  "user": { ... },
  "rivals_found": 3,
  "notifications_sent": 3,
  "notifications_failed": 0,
  "notification_details": [...]
}
```

---

## Otros endpoints

| Método | Ruta                | Descripción                              |
|--------|---------------------|------------------------------------------|
| GET    | `/health`           | Estado del servidor                      |
| GET    | `/whatsapp/status`  | Verifica si WhatsApp está conectado      |
| GET    | `/whatsapp/qr`      | Página web con el QR para escanear       |

---

## Estructura del proyecto

```
Agente IA FYR/
├── src/
│   ├── config/
│   │   └── supabase.js          # Cliente de Supabase
│   ├── controllers/
│   │   └── matchmakingController.js
│   ├── routes/
│   │   ├── matchmakingRoutes.js
│   │   └── whatsappRoutes.js
│   ├── services/
│   │   ├── matchmakingService.js  # Lógica de BD y matchmaking
│   │   └── whatsappService.js     # Integración WhatsApp Web
│   └── utils/
│       └── logger.js              # Logger con colores
├── server.js
├── .env
├── .env.example
└── README.md
```
