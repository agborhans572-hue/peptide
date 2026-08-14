import { spawn } from 'node:child_process'
import { once } from 'node:events'

const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  'preview',
  '--host', '127.0.0.1',
  '--port', '4173',
  '--strictPort',
], { stdio: 'inherit' })

async function waitForPreview() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Preview server exited with ${server.exitCode}.`)
    try {
      const response = await fetch('http://127.0.0.1:4173/', { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Preview server did not become ready within ten seconds.')
}

try {
  await waitForPreview()
  const npmCli = process.env.npm_execpath
  if (!npmCli) throw new Error('npm_execpath is unavailable; run this gate through npm.')
  const qa = spawn(process.execPath, [npmCli, 'run', 'qa'], {
    env: { ...process.env, SHOP_QA_URL: 'http://127.0.0.1:4173' },
    stdio: 'inherit',
  })
  const [code] = await once(qa, 'exit')
  if (code !== 0) process.exitCode = code || 1
} finally {
  server.kill('SIGTERM')
  if (server.exitCode === null) await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 2000))])
}
