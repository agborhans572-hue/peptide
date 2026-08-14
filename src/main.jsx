import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './styles.css'

const Telemetry = lazy(() => import('./Telemetry.jsx'))
const telemetryEnabled = !['127.0.0.1', 'localhost'].includes(window.location.hostname)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<App />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
    {telemetryEnabled && <Suspense fallback={null}><Telemetry /></Suspense>}
  </StrictMode>,
)
