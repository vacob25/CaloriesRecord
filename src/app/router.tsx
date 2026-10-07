import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AddMealScreen } from '../features/add-meal/AddMealScreen'
import { FoodsScreen } from '../features/foods/FoodsScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { StatsScreen } from '../features/stats/StatsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import { Layout } from './Layout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'cibi', element: <FoodsScreen /> },
      { path: 'aggiungi', element: <AddMealScreen /> },
      { path: 'statistiche', element: <StatsScreen /> },
      { path: 'profilo', element: <ProfileScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
