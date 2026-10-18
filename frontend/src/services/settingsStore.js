import { reactive, ref } from 'vue'
import { authApi } from './api'

const defaults = {
  notifications: {
    newReports: true,
    dispatch: true,
    resolution: true
  },
  system: {
    dashboardView: 'Executive Dashboard',
    ticketStatus: 'All Statuses',
    reportPeriod: 'Current Month',
    autoRefresh: true
  }
}

export const settingsState = reactive(structuredClone(defaults))
export const adminAlert = ref(null)

let isLoaded = false
let alertTimer

export async function loadSettings(force = false) {
  if (isLoaded && !force) return settingsState
  const response = await authApi.getSettings()
  Object.assign(settingsState.notifications, defaults.notifications, response.data.notifications)
  Object.assign(settingsState.system, defaults.system, response.data.system)
  isLoaded = true
  return settingsState
}

export async function getPreferredLandingPath(force = false) {
  try {
    await loadSettings(force)
  } catch (err) {
    console.error('Failed to load default landing page preference:', err)
    return '/dashboard'
  }

  return {
    'Executive Dashboard': '/dashboard',
    'Incident Queue': '/tickets',
    'Fleet Overview': '/fleet'
  }[settingsState.system.dashboardView] || '/dashboard'
}

export function applySettings(data) {
  if (data.notifications) Object.assign(settingsState.notifications, data.notifications)
  if (data.system) Object.assign(settingsState.system, data.system)
  isLoaded = true
}

export function publishAdminAlert(title, body) {
  adminAlert.value = { title, body, createdAt: Date.now() }
  window.clearTimeout(alertTimer)
  alertTimer = window.setTimeout(() => {
    adminAlert.value = null
  }, 7000)

  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, { body })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }
}
