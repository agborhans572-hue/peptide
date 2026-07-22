import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { shopProducts as legacyProducts, RESEARCH_CATEGORIES } from '../src/shopData.js'
import {
  SITE_ORIGIN,
  catalogHash,
  cleanSlug,
  productSlugs,
  readLogisticsCsv,
  stripHtml,
  validateCatalog,
} from './catalog-core.mjs'

const sourceConfig = JSON.parse(await readFile(resolve('catalog/catalog-source.json'), 'utf8'))
const audit = JSON.parse(await readFile(resolve(sourceConfig.reviewedSnapshot), 'utf8'))
const details = JSON.parse(await readFile(resolve('src/productDetailData.json'), 'utf8'))
const overrides = JSON.parse(await readFile(resolve('catalog/content-overrides.json'), 'utf8'))
const slugOverrides = JSON.parse(await readFile(resolve('catalog/slug-overrides.json'), 'utf8'))
const retiredProducts = JSON.parse(await readFile(resolve('catalog/retired-products.json'), 'utf8'))
const logistics = readLogisticsCsv(resolve('catalog/product-logistics-master.csv'))
const logisticsByVariant = new Map(logistics.map((row) => [String(row.woo_variant_id), row]))
const logisticsByProduct = new Map(logistics.map((row) => [String(row.woo_product_id), row]))
const legacyById = new Map(legacyProducts.map((product) => [product.id, product]))
const slugsByWooId = productSlugs(audit.products, slugOverrides)
const typeLabels = { vials: 'Vial', capsules: 'Capsules', liquids: 'Liquid', topicals: 'Topical' }

function positiveInteger(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function restrictions(row) {
  return String(row?.shipping_restriction_codes || 'US_DOMESTIC_ONLY')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
}

function logisticsApproved(row) {
  return row?.approved?.toLowerCase() === 'true'
    && Boolean(row.product_sku)
    && Boolean(row.variant_sku)
    && positiveInteger(row.shipping_weight_g)
    && positiveInteger(row.package_length_mm)
    && positiveInteger(row.package_width_mm)
    && positiveInteger(row.package_height_mm)
}

const products = audit.products.map((sourceProduct) => {
  if ((sourceProduct.prices?.currency || 'USD').toUpperCase() !== 'USD') throw new Error(`Woo product ${sourceProduct.id} uses unsupported currency ${sourceProduct.prices.currency}.`)
  const id = sourceProduct.local?.id
  const legacy = legacyById.get(id)
  if (!legacy) throw new Error(`Woo product ${sourceProduct.id} has no immutable local product ID.`)
  const sourceSlug = sourceProduct.slug
  const slug = slugsByWooId.get(sourceProduct.id)
  const detail = details[sourceSlug] || {}
  const contentOverride = overrides[id] || {}
  const productLogistics = logisticsByProduct.get(String(sourceProduct.id))
  const imageMap = new Map((sourceProduct.images || []).map((image, index) => [image.src, detail.images?.[index]]))
  const images = (detail.images?.length ? detail.images : [{ src: legacy.image, alt: `${sourceProduct.title} ${typeLabels[sourceProduct.type] || 'research product'}`, role: 'primary' }])
    .map((image, index) => ({
      role: image.role || (index === 0 ? 'primary' : 'gallery'),
      src: image.src,
      alt: image.alt?.trim() || `${sourceProduct.title} ${image.role || `gallery image ${index + 1}`}`,
    }))
  const primaryImage = images.find((image) => image.role === 'primary') || images[0]
  const shortDescriptionHtml = contentOverride.shortDescriptionHtml || sourceProduct.shortDescriptionHtml || detail.shortDescriptionHtml
  const descriptionHtml = contentOverride.descriptionHtml || sourceProduct.descriptionHtml || detail.descriptionHtml
  const options = sourceProduct.variants.map((variant) => {
    const row = logisticsByVariant.get(String(variant.id))
    const localizedVariantImage = imageMap.get(variant.image) || primaryImage
    const stockQuantity = variant.stockQuantity == null ? null : Math.max(0, Number(variant.stockQuantity))
    const regularPriceCents = Math.round(Number(variant.regularPrice) * 100)
    const priceCents = Math.round(Number(variant.price) * 100)
    const approved = logisticsApproved(row)
    return {
      id: String(variant.id),
      wooVariantId: Number(variant.id),
      sku: row?.variant_sku || `WC-V-${variant.id}`,
      skuSource: row?.variant_sku ? 'merchant' : 'derived',
      label: variant.label,
      attributes: variant.attributes || {},
      priceCents,
      compareAtPriceCents: regularPriceCents > priceCents ? regularPriceCents : null,
      price: priceCents / 100,
      regularPrice: regularPriceCents / 100,
      available: Boolean(sourceProduct.published && sourceProduct.purchasable && variant.available && stockQuantity !== 0),
      stockQuantity,
      maxQty: stockQuantity,
      image: localizedVariantImage?.src || primaryImage.src,
      imageAlt: `${sourceProduct.title} ${variant.label} research product`,
      shippingWeightGrams: positiveInteger(row?.shipping_weight_g),
      packageDimensionsMm: {
        length: positiveInteger(row?.package_length_mm),
        width: positiveInteger(row?.package_width_mm),
        height: positiveInteger(row?.package_height_mm),
      },
      shippingRestrictions: restrictions(row),
      logisticsApproved: Boolean(approved),
    }
  })
  const activeOptions = options.filter((option) => option.available)
  const priceCents = Math.min(...(activeOptions.length ? activeOptions : options).map((option) => option.priceCents))
  const productSku = productLogistics?.product_sku || `WC-P-${sourceProduct.id}`
  return {
    ...legacy,
    id,
    wooProductId: Number(sourceProduct.id),
    sku: productSku,
    skuSource: productLogistics?.product_sku ? 'merchant' : 'derived',
    slug,
    detailKey: sourceSlug,
    legacySlugs: sourceSlug !== slug ? [sourceSlug] : [],
    productUrl: new URL(`/product/${slug}/`, SITE_ORIGIN).href,
    name: sourceProduct.title.trim(),
    status: sourceProduct.published ? 'published' : 'draft',
    visibility: sourceProduct.published && sourceProduct.visible !== false ? 'visible' : 'hidden',
    published: Boolean(sourceProduct.published),
    purchasable: Boolean(sourceProduct.purchasable),
    currency: 'USD',
    priceCents,
    price: priceCents / 100,
    displayPrice: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceCents / 100),
    sortPrice: priceCents / 100,
    categories: sourceProduct.categories.map((category) => category.slug),
    categoryDetails: sourceProduct.categories,
    optionLabel: sourceProduct.attributes?.[0]?.name || legacy.optionLabel || 'Option',
    defaultOption: Math.max(0, sourceProduct.defaultVariantIndex || 0),
    options,
    image: primaryImage.src || legacy.image,
    imageAlt: `${sourceProduct.title} research ${sourceProduct.type} product`,
    images,
    shortDescriptionHtml,
    shortDescription: stripHtml(shortDescriptionHtml),
    descriptionHtml,
    description: stripHtml(descriptionHtml),
    contentTemplate: sourceProduct.contentTemplate,
    molecularStructureImage: detail.molecularStructureImage || sourceProduct.molecularStructureImage,
    shippingRestrictions: [...new Set(options.flatMap((option) => option.shippingRestrictions))],
    logisticsApproved: options.every((option) => option.logisticsApproved) && Boolean(productLogistics?.product_sku),
  }
})

