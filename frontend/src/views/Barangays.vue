<template>
  <div class="barangays-container admin-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Municipal Coverage & Barangay Matrix</h1>
        <p class="page-subtitle">Urban district monitoring, weekly garbage collection timetables, and incident density.</p>
        <p v-if="errorMessage" class="text-red" role="alert">{{ errorMessage }}</p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" :disabled="isLoading" @click="loadBarangays()">
          {{ isLoading ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button type="button" class="btn btn-primary" @click="openAddForm">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Add Barangay</span>
        </button>
      </div>
    </div>

    <!-- Summary Metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">BARANGAY COVERAGE</span>
        <div class="metric-val">{{ barangaysWithScheduleTargets.length }}</div>
        <span class="metric-sub">Registered and report-discovered barangays</span>
        <svg class="mini-sparkline green" viewBox="0 0 100 32" aria-hidden="true" focusable="false">
          <polyline points="2,26 16,24 28,17 40,20 54,10 66,14 80,5 92,9 99,2" />
        </svg>
      </div>

      <div class="metric-card">
        <span class="metric-label">ACTIVE INCIDENTS</span>
        <div class="metric-val text-yellow">{{ activeIncidents }}</div>
        <span class="metric-sub">Pending or currently under collection</span>
        <svg class="mini-sparkline amber" viewBox="0 0 100 32" aria-hidden="true" focusable="false">
          <polyline points="2,27 16,21 28,24 40,14 54,17 66,9 80,13 92,5 99,2" />
        </svg>
      </div>

      <div class="metric-card">
        <span class="metric-label">RESOLVED REPORTS</span>
        <div class="metric-val text-green">{{ resolvedIncidents }}</div>
        <span class="metric-sub">Successfully cleared by CLENRO units</span>
        <svg class="mini-sparkline green" viewBox="0 0 100 32" aria-hidden="true" focusable="false">
          <polyline points="2,27 16,25 28,18 40,20 54,11 66,14 80,7 92,9 99,2" />
        </svg>
      </div>

      <div class="metric-card">
        <span class="metric-label">COLLECTION SCHEDULES</span>
        <div class="metric-val text-blue">{{ areaRouteCount }}</div>
        <span class="metric-sub">Purok, zone, and street routes</span>
        <svg class="mini-sparkline blue" viewBox="0 0 100 32" aria-hidden="true" focusable="false">
          <polyline points="2,27 16,24 28,16 40,19 54,11 66,14 80,6 92,9 99,2" />
        </svg>
      </div>
    </div>

    <!-- Coverage Table -->
    <div class="table-card">
      <div class="table-card-header">
        <div>
          <h2 class="panel-title">Barangay Coverage & Weekly Schedules</h2>
          <span class="panel-subtitle">Incident load and dedicated garbage collection trucks</span>
        </div>

        <div class="table-search">
          <input
            v-model="search"
            type="search"
            placeholder="Search by barangay or district..."
          />
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>BARANGAY</th>
            <th>DISTRICT</th>
            <th>ACTIVE REPORTS</th>
            <th>RESOLVED</th>
            <th>COLLECTION SCHEDULE</th>
            <th>ASSIGNED TRUCK</th>
            <th>STATUS</th>
            <th class="text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in filteredBarangays"
            :key="b.id || b._id || b.name"
            class="table-row"
            @click="viewBarangay(b)"
          >
            <td>
              <span class="barangay-title">Brgy. {{ b.name }}</span>
            </td>
            <td>
              <span class="district-badge font-mono">{{ b.district || 'Sign-up area' }}</span>
            </td>
            <td>
              <span class="active-badge font-mono">{{ b.active || 0 }}</span>
            </td>
            <td>
              <span class="resolved-badge font-mono">{{ b.resolved || 0 }}</span>
            </td>
            <td>
              <div v-if="getBarangaySchedule(b.name)" class="schedule-text">
                <template v-if="hasBarangayWideSchedule(getBarangaySchedule(b.name))">
                  <span
                    v-if="isSampleOnlySchedule(getBarangaySchedule(b.name))"
                    class="sample-schedule-warning"
                  >
                    SAMPLE — NOT OFFICIAL
                  </span>
                  <span class="days-text">{{ getBarangaySchedule(b.name).biodegradableDays }} / {{ getBarangaySchedule(b.name).nonBiodegradableDays }}</span>
                  <span class="time-text font-mono">{{ getBarangaySchedule(b.name).timeSlot }}</span>
                </template>
                <span v-else class="time-text">{{ getBarangaySchedule(b.name).areaSchedules?.length || 0 }} area-specific routes</span>
              </div>
              <span v-else class="text-muted">No collection schedule</span>
            </td>
            <td>
              <span v-if="hasBarangayWideSchedule(getBarangaySchedule(b.name))" class="truck-pill font-mono">
                {{ getBarangaySchedule(b.name).assignedTruck }}
              </span>
              <span v-else-if="getBarangaySchedule(b.name)?.areaSchedules?.length" class="text-muted">Assigned by area</span>
              <span v-else class="text-muted">Not assigned</span>
            </td>
            <td>
              <span class="status-badge" :class="b.status === 'Active' ? 'active-status' : ''">{{ b.status }}</span>
            </td>
            <td class="text-right" @click.stop>
              <div class="action-buttons">
                <button type="button" class="action-btn" @click="openScheduleForm(b)">
                  {{ getBarangaySchedule(b.name) ? 'Manage Schedule' : 'Set Schedule' }}
                </button>
                <button type="button" class="action-btn" @click="viewBarangay(b)">
                  Inspect
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="filteredBarangays.length === 0">
            <td colspan="8" class="empty-state">
              No barangays found matching "{{ search }}".
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Barangay Details Drawer / Modal -->
    <div v-if="selectedBarangay" class="modal-backdrop" @click.self="closeBarangay">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <span class="modal-kicker">MUNICIPAL DISTRICT INSPECTION</span>
            <h3 class="modal-title">Brgy. {{ selectedBarangay.name }}</h3>
          </div>
          <button class="modal-close" @click="closeBarangay">✕</button>
        </div>

        <div class="modal-body">
          <div class="details-grid">
            <div class="detail-item">
              <span class="item-label">Congressional District</span>
              <strong class="item-val">{{ selectedBarangay.district }}</strong>
            </div>
            <div class="detail-item">
              <span class="item-label">Active Incident Tickets</span>
              <strong class="item-val text-yellow">{{ selectedBarangay.active || 0 }} reports</strong>
            </div>
            <div class="detail-item">
              <span class="item-label">Resolved Cleanups</span>
              <strong class="item-val text-green">{{ selectedBarangay.resolved || 0 }} completed</strong>
            </div>
            <div class="detail-item">
              <span class="item-label">District Status</span>
              <strong class="item-val">{{ selectedBarangay.status }}</strong>
            </div>
          </div>

          <div v-if="getBarangaySchedule(selectedBarangay.name)" class="schedule-box">
            <span class="schedule-box-title">Collection Timetable</span>
            <div v-if="hasBarangayWideSchedule(getBarangaySchedule(selectedBarangay.name))" class="area-schedule">
              <strong class="area-schedule-name">Barangay-wide schedule</strong>
              <div class="schedule-box-row"><span>Biodegradable:</span><strong>{{ getBarangaySchedule(selectedBarangay.name).biodegradableDays }}</strong></div>
              <div class="schedule-box-row"><span>Non-biodegradable:</span><strong>{{ getBarangaySchedule(selectedBarangay.name).nonBiodegradableDays }}</strong></div>
              <div class="schedule-box-row"><span>Collection window:</span><strong>{{ getBarangaySchedule(selectedBarangay.name).timeSlot }}</strong></div>
              <div class="schedule-box-row"><span>Assigned truck:</span><strong>{{ getBarangaySchedule(selectedBarangay.name).assignedTruck }}</strong></div>
            </div>
            <div
              v-for="area in getBarangaySchedule(selectedBarangay.name).areaSchedules || []"
              :key="area._id || area.areaName"
              class="area-schedule"
            >
              <strong class="area-schedule-name">{{ area.areaName }}</strong>
              <span v-if="area.isSample" class="sample-schedule-warning">
                SAMPLE ONLY — not an official or confirmed CLENRO route
              </span>
              <div class="schedule-box-row"><span>Biodegradable:</span><strong>{{ area.biodegradableDays }}</strong></div>
              <div class="schedule-box-row"><span>Non-biodegradable:</span><strong>{{ area.nonBiodegradableDays }}</strong></div>
              <div class="schedule-box-row"><span>Collection window:</span><strong>{{ area.timeSlot }}</strong></div>
              <div class="schedule-box-row"><span>Assigned truck:</span><strong>{{ area.assignedTruck }}</strong></div>
            </div>
          </div>
          <p v-else class="text-muted schedule-empty">No collection schedule has been set for this barangay.</p>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeBarangay">Close</button>
            <button type="button" class="btn btn-secondary" @click="openScheduleForm(selectedBarangay)">
              {{ getBarangaySchedule(selectedBarangay.name) ? 'Manage Schedule' : 'Set Schedule' }}
            </button>
            <button class="btn btn-primary" @click="goToTicketsForBarangay(selectedBarangay.name)">
              View Barangay Incident Feed
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Collection Schedule Modal -->
    <div v-if="showScheduleForm" class="modal-backdrop" @click.self="closeScheduleForm">
      <div class="modal-card schedule-modal">
        <div class="modal-header">
          <div>
            <span class="modal-kicker">WASTE COLLECTION TIMETABLE</span>
            <h3 class="modal-title">Manage Brgy. {{ scheduleForm.barangay }} Collection Routes</h3>
          </div>
          <button type="button" class="modal-close" :disabled="isSavingSchedule" aria-label="Close" @click="closeScheduleForm">✕</button>
        </div>

        <form class="modal-form" @submit.prevent="saveSchedule">
          <p v-if="scheduleError" class="text-red" role="alert">{{ scheduleError }}</p>
          <p class="schedule-help">
            Add a separate route for each purok, zone, or street. Use an area name present in the resident's sign-up location (for example, "Zone 3" or "Acacia Street"). Enter only collection details confirmed by CLENRO.
          </p>
          <section
            v-for="(area, index) in scheduleForm.areaSchedules"
            :key="area._id || `area-${index}`"
            class="area-route-form"
          >
            <div class="area-route-heading">
              <strong>Area route {{ index + 1 }}</strong>
              <button type="button" class="action-btn" :disabled="isSavingSchedule" @click="removeAreaSchedule(index)">
                Remove
              </button>
            </div>
            <div class="form-item">
              <label :for="`area-name-${index}`">Purok, zone, or street</label>
              <input :id="`area-name-${index}`" v-model="area.areaName" class="form-input" type="text" maxlength="160" placeholder="e.g. Zone 3, Acacia Street" />
            </div>
            <label class="route-option">
              <input v-model="area.appliesToAllAreas" type="checkbox" />
              Use as a sample fallback for residents without an exact area match
            </label>
            <label class="route-option">
              <input v-model="area.isOfficial" type="checkbox" />
              Confirmed by CLENRO (uncheck for sample or unverified data)
            </label>
            <div class="area-route-grid">
              <div class="form-item">
                <label :for="`area-bio-${index}`">Biodegradable days</label>
                <input :id="`area-bio-${index}`" v-model="area.biodegradableDays" class="form-input" type="text" placeholder="Verified collection days" />
              </div>
              <div class="form-item">
                <label :for="`area-nonbio-${index}`">Non-biodegradable days</label>
                <input :id="`area-nonbio-${index}`" v-model="area.nonBiodegradableDays" class="form-input" type="text" placeholder="Verified collection days" />
              </div>
              <div class="form-item">
                <label :for="`area-time-${index}`">Collection time window</label>
                <input :id="`area-time-${index}`" v-model="area.timeSlot" class="form-input" type="text" placeholder="e.g. 06:00 AM - 10:00 AM" />
              </div>
              <div class="form-item">
                <label :for="`area-truck-${index}`">Assigned truck</label>
                <input :id="`area-truck-${index}`" v-model="area.assignedTruck" class="form-input" type="text" placeholder="Confirmed truck" />
              </div>
            </div>
            <p v-if="area.isSample" class="sample-schedule-warning">
              SAMPLE ONLY — not an official or confirmed CLENRO route
            </p>
          </section>
          <button type="button" class="btn btn-secondary" :disabled="isSavingSchedule" @click="addAreaSchedule">
            Add Purok / Zone / Street Route
          </button>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" :disabled="isSavingSchedule" @click="closeScheduleForm">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="isSavingSchedule">
              {{ isSavingSchedule ? 'Saving...' : 'Save Schedule' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Sector Modal -->
    <div v-if="showAddForm" class="modal-backdrop" @click.self="closeAddForm">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Register Barangay Sector</h3>
          <button class="modal-close" @click="closeAddForm">✕</button>
        </div>

        <form @submit.prevent="addBarangay" class="modal-form">
          <div class="form-item">
            <label>Barangay Name</label>
            <input v-model="newBarangay.name" type="text" placeholder="e.g. Puntod" class="form-input" required />
          </div>

          <div class="form-item">
            <label>District</label>
            <select v-model="newBarangay.district" class="form-input select-input">
              <option>District 1</option>
              <option>District 2</option>
              <option>District 3</option>
            </select>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeAddForm">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Sector</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { barangayApi, scheduleApi } from '../services/api'
import { loadSettings, settingsState } from '../services/settingsStore'

const router = useRouter()

const search = ref('')
const selectedBarangay = ref(null)
const showAddForm = ref(false)
const showScheduleForm = ref(false)
const isLoading = ref(true)
const isSavingSchedule = ref(false)
const editingSchedule = ref(null)
const scheduleError = ref('')

const newBarangay = ref({
  name: '',
  district: 'District 1'
})

const scheduleForm = ref({
  barangay: '',
  biodegradableDays: '',
  nonBiodegradableDays: '',
  timeSlot: '',
  assignedTruck: '',
  areaSchedules: []
})

const barangays = ref([])
const schedules = ref([])
const errorMessage = ref('')
let refreshTimer = null

async function loadBarangays(isBackground = false) {
  try {
    if (!isBackground) isLoading.value = true
    const [bgRes, schRes] = await Promise.all([
      barangayApi.getAll(),
      scheduleApi.getAll()
    ])
    if (bgRes && bgRes.data) {
      barangays.value = bgRes.data
    }
    if (schRes && schRes.data) {
      schedules.value = schRes.data
    }
    errorMessage.value = ''
  } catch (err) {
    console.error('Failed to load barangays:', err)
    errorMessage.value = err.message || 'Unable to load barangay data.'
  } finally {
    if (!isBackground) isLoading.value = false
  }
}

function getBarangaySchedule(name) {
  if (!name) return null
  return schedules.value.find(s => (s.barangay || '').toLowerCase() === name.toLowerCase())
}

function hasBarangayWideSchedule(schedule) {
  return Boolean(
    schedule?.biodegradableDays &&
    schedule?.nonBiodegradableDays &&
    schedule?.timeSlot &&
    schedule?.assignedTruck
  )
}

function isSampleOnlySchedule(schedule) {
  return Boolean(
    schedule?.areaSchedules?.length &&
    schedule.areaSchedules.every(area => area.isSample)
  )
}

function mapAreaScheduleForForm(area) {
  return {
    ...area,
    appliesToAllAreas: Boolean(area.appliesToAllAreas),
    isOfficial: area.isSample === false
  }
}

const areaRouteCount = computed(() =>
  schedules.value.reduce((count, schedule) => count + (schedule.areaSchedules?.length || 0), 0)
)

function updateRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = settingsState.system.autoRefresh
    ? setInterval(() => { void loadBarangays(true) }, 30000)
    : null
}

watch(() => settingsState.system.autoRefresh, updateRefreshTimer)

onMounted(async () => {
  try {
    await loadSettings()
  } catch (err) {
    console.error('Failed to load barangay refresh preference:', err)
  }
  await loadBarangays()
  updateRefreshTimer()
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const activeIncidents = computed(() => barangays.value.reduce((total, b) => total + (b.active || 0), 0))
const resolvedIncidents = computed(() => barangays.value.reduce((total, b) => total + (b.resolved || 0), 0))

const barangaysWithScheduleTargets = computed(() => {
  return barangays.value
})

const filteredBarangays = computed(() => {
  const kw = search.value.toLowerCase().trim()
  if (!kw) return barangaysWithScheduleTargets.value

  return barangaysWithScheduleTargets.value.filter(b => {
    return b.name.toLowerCase().includes(kw) || (b.district || '').toLowerCase().includes(kw)
  })
})

function viewBarangay(b) {
  selectedBarangay.value = b
}

function closeBarangay() {
  selectedBarangay.value = null
}

function openScheduleForm(barangayRecord) {
  const existing = getBarangaySchedule(barangayRecord.name)
  editingSchedule.value = existing
  scheduleForm.value = {
    barangay: barangayRecord.name,
    biodegradableDays: existing?.biodegradableDays || '',
    nonBiodegradableDays: existing?.nonBiodegradableDays || '',
    timeSlot: existing?.timeSlot || '',
    assignedTruck: existing?.assignedTruck || '',
    areaSchedules: (existing?.areaSchedules || []).map(mapAreaScheduleForForm)
  }
  scheduleError.value = ''
  showScheduleForm.value = true
}

function addAreaSchedule() {
  scheduleForm.value.areaSchedules.push({
    areaName: '',
    appliesToAllAreas: false,
    isOfficial: false,
    biodegradableDays: '',
    nonBiodegradableDays: '',
    timeSlot: '',
    assignedTruck: ''
  })
}

function removeAreaSchedule(index) {
  scheduleForm.value.areaSchedules.splice(index, 1)
}

function closeScheduleForm() {
  if (isSavingSchedule.value) return
  showScheduleForm.value = false
  scheduleError.value = ''
}

async function saveSchedule() {
  const areaSchedules = scheduleForm.value.areaSchedules.map(area => ({
    areaName: area.areaName.trim(),
    appliesToAllAreas: Boolean(area.appliesToAllAreas),
    isSample: !area.isOfficial,
    biodegradableDays: area.biodegradableDays.trim(),
    nonBiodegradableDays: area.nonBiodegradableDays.trim(),
    timeSlot: area.timeSlot.trim(),
    assignedTruck: area.assignedTruck.trim()
  }))
  const normalizedAreaNames = areaSchedules.map(area => area.areaName.toLowerCase())
  const requiredAreaFields = [
    'areaName',
    'biodegradableDays',
    'nonBiodegradableDays',
    'timeSlot',
    'assignedTruck'
  ]

  if (areaSchedules.length === 0 ||
      areaSchedules.some(area => requiredAreaFields.some(field => !area[field]))) {
    scheduleError.value = 'Add at least one complete purok, zone, or street schedule before saving.'
    return
  }
  if (new Set(normalizedAreaNames).size !== normalizedAreaNames.length) {
    scheduleError.value = 'Each area must have a unique name within this barangay.'
    return
  }

  const payload = {
    barangay: scheduleForm.value.barangay.trim(),
    areaSchedules
  }

  isSavingSchedule.value = true
  scheduleError.value = ''
  try {
    let response
    if (editingSchedule.value) {
      const id = editingSchedule.value._id || editingSchedule.value.id
      if (!id) throw new Error('This schedule cannot be updated because it has no record ID.')
      response = await scheduleApi.update(id, payload)
    } else {
      response = await scheduleApi.create(payload)
    }

    if (!response?.data) throw new Error('The server did not return the saved schedule.')
    const savedSchedule = response.data
    const existingIndex = schedules.value.findIndex(schedule =>
      (savedSchedule._id && schedule._id === savedSchedule._id) ||
      schedule.barangay.toLowerCase() === payload.barangay.toLowerCase()
    )
    if (existingIndex === -1) {
      schedules.value.push(savedSchedule)
    } else {
      schedules.value.splice(existingIndex, 1, savedSchedule)
    }
    showScheduleForm.value = false
  } catch (err) {
    console.error('Failed to save collection schedule:', err)
    scheduleError.value = err.message || 'Unable to save the collection schedule.'
  } finally {
    isSavingSchedule.value = false
  }
}

function openAddForm() {
  newBarangay.value = { name: '', district: 'District 1' }
  showAddForm.value = true
}

function closeAddForm() {
  showAddForm.value = false
}

async function addBarangay() {
  if (!newBarangay.value.name.trim()) return

  const payload = {
    name: newBarangay.value.name.trim(),
    district: newBarangay.value.district
  }

  try {
    const response = await barangayApi.create(payload)
    barangays.value.push(response.data)
    errorMessage.value = ''
    closeAddForm()
  } catch (err) {
    console.error('Failed to add barangay:', err)
    errorMessage.value = err.message || 'Unable to add barangay.'
  }
}

function goToTicketsForBarangay(name) {
  router.push({ path: '/tickets', query: { q: name } })
}
</script>

<style scoped>
.barangays-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-main);
}

.page-subtitle {
  margin: 3px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.btn-secondary {
  background-color: var(--bg-surface);
  color: var(--text-main);
  border: 1px solid var(--border-muted);
}

.btn-secondary:hover {
  background-color: var(--bg-surface-elevated);
}

.btn-primary {
  background-color: var(--primary);
  color: #ffffff;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
}

/* Metrics */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.metric-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
}

.metric-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  font-family: var(--font-mono);
}

.metric-val {
  margin: 8px 0 4px;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-main);
  font-family: var(--font-mono);
}

.text-yellow { color: var(--status-pending); }
.text-green { color: var(--primary); }
.text-blue { color: var(--accent-sage); }

.metric-sub {
  font-size: 11px;
  color: var(--text-muted);
}

/* Table */
.table-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
}

