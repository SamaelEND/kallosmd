// Script nativo de validación SEO sobre el directorio compilado dist/
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
let errors = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ SEO Error: ${message}`)
    errors++
  } else {
    console.log(`✅ ${message}`)
  }
}

function countVisibleWords(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) return 0
  const text = bodyMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.split(' ').length : 0
}

function validateLandingPage(relPath, expectedLang, expectedCanonical) {
  const fullPath = resolve(distDir, relPath)
  assert(existsSync(fullPath), `${relPath} existe en dist/`)
  if (!existsSync(fullPath)) return

  const html = readFileSync(fullPath, 'utf-8')

  assert(
    new RegExp(`<html[^>]*\\blang="${expectedLang}"`, 'i').test(html),
    `${relPath} tiene <html lang="${expectedLang}">`,
  )

  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)]
  assert(titles.length === 1, `${relPath} tiene exactamente 1 <title>`)
  if (titles.length === 1) {
    const titleLen = titles[0][1].trim().length
    assert(titleLen > 10 && titleLen <= 60, `${relPath} title longitud (${titleLen}) ≤ 60`)
  }

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)
  assert(Boolean(descMatch), `${relPath} tiene meta description`)
  if (descMatch) {
    const descLen = descMatch[1].trim().length
    assert(descLen >= 70 && descLen <= 155, `${relPath} description longitud (${descLen}) ≤ 155`)
  }

  assert(!/<meta\s+name="keywords"/i.test(html), `${relPath} no incluye meta keywords obsoleto`)
  assert(
    !/\b(obsidian|typora|notion)\b/i.test(html),
    `${relPath} no menciona marcas comerciales de terceros`,
  )

  const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)
  assert(
    canonicalMatch && canonicalMatch[1] === expectedCanonical,
    `${relPath} tiene canonical autorreferenciado (${expectedCanonical})`,
  )

  assert(
    /<link\s+rel="alternate"\s+hreflang="en"\s+href="https:\/\/kallosmd\.xyz\/"/i.test(html) &&
    /<link\s+rel="alternate"\s+hreflang="es"\s+href="https:\/\/kallosmd\.xyz\/es\/"/i.test(html) &&
    /<link\s+rel="alternate"\s+hreflang="x-default"\s+href="https:\/\/kallosmd\.xyz\/"/i.test(html),
    `${relPath} incluye hreflang recíprocos (en, es, x-default)`,
  )

  assert(
    /<meta\s+property="og:image"\s+content="https:\/\/kallosmd\.xyz\/og-image\.png"/i.test(html) &&
    /<meta\s+property="og:image:width"\s+content="1200"/i.test(html) &&
    /<meta\s+property="og:image:height"\s+content="630"/i.test(html),
    `${relPath} configura og:image 1200x630`,
  )

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
  assert(h1Matches.length === 1, `${relPath} tiene exactamente 1 <h1>`)

  const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)
  assert(Boolean(jsonLdMatch), `${relPath} incluye JSON-LD`)
  if (jsonLdMatch) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1])
      assert(
        parsed['@type'] === 'WebApplication' &&
          parsed.inLanguage === expectedLang &&
          parsed.url === expectedCanonical,
        `${relPath} JSON-LD es válido y coincide con inLanguage="${expectedLang}" y url="${expectedCanonical}"`,
      )
    } catch {
      assert(false, `${relPath} JSON-LD parsea como JSON válido`)
    }
  }

  assert(!/<script[^>]+src="\/assets\//i.test(html), `${relPath} no carga el bundle pesado del editor`)

  const words = countVisibleWords(html)
  assert(words >= 500, `${relPath} contiene suficiente contenido semántico (${words} palabras ≥ 500)`)
}

validateLandingPage('index.html', 'en', 'https://kallosmd.xyz/')
validateLandingPage('es/index.html', 'es', 'https://kallosmd.xyz/es/')

const rootHtml = readFileSync(resolve(distDir, 'index.html'), 'utf-8')
assert(
  rootHtml.includes('google-site-verification') &&
  rootHtml.includes('X2qo0v9Hs-mlRzuW0hbKbN2zPOcVICbCQ-4LcujKwNg'),
  'index.html conserva google-site-verification',
)

const appHtmlPath = resolve(distDir, 'app/index.html')
assert(existsSync(appHtmlPath), 'app/index.html existe en dist/')
if (existsSync(appHtmlPath)) {
  const appHtml = readFileSync(appHtmlPath, 'utf-8')
  assert(
    /<meta\s+name="robots"\s+content="noindex,\s*follow"/i.test(appHtml),
    'app/index.html tiene meta robots="noindex, follow"',
  )
}

assert(existsSync(resolve(distDir, '404.html')), '404.html existe en dist/')
assert(existsSync(resolve(distDir, 'og-image.png')), 'og-image.png existe en dist/')
assert(existsSync(resolve(distDir, 'robots.txt')), 'robots.txt existe en dist/')

const sitemapPath = resolve(distDir, 'sitemap.xml')
assert(existsSync(sitemapPath), 'sitemap.xml existe en dist/')
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, 'utf-8')
  assert(
    sitemap.includes('https://kallosmd.xyz/') &&
    sitemap.includes('https://kallosmd.xyz/es/') &&
    !sitemap.includes('/app/'),
    'sitemap.xml lista / y /es/ con alternates y excluye /app/',
  )
}

if (errors > 0) {
  console.error(`\nFallaron ${errors} comprobaciones de SEO.`)
  process.exit(1)
} else {
  console.log('\n🎉 Todas las comprobaciones de SEO pasaron correctamente.')
}

