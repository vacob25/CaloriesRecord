import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AddMealScreen } from '../features/add-meal/AddMealScreen'
import { ExerciseFormScreen } from '../features/gym/ExerciseFormScreen'
import { ExerciseScreen } from '../features/gym/ExerciseScreen'
import { ExercisesScreen } from '../features/gym/ExercisesScreen'
import { GymScreen } from '../features/gym/GymScreen'
import { SessionScreen } from '../features/gym/SessionScreen'
import { SessionsScreen } from '../features/gym/SessionsScreen'
import { StartSessionScreen } from '../features/gym/StartSessionScreen'
import { PlanDayScreen } from '../features/gym/PlanDayScreen'
import { PlanFormScreen } from '../features/gym/PlanFormScreen'
import { PlanScreen } from '../features/gym/PlanScreen'
import { PlansScreen } from '../features/gym/PlansScreen'
import { LoginScreen } from '../features/auth/LoginScreen'
import { SignupScreen } from '../features/auth/SignupScreen'
import { PrivacyScreen } from '../features/privacy/PrivacyScreen'
import { FoodFormScreen } from '../features/foods/FoodFormScreen'
import { FoodsScreen } from '../features/foods/FoodsScreen'
import { RecipeFormScreen } from '../features/foods/RecipeFormScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import { OnboardingScreen } from '../features/profile/OnboardingScreen'
import { Layout } from './Layout'
import { ProfileGate } from './ProfileGate'
import { RouteError } from './RouteError'
import { ScannerPage, StatsPage, WeightPage } from './lazyPages'
import { PublicOnly, RequireAuth } from './routeGuards'

export const router = createBrowserRouter([
  {
    path: '/login',
    errorElement: <RouteError />,
    element: (
      <PublicOnly>
        <LoginScreen />
      </PublicOnly>
    ),
  },
  {
    path: '/registrati',
    errorElement: <RouteError />,
    element: (
      <PublicOnly>
        <SignupScreen />
      </PublicOnly>
    ),
  },
  // Pubblica: leggibile prima di registrarsi e anche da loggati.
  { path: '/privacy', errorElement: <RouteError />, element: <PrivacyScreen /> },
  {
    path: '/benvenuto',
    errorElement: <RouteError />,
    element: (
      <RequireAuth>
        <OnboardingScreen />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    errorElement: <RouteError />,
    element: (
      <RequireAuth>
        <ProfileGate>
          <Layout />
        </ProfileGate>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'palestra', element: <GymScreen /> },
      { path: 'palestra/allenamento/nuovo', element: <StartSessionScreen /> },
      { path: 'palestra/allenamento/:id', element: <SessionScreen /> },
      { path: 'palestra/allenamenti', element: <SessionsScreen /> },
      { path: 'palestra/schede', element: <PlansScreen /> },
      { path: 'palestra/schede/nuova', element: <PlanFormScreen /> },
      { path: 'palestra/schede/:planId', element: <PlanScreen /> },
      { path: 'palestra/schede/:planId/giorno/:dayId', element: <PlanDayScreen /> },
      { path: 'palestra/esercizi', element: <ExercisesScreen /> },
      { path: 'palestra/esercizi/nuovo', element: <ExerciseFormScreen mode="new" /> },
      { path: 'palestra/esercizi/:key', element: <ExerciseScreen /> },
      { path: 'palestra/esercizi/:key/modifica', element: <ExerciseFormScreen mode="edit" /> },
      { path: 'cibi', element: <FoodsScreen /> },
      { path: 'cibi/nuovo', element: <FoodFormScreen /> },
      { path: 'cibi/ricette/nuova', element: <RecipeFormScreen /> },
      { path: 'cibi/ricette/:id', element: <RecipeFormScreen /> },
      { path: 'cibi/:id', element: <FoodFormScreen /> },
      { path: 'aggiungi', element: <AddMealScreen /> },
      { path: 'aggiungi/scanner', element: <ScannerPage /> },
      { path: 'statistiche', element: <StatsPage /> },
      { path: 'peso', element: <WeightPage /> },
      { path: 'profilo', element: <ProfileScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
