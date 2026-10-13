import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { InitialPasswordPage } from './pages/InitialPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SchedulePage } from './pages/SchedulePage'
import { CurriculumPage } from './pages/CurriculumPage'
import { GradesPage } from './pages/GradesPage'
import { MessengerPage } from './pages/MessengerPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPage } from './pages/AdminPage'
import { CertificatePage } from './pages/CertificatePage'
import { PortfolioPage } from './pages/PortfolioPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/initial_password" element={<InitialPasswordPage />} />
      <Route path="/reset_password" element={<ResetPasswordPage />} />
      <Route path="/" element={<SchedulePage />} />
      <Route path="/curriculum" element={<CurriculumPage />} />
      <Route path="/grades" element={<GradesPage />} />
      <Route path="/messages" element={<MessengerPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/certificate" element={<CertificatePage />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
