import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const LOCAL_API_MODULES: Record<string, string> = {
  '/api/health': '/api/health.ts',
  '/api/mealsdb': '/api/mealsdb.ts',
  '/api/openfoodfacts': '/api/openfoodfacts.ts',
}

function localApiServerPlugin(envVars: Record<string, string>): Plugin {
  return {
    name: 'pansync-local-api',
    configureServer(server) {
      if (envVars.THEMEALDB_API_KEY && !process.env.THEMEALDB_API_KEY) {
        process.env.THEMEALDB_API_KEY = envVars.THEMEALDB_API_KEY
      }
      if (envVars.OPENFOODFACTS_USER_AGENT && !process.env.OPENFOODFACTS_USER_AGENT) {
        process.env.OPENFOODFACTS_USER_AGENT = envVars.OPENFOODFACTS_USER_AGENT
      }

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? '/'
        const pathname = rawUrl.split('?')[0]
        const modulePath = LOCAL_API_MODULES[pathname]
        if (!modulePath) {
          next()
          return
        }

        try {
          const mod = (await server.ssrLoadModule(modulePath)) as {
            GET?: (request: Request) => Promise<Response>
          }

          if (typeof mod.GET !== 'function') {
            res.statusCode = 405
            res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
            return
          }

          const host = req.headers.host ?? '127.0.0.1:3000'
          const webRequest = new Request(`http://${host}${rawUrl}`, {
            method: req.method ?? 'GET',
          })
          const webResponse = await mod.GET(webRequest)

          res.statusCode = webResponse.status
          webResponse.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })
          const body = await webResponse.text()
          res.end(body)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : 'Local API handler error',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), localApiServerPlugin(envVars)],
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
