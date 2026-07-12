import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Point Tailwind at this project's config explicitly, so it works regardless
// of the process working directory.
const dir = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')

export default {
  plugins: {
    tailwindcss: { config: `${dir}/tailwind.config.js` },
    autoprefixer: {},
  },
}
