// Local verification only: real app routes + isolated SQL data, with fixture authentication.
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { createSandbox } = require('./sandbox')
let cleanup = async () => {}

async function main() {
  process.env.CLIENT_ORIGIN = 'http://127.0.0.1:5173'
  const sandbox = await createSandbox()
  let vite
  cleanup = async () => {
    await vite?.close()
    await sandbox.close()
  }
  const [alex, bea] = sandbox.users
  for (const user of sandbox.users) await sandbox.request(user, '/api/profiles/me')
  await sandbox.request(bea, '/api/profiles/me', {
    method: 'PATCH',
    body: {
      name: 'Bea Santos',
      handle: 'bea_at_the_table',
      bio: 'In search of a really good bowl of noodles. Coffee always welcome.',
      topPickIds: [],
    },
  })
  await sandbox.request(bea, '/api/visits', {
    method: 'POST',
    body: {
      place: { name: 'The Corner Cafe', address: 'Angeles City' },
      date: '2026-10-03',
      rating: 5,
      notes: 'A slow afternoon, a perfect cup of coffee, and the best seat by the window.',
      dishes: [
        { name: 'Iced latte', price: 130 },
        { name: 'Almond croissant', price: 95 },
      ],
      isPublic: true,
    },
  })
  const root = path.resolve(__dirname, '../../frontend')
  const { createServer } = await import(
    pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href
  )
  process.env.VITE_API_URL = sandbox.url
  const authFile = path.join(root, 'src/lib/auth.js').replaceAll('\\', '/')
  const user = { id: alex, name: 'Alex Rivera' }
  vite = await createServer({
    root,
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    plugins: [
      {
        name: 'isolated-verification-auth',
        enforce: 'pre',
        load(id) {
          if (id.replaceAll('\\', '/') !== authFile) return
          return `const user = ${JSON.stringify(user)};
        export const authClient = {
          useSession: () => ({data: {user, session: {token: user.id}}, isPending: false}),
          getSession: async () => ({data: {user, session: {token: user.id}}}),
          signOut: async () => ({data: null, error: null}),
          changePassword: async () => { globalThis.__fixturePasswordChanges = (globalThis.__fixturePasswordChanges || 0) + 1; return {data: {success: true}, error: null} }
        };
        export const authCall = async (fn) => fn();
        export const authErrorMessage = () => 'Verification fixture';
        export const isUnverifiedEmail = () => false;
        export const looksLikeEmail = () => true;
        export const PASSWORD_MIN = 8;
        export const PASSWORD_MAX = 128;`
        },
      },
    ],
  })
  await vite.listen()
  console.log(
    JSON.stringify({
      preview: 'http://127.0.0.1:5173',
      testApi: sandbox.url,
      schema: sandbox.schema,
      fixtureProfiles: sandbox.users,
    }),
  )
  let stopping = false
  async function stop() {
    if (stopping) return
    stopping = true
    await cleanup()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  process.stdin.on('data', (chunk) => {
    if (chunk.toString().trim() === 'stop') stop()
  })
}
main().catch(async (error) => {
  await cleanup()
  console.error(error.message)
  process.exitCode = 1
})