const productCategorySlugs = new Set(products.flatMap((product) => product.categories))
const categoryNames = new Map(audit.products.flatMap((product) => product.categories.map((category) => [category.slug, category.name])))
const categories = [...new Set([...RESEARCH_CATEGORIES.filter((category) => category.id !== 'all').map((category) => category.id), ...productCategorySlugs])]
  .filter((slug) => productCategorySlugs.has(slug))
  .map((slug) => ({ slug, name: categoryNames.get(slug) || RESEARCH_CATEGORIES.find((category) => category.id === slug)?.label || slug }))
  .sort((left, right) => left.slug.localeCompare(right.slug))

const publicProducts = products.filter((product) => product.status === 'published' && product.visibility === 'visible')
const version = catalogHash(publicProducts)
const catalog = {
  version,
  source: { ...audit.source, mode: 'reviewed-build-snapshot' },
  categories,
  products: publicProducts,
  retiredProducts,
}
const errors = validateCatalog(catalog)
if (errors.length) throw new Error(`Catalog validation failed:\n- ${errors.join('\n- ')}`)

const serverCatalog = {
  version,
  products: publicProducts.map((product) => ({
    id: product.id,
    wooProductId: product.wooProductId,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    image: product.image,
    currency: product.currency,
    discountRule: product.discountRule,
    status: product.status,
    visibility: product.visibility,
    options: product.options,
  })),
}
const clientCatalog = {
  ...catalog,
  products: publicProducts.map((product) => {
    const {
      shortDescriptionHtml: _shortDescriptionHtml,
      shortDescription: _shortDescription,
      descriptionHtml: _descriptionHtml,
      description: _description,
      categoryDetails: _categoryDetails,
      images: _images,
      wooProductId: _wooProductId,
      skuSource: _skuSource,
      legacySlugs: _legacySlugs,
      status: _status,
      visibility: _visibility,
      published: _published,
      purchasable: _purchasable,
      contentTemplate: _contentTemplate,
      molecularStructureImage: _molecularStructureImage,
      shippingRestrictions: _shippingRestrictions,
      logisticsApproved: _logisticsApproved,
      ...clientProduct
    } = product
    return {
      ...clientProduct,
      options: product.options.map((variant) => {
        const {
          wooVariantId: _wooVariantId,
          skuSource: _variantSkuSource,
          attributes: _attributes,
          price: _price,
          regularPrice: _regularPrice,
          logisticsApproved: _variantLogisticsApproved,
          ...clientVariant
        } = variant
        return clientVariant
      }),
    }
  }),
}
const accessManifest = {
  published: publicProducts.map((product) => product.slug).sort(),
  redirects: Object.fromEntries(publicProducts.flatMap((product) => product.legacySlugs.map((legacySlug) => {
    let decoded = legacySlug
    try { decoded = decodeURIComponent(legacySlug) } catch { /* retain the literal legacy slug */ }
    return [cleanSlug(decoded), product.slug]
  }))),
  retired: retiredProducts,
}

await mkdir(resolve('server'), { recursive: true })
await writeFile(resolve('catalog/catalog.generated.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
await writeFile(resolve('src/catalog.generated.json'), `${JSON.stringify(clientCatalog, null, 2)}\n`, 'utf8')
await writeFile(resolve('server/catalog.generated.json'), `${JSON.stringify(serverCatalog, null, 2)}\n`, 'utf8')
await writeFile(resolve('catalog/product-route-access.generated.json'), `${JSON.stringify(accessManifest, null, 2)}\n`, 'utf8')
await writeFile(resolve('catalog/product-route-access.generated.js'), `export default ${JSON.stringify(accessManifest, null, 2)}\n`, 'utf8')

console.log(`Generated catalog ${version}: ${publicProducts.length} products and ${publicProducts.reduce((sum, product) => sum + product.options.length, 0)} variants.`)
