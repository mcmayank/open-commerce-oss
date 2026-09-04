import { test, expect } from '@playwright/test'

/**
 * One store, from nothing to a sale-ready storefront. Serial on purpose: each
 * step is the precondition of the next, exactly as a merchant's first hour is.
 */
test.describe.serial('single-store build, from an empty database', () => {
  const owner = { email: 'owner@example.com', password: 'Smoke-pass-word-1!' }

  test('the admin is reachable before any user exists', async ({ page }) => {
    const res = await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(200)
  })

  test('the first user registers, signs in and sets up the store', async ({ page }) => {
    const first = await page.request.post('/api/users/first-register', { data: owner })
    expect(first.ok(), await first.text()).toBeTruthy()

    const login = await page.request.post('/api/users/login', { data: owner })
    expect(login.ok(), await login.text()).toBeTruthy()

    const me = await page.request.get('/api/users/me')
    expect((await me.json()).user?.email).toBe(owner.email)

    const settings = await page.request.post('/api/store-settings', {
      data: { storeName: 'Smoke Store', currency: 'AED' },
    })
    expect(settings.status(), await settings.text()).toBe(201)

    const category = await page.request.post('/api/categories', {
      data: { title: 'Loaves', slug: 'loaves' },
    })
    expect(category.status(), await category.text()).toBe(201)

    const product = await page.request.post('/api/products', {
      data: { title: 'Sourdough', slug: 'sourdough', price: 2500, stock: 10, status: 'active' },
    })
    expect(product.status(), await product.text()).toBe(201)

    // The owner lands on the dashboard, not back on the login form.
    const admin = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    expect(admin?.status()).toBe(200)
    await expect(page).not.toHaveURL(/\/admin\/login/)
  })

  test('a shopper sees the store, the catalogue and the product', async ({ page }) => {
    const home = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(home?.status()).toBe(200)
    await expect(page).toHaveTitle(/Smoke Store/)
    // The self-hosted build never carries the platform's line.
    await expect(page.getByText('Powered by Niblr')).toHaveCount(0)

    await page.goto('/products', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('link', { name: /Sourdough/ }).first()).toBeVisible()

    const product = await page.goto('/products/sourdough', { waitUntil: 'domcontentloaded' })
    expect(product?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /Sourdough/ }).first()).toBeVisible()

    const cart = await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    expect(cart?.status()).toBe(200)
  })

  test('the catalogue is not readable anonymously through the API', async ({ request }) => {
    const res = await request.get('/api/products')
    expect(res.status()).toBe(403)
  })

  test('a missing page is a branded 404, not a crash', async ({ page }) => {
    const res = await page.goto('/no-such-page', { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: /nothing at this address/i })).toBeVisible()
  })

  test('robots and the sitemap point search engines at this store', async ({ request }) => {
    const robots = await request.get('/robots.txt')
    expect(robots.ok()).toBeTruthy()
    expect(await robots.text()).toContain('Sitemap: http://localhost:3000/sitemap.xml')

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.ok()).toBeTruthy()
    expect(await sitemap.text()).toContain('http://localhost:3000/products/sourdough')
  })
})
