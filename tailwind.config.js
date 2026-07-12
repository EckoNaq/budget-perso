import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Resolve content globs relative to THIS config file, so styles compile
// correctly regardless of the process working directory. Use forward slashes
// (fast-glob does not match backslash paths on Windows).
const dir = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [`${dir}/index.html`, `${dir}/src/**/*.{ts,tsx}`],
  theme: {
    extend: {
      colors: {
        // Univers accent colors (calm, distinguishable in light + dark)
        univers: {
          revenus: '#2f9e6b',
          logement: '#5b7fbd',
          vehicule: '#c98a3b',
          quotidien: '#7c6fb0',
          loisirs: '#c2607f',
        },
      },
    },
  },
  plugins: [],
}
