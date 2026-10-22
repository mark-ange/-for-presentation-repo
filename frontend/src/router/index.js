import { createRouter, createWebHistory } from 'vue-router'
import AdminLogin from '../views/AdminLogin.vue'
import Dashboard from '../views/Dashboard.vue'
import Tickets from '../views/Tickets.vue'
import Fleet from '../views/Fleet.vue'
import Barangays from '../views/Barangays.vue'
import Reports from '../views/Reports.vue'
import Settings from '../views/Settings.vue'
import CommunityContent from '../views/CommunityContent.vue'
import { getAuthToken } from '../services/api'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    component: AdminLogin
  },
  {
    path: '/dashboard',
    component: Dashboard
  },
  {
    path: '/tickets',
    name: 'Tickets',
    component: Tickets
  },
  {
  path: '/fleet',
  name: 'Fleet',
  component: Fleet
},
{
  path: '/barangays',
  name: 'Barangays',
  component: Barangays
},
{
  path: '/reports',
  name: 'Reports',
  component: Reports
},
{
  path: '/content',
  name: 'CommunityContent',
  component: CommunityContent
},
{
  path: '/settings',
  name: 'Settings',
  component: Settings
}
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const isAuthenticated = Boolean(getAuthToken())

  if (to.path !== '/login' && !isAuthenticated) {
    return '/login'
  }
  return true
})

export default router