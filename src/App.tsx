import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Nav } from './components/Nav'
import { Favourites } from './pages/Favourites'
import { Find } from './pages/Find'
import { Fridge } from './pages/Fridge'
import { Plan } from './pages/Plan'
import { RecipePage } from './pages/Recipe'

export function AppRoutes() {
  return (
    <div className="min-h-screen bg-cream pb-24 md:pb-12">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Find />} />
          <Route path="/recipe/:id" element={<RecipePage />} />
          <Route path="/fridge" element={<Fridge />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
