import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const roots = ['src', 'public', 'dist']
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.xml', '.txt'])
const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /\bservice_role\b/,
  /\bsk_live_[A-Za-z0-9]+/,
  /\bwhsec_[A-Za-z0-9]+/,
]
const findings = []

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await scan(path)
    else if (allowedExtensions.has(extname(path))) {
      const source = await readFile(path, 'utf8')
      if (secretPatterns.some((pattern) => pattern.test(source))) findings.push(path)
    }
  }
}

for (const root of roots) await scan(root)
if (findings.length) {
  console.error(`Client secret scan failed:\n${findings.join('\n')}`)
  process.exit(1)
}
console.log('Client bundles contain no service-role, Stripe live, or webhook secrets.')