.table-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.panel-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}

.table-search input {
  background-color: var(--bg-input);
  border: 1px solid var(--border-muted);
  border-radius: 6px;
  padding: 6px 12px;
  color: var(--text-main);
  font-size: 12px;
  width: 260px;
  outline: none;
}

.data-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.data-table th {
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  padding: 10px 16px;
  font-family: var(--font-mono);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-main);
}

.table-row {
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.table-row:hover {
  background-color: var(--bg-card-hover);
}

.barangay-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.district-badge {
  font-size: 11px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-muted);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-secondary);
}

.active-badge {
  font-size: 12px;
  font-weight: 700;
  color: var(--status-pending);
}

.resolved-badge {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}

.schedule-text {
  display: flex;
  flex-direction: column;
}

.days-text {
  font-size: 12px;
  font-weight: 500;
}

.time-text {
  font-size: 10px;
  color: var(--text-muted);
}

.truck-pill {
  font-size: 11px;
  color: var(--accent-sage);
}

.status-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.active-status {
  background-color: var(--status-resolved-bg);
  color: var(--status-resolved);
}

.action-btn {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-muted);
  color: var(--text-main);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.action-btn:hover {
  background-color: var(--bg-surface-elevated);
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.text-right {
  text-align: right;
}

.empty-state {
  text-align: center;
  padding: 30px !important;
  color: var(--text-muted);
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  width: 100%;
  max-width: 460px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-muted);
  border-radius: 8px;
  padding: 24px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-kicker {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  font-family: var(--font-mono);
}

.modal-title {
  margin: 2px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-label {
  font-size: 11px;
  color: var(--text-muted);
}

.item-val {
  font-size: 13px;
  color: var(--text-main);
}

.schedule-box {
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.schedule-empty {
  margin: 0 0 20px;
}

.schedule-modal {
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.schedule-box-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 4px;
}

.schedule-box-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.area-schedule + .area-schedule {
  border-top: 1px solid var(--border-subtle);
  margin-top: 8px;
  padding-top: 10px;
}

.area-schedule-name {
  color: var(--text-main);
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
}

.sample-schedule-warning {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 5px;
  color: #9a3412;
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 6px;
  padding: 4px 6px;
}

.route-option {
  align-items: flex-start;
  color: var(--text-secondary);
  display: flex;
  font-size: 12px;
  gap: 8px;
}

.route-option input {
  margin-top: 2px;
}

.schedule-help {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

.area-route-form {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.area-route-heading {
  align-items: center;
  color: var(--text-main);
  display: flex;
  font-size: 12px;
  justify-content: space-between;
}

.area-route-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.area-route-grid .form-item {
  min-width: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-item label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-input {
  background-color: var(--bg-input);
  border: 1px solid var(--border-muted);
  border-radius: 6px;
  color: var(--text-main);
  font-size: 13px;
  padding: 8px 10px;
  outline: none;
}

.form-input:focus {
  border-color: var(--primary);
}

@media (max-width: 640px) {
  .area-route-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>