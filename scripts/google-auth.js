/**
 * Script para obtener el GOOGLE_REFRESH_TOKEN de Google Calendar.
 * Ejecutar UNA SOLA VEZ:  node scripts/google-auth.js
 *
 * ANTES de ejecutar:
 * 1. Ve a console.cloud.google.com → APIs & Services → Credentials
 * 2. Edita tu OAuth 2.0 Client ID
 * 3. En "Authorized redirect URIs" agrega:  http://localhost:3001
 * 4. Guarda y espera 1-2 minutos
 * 5. Luego ejecuta este script
 */

import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';
import { URL } from 'url';
import 'dotenv/config';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3001';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar'],
  prompt: 'consent',
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Google Calendar – Obtener Refresh Token');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nAbriendo navegador... Si no abre, copia esta URL:\n');
console.log(authUrl + '\n');
console.log('Esperando autorización en http://localhost:3001 ...\n');

function abrirNavegador(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd, (err) => { if (err) {} }); // silenciar error si no puede abrir
}

const server = http.createServer(async (req, res) => {
  const url   = new URL(req.url, 'http://localhost:3001');
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>❌ Error: ${error}</h2><p>Cierra esta ventana.</p>`);
    console.error(`\n❌ Error de Google: ${error}`);
    if (error === 'access_denied') {
      console.error('   Tu cuenta no está en la lista de usuarios de prueba.');
      console.error('   Solución abajo ↓');
    }
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h2>⚠️ No se obtuvo refresh_token</h2>
        <p>Ya autorizaste esta app antes. Revoca el acceso en
        <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>
        y vuelve a ejecutar el script.</p>`);
      console.warn('\n⚠️  Sin refresh_token. Revoca en myaccount.google.com/permissions y reintenta.\n');
      server.close();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>✅ ¡Éxito! Ya puedes cerrar esta ventana.</h2>');

    console.log('\n✅ ¡Token obtenido! Agrega esto a tu .env:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    server.close();

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error: ' + err.message);
    console.error('\n❌ Error:', err.message, '\n');
    server.close();
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n❌ Puerto 3001 ocupado. Detén el servidor principal antes de ejecutar este script.\n');
  } else {
    console.error('\n❌ Error:', err.message);
  }
  process.exit(1);
});

server.listen(3001, () => {
  abrirNavegador(authUrl);
});
