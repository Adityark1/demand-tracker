// CORRECT CONFIGURATION
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- MUST HAVE THIS

export default defineConfig({
  plugins: [
    tailwindcss(), // <-- MUST BE BEFORE REACT
    react()
  ],
})