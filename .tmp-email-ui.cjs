const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { chromium } = require('C:/Users/PC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const { createSandbox } = require('./backend/test/sandbox')

async function main() {
  process.env.CLIENT_ORIGIN = 'http://127.0.0.1:5173'
  const codes = new Map()
  let sends = 0
  let failDelivery = false
  const sandbox = await createSandbox({ emailAuth: true, emailProvider: async (route, body) => {
    if (failDelivery) return { status: 503, error: 'Email service unavailable. Please try again.' }
    if (route.endsWith('send-verification-otp')) { sends++; codes.set(body.email, '123456'); return { status: 200, data: { success: true } } }
    if (codes.get(body.email) !== body.otp) return { status: 400, error: 'That code is not right. Check your email and try again.' }
    if (route.endsWith('check-verification-otp')) return { status: 200, data: { success: true } }
    codes.delete(body.email)
    return { status: 200, data: { status: true, user: { id: sandbox.users[Number(body.email.match(/diner(\d)/)[1])] } } }
  } })
  let vite, browser, page
  try {
    const root = path.resolve('frontend')
    const authPath = path.join(root, 'src/lib/auth.js').replaceAll('\\', '/')
    const original = fs.readFileSync(authPath, 'utf8')
    const helpers = original.slice(original.indexOf('// Neon Auth reports'))
    const fixtures = sandbox.users.map((id, i) => ({ user: { id, email: `diner${i}@example.test`, name: ['Alex Rivera', 'Bea Santos', 'Casey Cruz'][i] }, session: { token: id, id: sandbox.sessions[i] } }))
    process.env.VITE_API_URL = sandbox.url
    const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href)
    vite = await createServer({ root, server: { host: '127.0.0.1', port: 5173, strictPort: true }, plugins: [{
      name: 'email-ui-fixture', enforce: 'pre',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/__fixture/confirm') {
            await sandbox.pool.query('UPDATE auth_users SET "emailVerified" = true WHERE id = $1', [sandbox.users[2]])
            codes.delete('diner2@example.test')
            res.end('{}'); return
          }
          if (req.url === '/__fixture/signup') { codes.set('diner2@example.test', '654321'); res.end('{}'); return }
          next()
        })
      },
      load(id) {
        if (id.replaceAll('\\', '/') !== authPath) return
        return `import { useSyncExternalStore } from 'react';
        const fixtures = ${JSON.stringify(fixtures)};
        const listeners = new Set();
        let snapshot = {data: JSON.parse(localStorage.getItem('fixture-session') || 'null'), isPending:false};
        function update(data) { localStorage.setItem('fixture-session',JSON.stringify(data)); snapshot={data,isPending:false}; for (const fn of listeners) fn(); }
        function subscribe(fn) {listeners.add(fn); return () => listeners.delete(fn);}
        export const authClient = {
          useSession: () => useSyncExternalStore(subscribe, () => snapshot),
          getSession: async () => ({data:snapshot.data}),
          signIn: {email: async ({password}) => {if(password !== 'fixture-password') return {error:{code:'invalid_credentials'}}; update(fixtures[0]); return {data:fixtures[0]};},
            social: async () => {update(fixtures[0]); location.assign('/');return {data:fixtures[0]};}},
          signUp: {email: async () => {await fetch('/__fixture/signup');return {data:{user:fixtures[2].user}};}},
          emailOtp: {verifyEmail: async ({otp}) => {if(otp !== '654321')return {error:{message:'Invalid OTP'}}; await fetch('/__fixture/confirm'); update(fixtures[2]);return {data:{user:fixtures[2].user}};}, sendVerificationOtp: async () => ({data:{success:true}})},
          signOut: async () => {update(null);return {data:null,error:null};}
        };\n${helpers}`
      },
    }] })
    await vite.listen()
    browser = await chromium.launch({ headless: true, channel: 'msedge' })
    const errors = []
    async function newPage(viewport) {
      const context = await browser.newContext({ viewport })
      const result = await context.newPage()
      result.on('pageerror', (e) => errors.push(e.message))
      return result
    }
    async function login(current, wrongFirst = false) {
      await current.goto('http://127.0.0.1:5173/login')
      await current.getByLabel('Email', { exact: true }).fill('diner0@example.test')
      await current.getByLabel('Password', { exact: true }).fill(wrongFirst ? 'wrong' : 'fixture-password')
      await current.getByRole('button', { name: 'Continue to email code' }).click()
      if (wrongFirst) {
        await current.getByRole('alert').filter({ hasText: 'Wrong email or password.' }).waitFor()
        await current.getByLabel('Password', { exact: true }).fill('fixture-password')
        await current.getByRole('button', { name: 'Continue to email code' }).click()
      }
      await current.getByRole('heading', { name: 'Confirm your sign-in' }).waitFor()
      await current.getByRole('button', { name: 'Verify & log in' }).waitFor({state:'visible'})
      await current.waitForFunction(() => !document.querySelector('#login-code')?.disabled)
    }
    page = await newPage({ width: 1440, height: 1000 })
    await login(page, true)
    assert.equal(sends, 1)
    await page.getByLabel('Code from your email').fill('000000')
    await page.getByRole('button', { name: 'Verify & log in' }).click()
    await page.getByRole('alert').filter({ hasText: 'That code is not right' }).waitFor()
    await page.goto('http://127.0.0.1:5173/')
    await page.getByRole('heading', { name: 'Confirm your sign-in' }).waitFor()
    await page.reload()
    await page.waitForFunction(() => !document.querySelector('#login-code')?.disabled)
    assert.equal(sends, 1, 'reloading must not resend')
    await page.screenshot({ path: path.join(process.env.TEMP, 'dishboxd-email-desktop.png'), fullPage: true })
    await page.getByLabel('Code from your email').fill('123456')
    await page.getByRole('button', { name: 'Verify & log in' }).click()
    await page.getByRole('heading', { name: /username/i }).waitFor()
    await page.getByLabel('Username', { exact: true }).fill('alex.eats')
    await page.getByRole('button', { name: /claim|save|continue/i }).click()
    await page.getByRole('button', { name: /skip/i }).click()
    await page.waitForURL('http://127.0.0.1:5173/')
    await page.reload()
    await page.getByRole('link', { name: /New review/i }).waitFor()
    assert.equal(sends, 1)
    console.log('PASS desktop password, blocked navigation, wrong code, reload, verification, onboarding and journal restoration')

    await sandbox.pool.query('DELETE FROM email_login_challenges')
    failDelivery = true
    page = await newPage({ width: 390, height: 844 })
    await page.clock.install()
    await login(page)
    await page.getByRole('alert').filter({ hasText: 'Email service unavailable' }).waitFor()
    assert.ok(await page.getByRole('button', { name: /Send a new code in/ }).isDisabled())
    failDelivery = false
    await sandbox.pool.query('UPDATE email_login_challenges SET sent_at = now() - interval \'31 seconds\'')
    await page.clock.runFor(31000)
    await page.getByRole('button', { name: 'Send email code', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'A code is on its way' }).waitFor()
    await sandbox.pool.query('UPDATE email_login_challenges SET expires_at = now() - interval \'1 second\'')
    await page.getByLabel('Code from your email').fill('123456')
    await page.getByRole('button', { name: 'Verify & log in' }).click()
    await page.getByRole('alert').filter({ hasText: 'expired or was already used' }).waitFor()
    await page.screenshot({ path: path.join(process.env.TEMP, 'dishboxd-email-mobile.png'), fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.getByRole('button', { name: 'Use a different account' }).click()
    await page.waitForURL('**/login')
    console.log('PASS mobile delivery retry, resend cooldown, expiry, layout and cancellation')

    await sandbox.pool.query('DELETE FROM email_login_challenges')
    page = await newPage({ width: 1440, height: 1000 })
    await page.goto('http://127.0.0.1:5173/login')
    await page.getByRole('button', { name: 'Continue with Google' }).click()
    await page.getByRole('heading', { name: 'Confirm your sign-in' }).waitFor()
    await page.waitForFunction(() => !document.querySelector('#login-code')?.disabled)
    console.log('PASS Google primary session is also gated')

    const beforeSignup = sends
    await sandbox.pool.query('UPDATE auth_users SET "emailVerified" = false WHERE id = $1', [sandbox.users[2]])
    page = await newPage({ width: 390, height: 844 })
    await page.goto('http://127.0.0.1:5173/signup')
    await page.getByLabel('Name', { exact: true }).fill('Casey Cruz')
    await page.getByLabel('Email', { exact: true }).fill('diner2@example.test')
    await page.getByLabel('Password', { exact: true }).fill('fixture-password')
    await page.getByRole('button', { name: /create account/i }).click()
    await page.getByLabel('Code from the email').fill('654321')
    await page.getByRole('button', { name: 'Confirm email' }).click()
    await page.getByRole('heading', { name: /username/i }).waitFor()
    assert.equal(sends, beforeSignup, 'signup should not send a second code')
    assert.deepEqual(errors, [])
    console.log('PASS signup reuses its code and opens mandatory username setup; no browser runtime errors')
  } catch (error) {
    if (page) console.log((await page.locator('body').innerText()).slice(0,3500))
    throw error
  } finally {
    await browser?.close()
    await vite?.close()
    await sandbox.close()
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
