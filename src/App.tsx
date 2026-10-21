import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { RequireSession } from './app/RequireSession'
import { LoginPage } from './features/auth/LoginPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { InvoiceEditorPage } from './features/invoices/InvoiceEditorPage'
import { InvoiceListPage } from './features/invoices/InvoiceListPage'
import { InvoicePrintPage } from './features/invoices/InvoicePrintPage'
import { NotFoundPage } from './features/NotFoundPage'
import { PersonLayout } from './features/people/PersonLayout'
import { SettingsPage } from './features/settings/SettingsPage'
import { TaxPage } from './features/tax/TaxPage'
import { TimePage } from './features/time/TimePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invoices/:invoiceId/print" element={<RequireSession><InvoicePrintPage /></RequireSession>} />
      <Route element={<RequireSession><AppShell /></RequireSession>}>
        <Route index element={<DashboardPage />} />
        <Route path="people/:personId" element={<PersonLayout />}>
          <Route index element={<Navigate to="invoices" replace />} />
          <Route path="invoices" element={<InvoiceListPage />} />
          <Route path="invoices/:invoiceId" element={<InvoiceEditorPage />} />
          <Route path="time" element={<TimePage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="tax" element={<TaxPage />} />
        </Route>
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
