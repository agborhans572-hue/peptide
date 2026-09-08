import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { routeManifest } from './route-manifest.mjs'

await mkdir('docs/seo', { recursive: true })
const json = `${JSON.stringify(routeManifest, null, 2)}\n`
await writeFile('public/route-manifest.json', json)
await writeFile('docs/seo/route-manifest.json', json)
await writeFile('docs/seo/route-manifest.md', `# Route classification\n\n${routeManifest.counts.indexable} canonical indexable pages + ${routeManifest.counts.private} private shells = ${routeManifest.counts.pageValidations} page validations. ${routeManifest.counts.productAliases} product aliases (31 original + Semax migration) are separate redirects. Only indexable-200 entries belong in the sitemap.\n\nObserved statuses are pre-change production measurements; — means unmeasured.\n\n| Path or pattern | Classification | Expected | Observed | Canonical destination | Robots | Sitemap |\n|---|---|---|---|---|---|---|\n${routeManifest.routes.map((r) => `| ${r.path || r.pattern} | ${r.classification} | ${r.expectedStatus} | ${r.observedStatus ?? '—'} | ${r.canonical || '—'} | ${r.robots || '—'} | ${r.sitemap ? 'yes' : 'no'} |`).join('\n')}\n\n## API endpoints\n\n${routeManifest.apiEndpoints.map((r) => `- ${r.path}: noindex, private/no-store; existing access controls.`).join('\n')}\n`)

const config = JSON.parse(await readFile('vercel.json', 'utf8'))
config.redirects = routeManifest.routes.filter((r) => r.classification === 'permanent-redirect').map((r) => ({
  source: r.path || r.pattern.replace('*', ':path*'), destination: r.canonical, permanent: true,
}))
// No global trailingSlash rule: aliases must reach the final canonical URL in one hop.
delete config.trailingSlash
const privatePaths = routeManifest.routes.filter((r) => r.classification === 'private-noindex').map((r) => r.path)
const marked = [...privatePaths, '/_product-media/responsive/:path*', '/_site-media/:path*', '/_product-media/social/:path*', '/coa/:path*', '/my-account/:path*', '/auth/:path*', '/checkout/:path*', '/track-my-order/:path*', '/order-confirmation/:path*', '/cart/:path*', '/404.html', '/robots.txt', '/sitemap.xml']
config.headers = config.headers.filter((r) => !marked.includes(r.source) && !['/', '/:path*/', '/:path*.html', '/route-manifest.json', '/hosting-config.json', '/catalog/current.json'].includes(r.source))
for (const source of ['/', '/:path*/', '/:path*.html', '/route-manifest.json', '/hosting-config.json', '/catalog/current.json']) config.headers.push({ source, headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] })
for (const source of ['/_product-media/responsive/:path*']) config.headers.push({ source, headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] })
for (const source of ['/coa/:path*', '/_product-media/social/:path*']) config.headers.push({ source, headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] })
for (const source of new Set([...privatePaths, '/my-account/:path*', '/auth/:path*', '/checkout/:path*', '/track-my-order/:path*', '/order-confirmation/:path*', '/cart/:path*', '/404.html'])) config.headers.push({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] })
for (const source of ['/robots.txt', '/sitemap.xml']) config.headers.push({ source, headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] })
const api = config.headers.find((r) => r.source === '/api/:path*')
if (api && !api.headers.some((h) => h.key === 'X-Robots-Tag')) api.headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
await writeFile('vercel.json', `${JSON.stringify(config, null, 2)}\n`)
await writeFile('public/hosting-config.json', `${JSON.stringify(config, null, 2)}\n`)
let redirects = (await readFile('public/_redirects', 'utf8')).split('\n').filter((line) => line.startsWith('/api/')).join('\n')
redirects += `\n${routeManifest.routes.filter((r) => r.classification === 'permanent-redirect').map((r) => `${r.path || r.pattern} ${r.canonical} 301!`).join('\n')}\n/404.html /404.html 404!\n/* /404.html 404\n`
await writeFile('public/_redirects', redirects)
const headers = config.headers.map((r) => `${r.source === '/catalog/:version/:path*' ? '/catalog/*' : r.source.replaceAll(':path*', '*').replace('/(.*)', '/*')}\n${r.headers.map((h) => `  ${h.key}: ${h.value}`).join('\n')}`).join('\n\n')
await writeFile('public/_headers', `${headers}\n`)
console.log(`Generated route manifest: ${routeManifest.counts.pageValidations} pages, ${routeManifest.counts.productAliases} product aliases.`)
