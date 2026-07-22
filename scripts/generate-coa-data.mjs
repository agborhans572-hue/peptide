import fs from 'node:fs/promises'

const sourceUrl = new URL('../preview/reference-coa-categories/coa-categories-audit.json', import.meta.url)
const outputUrl = new URL('../src/coaLibraryData.json', import.meta.url)
const source = JSON.parse(await fs.readFile(sourceUrl, 'utf8'))

const categories = Object.fromEntries(
  Object.entries(source.pages).map(([key, page]) => [key, {
    heading: page.heading,
    items: page.items,
    title: page.title,
  }]),
)

await fs.writeFile(outputUrl, `${JSON.stringify(categories, null, 2)}\n`)
console.log(`Generated ${outputUrl.pathname} with ${Object.values(categories).reduce((sum, page) => sum + page.items.length, 0)} product rows.`)
