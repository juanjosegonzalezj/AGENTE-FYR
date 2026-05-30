export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Gestiona las integraciones del centro deportivo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google Calendar */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">📅</div>
            <div>
              <h2 className="font-semibold text-gray-900">Google Calendar</h2>
              <p className="text-xs text-gray-500">Sincroniza reservas automáticamente</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Cada pista puede vincularse a un Google Calendar independiente. Las reservas se crean automáticamente como eventos.
          </p>
          <a href="/api/v1/calendar/connect" className="btn-secondary text-sm inline-block">
            Conectar Google Calendar
          </a>
        </div>

        {/* WhatsApp */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">💬</div>
            <div>
              <h2 className="font-semibold text-gray-900">WhatsApp</h2>
              <p className="text-xs text-gray-500">Asistente IA via WhatsApp</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            El asistente IA atiende mensajes de WhatsApp automáticamente. Escanea el código QR para conectar.
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/webhooks/whatsapp/qr`}
            target="_blank"
            className="btn-secondary text-sm inline-block"
          >
            Ver código QR
          </a>
        </div>

        {/* AI Agent */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-xl">🤖</div>
            <div>
              <h2 className="font-semibold text-gray-900">Agente IA</h2>
              <p className="text-xs text-gray-500">Powered by Claude Sonnet</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            El asistente usa Claude para entender lenguaje natural y ejecutar acciones reales en la base de datos.
          </p>
          <a href="/dashboard/ai" className="btn-primary text-sm inline-block">
            Probar asistente
          </a>
        </div>

        {/* Supabase */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">🗄️</div>
            <div>
              <h2 className="font-semibold text-gray-900">Base de Datos</h2>
              <p className="text-xs text-gray-500">Supabase PostgreSQL</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Datos almacenados en Supabase con Row-Level Security. Cada centro deportivo tiene datos completamente aislados.
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Conectado
          </span>
        </div>
      </div>
    </div>
  );
}
