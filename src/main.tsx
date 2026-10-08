import '@fontsource-variable/plus-jakarta-sans'
import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { AuthProvider } from './app/AuthProvider'
import { ConfigErrorScreen } from './app/ConfigErrorScreen'
import { router } from './app/router'
import { UpdatePrompt } from './app/UpdatePrompt'
import { supabaseEnv } from './data/supabase'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root mancante in index.html')

createRoot(root).render(
  <StrictMode>
    {supabaseEnv.ok ? (
      <AuthProvider>
        <RouterProvider router={router} />
        <UpdatePrompt />
      </AuthProvider>
    ) : (
      <ConfigErrorScreen problems={supabaseEnv.problems} />
    )}
  </StrictMode>,
)
