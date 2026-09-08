import { gzipSync } from 'node:zlib'
import { convertHeaders, convertRedirects } from '@vercel/routing-utils/dist/superstatic.js'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.pdf': 'application/pdf' }
export async function serveBuiltSite({ directory = 'dist', port = 0, compression = process.env.SEO_COMPRESSION === '1' } = {}) {
  const root = resolve(directory)
  const config = await readFile(resolve(root, 'hosting-config.json'), 'utf8').then(JSON.parse).catch(() => ({ headers: [] }))
  // Compile actual checked-in host rules; do not infer HTTP behavior from the expected manifest.
  const headerRules = convertHeaders(config.headers || [])
  const redirectRules = convertRedirects(config.redirects || [])
  const compressedFiles = new Map()
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      const pathname = decodeURIComponent(url.pathname)
      const matches = (rule) => new RegExp(rule.src, 'i').test(url.pathname)
      for (const rule of headerRules.filter(matches)) {
        for (const [key, value] of Object.entries(rule.headers)) response.setHeader(key, value)
      }
      const redirect = redirectRules.find(matches)
      if (redirect) {
        response.writeHead(redirect.status, { Location: redirect.headers.Location + url.search })
        response.end()
        return
      }
      let file = resolve(root, `.${pathname}`)
      if (file !== root && !file.startsWith(`${root}${sep}`)) throw new Error('Invalid path')
      if ((await stat(file).catch(() => null))?.isDirectory()) file = resolve(file, 'index.html')
      const content = await readFile(file).catch(() => null)
      if (content) {
        response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
        if (compression && /\.(html|css|js|json|xml|svg|txt)$/.test(file) && /\bgzip\b/.test(request.headers['accept-encoding'] || '')) {
          if (!compressedFiles.has(file)) compressedFiles.set(file, gzipSync(content))
          response.setHeader('Content-Encoding', 'gzip')
          response.setHeader('Vary', 'Accept-Encoding')
          response.end(compressedFiles.get(file))
        } else response.end(content)
      } else {
        response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' })
        response.end(await readFile(resolve(root, '404.html')).catch(() => '<!doctype html><html lang="en"><head><meta name="robots" content="noindex, nofollow"><title>Page Not Found | Pure Health Peptides</title></head><body><main><h1>Page not found</h1><a href="/shop/">Browse research peptides</a></main></body></html>'))
      }
    } catch {
      response.writeHead(404, { 'X-Robots-Tag': 'noindex, nofollow' })
      response.end('Not found')
    }
  })
  await new Promise((done) => server.listen(port, '127.0.0.1', done))
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { url } = await serveBuiltSite({ directory: process.argv[2] || 'dist', port: Number(process.env.PORT || 4173) })
  console.log(`Built site: ${url}`)
}
