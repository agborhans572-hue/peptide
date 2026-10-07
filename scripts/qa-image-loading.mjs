export async function loadPageImages(page) {
  // Exercise secondary images too; their production loading policy remains lazy.
  await page.evaluate(() => { for (const image of document.images) image.loading = 'eager' })
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0), { timeout: 30000 })
}
