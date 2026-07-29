import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AuthGate from './components/AuthGate.jsx'
import UserGate from './components/UserGate.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { UserAuthProvider } from './contexts/UserAuthContext.jsx'
import { BudgetProvider } from './contexts/BudgetContext.jsx'
import { MerchantRulesProvider } from './contexts/MerchantRulesContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <UserAuthProvider>
          <UserGate>
            <AuthProvider>
              <MerchantRulesProvider>
                <BudgetProvider>
                  <ToastProvider>
                    <ErrorBoundary>
                      <AuthGate>
                        <App />
                      </AuthGate>
                    </ErrorBoundary>
                  </ToastProvider>
                </BudgetProvider>
              </MerchantRulesProvider>
            </AuthProvider>
          </UserGate>
        </UserAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
