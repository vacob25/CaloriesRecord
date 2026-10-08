import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AddMealScreen } from '../features/add-meal/AddMealScreen'
import { LoginScreen } from '../features/auth/LoginScreen'
import { FoodFormScreen } from '../features/foods/FoodFormScreen'
import { FoodsScreen } from '../features/foods/FoodsScreen'
import { RecipeFormScreen } from '../features/foods/RecipeFormScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { StatsScreen } from '../features/stats/StatsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import { Layout } from './Layout'
import { PublicOnly, RequireAuth } from './routeGuards'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginScreen />
      </PublicOnly>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'cibi', element: <FoodsScreen /> },
      { path: 'cibi/nuovo', element: <FoodFormScreen /> },
      { path: 'cibi/ricette/nuova', element: <RecipeFormScreen /> },
      { path: 'cibi/ricette/:id', element: <RecipeFormScreen /> },
      { path: 'cibi/:id', element: <FoodFormScreen /> },
      { path: 'aggiungi', element: <AddMealScreen /> },
      { path: 'statistiche', element: <StatsScreen /> },
      { path: 'profilo', element: <ProfileScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
