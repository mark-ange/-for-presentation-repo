<template>
  <div class="reports-container admin-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Civic Analytics & Operational Reports</h1>
        <p class="page-subtitle">Turnaround benchmarks, district density distribution, and resolution performance for CLENRO. Audit period: {{ settingsState.system.reportPeriod }}.</p>
        <p v-if="errorMessage" class="text-red" role="alert">{{ errorMessage }}</p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" :disabled="isRefreshing" @click="loadAnalytics">
          {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button type="button" class="btn btn-primary" @click="generateReport">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Export Audit Report (PDF)</span>
        </button>
      </div>
    </div>

    <!-- Top KPI Cards -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">AUDITED INCIDENT VOLUME</span>
        <div class="metric-val">{{ reportStats.totalReports }}</div>
        <span class="metric-sub">Reports filed by citizens</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">AVERAGE TURNAROUND</span>
        <div class="metric-val text-blue">{{ reportStats.avgResponse ?? '—' }} <span v-if="reportStats.avgResponse !== null" class="unit-text">hrs</span></div>
        <span class="metric-sub">Average time to vehicle dispatch</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">CLEARANCE RATE</span>
        <div class="metric-val text-green">{{ reportStats.resolutionRate }}</div>
        <span class="metric-sub">{{ reportStats.resolvedCount }} of {{ reportStats.totalCount }} tickets resolved</span>
      </div>
    </div>

    <!-- Charts Split -->
    <div class="charts-split">
      <!-- Barangay Distribution Bar Chart -->
      <div class="panel-card">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Reports Distribution by Barangay</h2>
            <span class="panel-subtitle">Urban district report density</span>
          </div>
        </div>

        <div class="bar-chart-container">
          <div
            v-for="item in barangayReports"
            :key="item.name"
            class="bar-group"
          >
            <span class="bar-value font-mono">{{ item.count }}</span>
            <div class="bar-plot">
              <div class="bar-slot">
                <div
                  class="bar-fill"
                  :style="{ height: `${Math.max(16, item.height)}%` }"
                ></div>
              </div>
            </div>
            <span class="bar-label">Brgy. {{ item.name }}</span>
          </div>
          <p v-if="barangayReports.length === 0" class="empty-state">No report data is available.</p>
        </div>
      </div>

      <!-- Category Breakdown -->
      <div class="panel-card">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Incident Category Breakdown</h2>
            <span class="panel-subtitle">Classification of resident reports</span>
          </div>
        </div>

        <div class="category-list">
          <div
            v-for="cat in categories"
            :key="cat.name"
            class="category-item"
          >
            <div class="category-info">
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-percent font-mono">{{ cat.percent }}%</span>
            </div>
            <div class="category-bar-bg">
              <div class="category-bar-fill" :style="{ width: `${cat.percent}%` }"></div>
            </div>
          </div>
          <p v-if="categories.length === 0" class="empty-state">No category data is available.</p>
        </div>
      </div>
    </div>

    <!-- Timeline Speed Curve -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Daily Response Speed Curve (Past 7 Days)</h2>
          <span class="panel-subtitle">Average hours from submission to first dispatch assignment</span>
        </div>
      </div>

      <div class="timeline-chart-wrap">
        <svg v-if="chartPoints.length" viewBox="0 0 700 240" class="timeline-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0"/>
            </linearGradient>
          </defs>

          <!-- Grid Lines -->
          <line x1="0" y1="40" x2="700" y2="40" stroke="var(--border-subtle)" />
          <line x1="0" y1="100" x2="700" y2="100" stroke="var(--border-subtle)" />
          <line x1="0" y1="160" x2="700" y2="160" stroke="var(--border-subtle)" />
          <line x1="0" y1="220" x2="700" y2="220" stroke="var(--border-subtle)" />

          <!-- Area -->
          <polygon :points="areaPoints" fill="url(#areaGradient)" />

          <!-- Line -->
          <polyline
            :points="linePoints"
            fill="none"
            stroke="var(--primary)"
            stroke-width="2"
            stroke-linecap="round"
          />

          <!-- Dots -->
          <circle
            v-for="p in chartPoints"
            :key="p.label"
            :cx="p.x"
            :cy="p.y"
            r="4"
            fill="var(--bg-card)"
            stroke="var(--primary)"
            stroke-width="2"
          />
        </svg>

        <div class="x-axis-row font-mono">
          <span v-for="p in responseTimes" :key="p.label">{{ p.label }}</span>
        </div>
        <p v-if="!chartPoints.length" class="empty-state">No dispatch timing data has been recorded yet.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { dashboardApi } from '../services/api'
import { loadSettings, settingsState } from '../services/settingsStore'

const reportStats = ref({
  totalReports: 0,
  avgResponse: null,
  resolutionRate: 0,
  resolvedCount: 0,
  totalCount: 0
})

const barangayReports = ref([])
const categories = ref([])
const responseTimes = ref([])
const errorMessage = ref('')
const isRefreshing = ref(false)
let refreshTimer = null

const chartPoints = computed(() => {
  const width = 700
  const height = 200
  const step = responseTimes.value.length > 1 ? width / (responseTimes.value.length - 1) : 0
  const maxValue = Math.max(
    ...responseTimes.value.filter(item => item.value !== null).map(item => item.value),
    6
  )

  return responseTimes.value
    .map((item, index) => ({ ...item, index }))
    .filter(item => item.value !== null)
    .map(item => ({
      ...item,
      x: Math.round(item.index * step),
      y: Math.round(height - (item.value / maxValue) * height) + 15
    }))
})

const linePoints = computed(() => chartPoints.value.map(p => `${p.x},${p.y}`).join(' '))

const areaPoints = computed(() => {
  if (!chartPoints.value.length) return ''
  const last = chartPoints.value[chartPoints.value.length - 1]
  return `0,220 ${linePoints.value} ${last.x},220`
})

async function loadAnalytics() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    const res = await dashboardApi.getStats(settingsState.system.reportPeriod)
    if (res && res.data) {
      const d = res.data
      reportStats.value = {
        totalReports: d.totalTickets,
        avgResponse: d.avgResponse,
        resolutionRate: `${d.resolutionRate}%`,
        resolvedCount: d.resolved,
        totalCount: d.totalTickets
      }

      const maxVal = Math.max(...d.barangayStats.map(b => b.count), 1)
      barangayReports.value = [...d.barangayStats]
        .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name))
        .map(b => ({
          name: b.name,
          count: b.count,
          height: Math.round((b.count / maxVal) * 100)
        }))
      categories.value = d.categories
      responseTimes.value = d.responseTimes
    }
    errorMessage.value = ''
  } catch (err) {
    console.error('Failed to load report analytics:', err)
    errorMessage.value = err.message || 'Unable to load report analytics.'
  } finally {
    isRefreshing.value = false
  }
}

function generateReport() {
  window.print()
}

watch(() => settingsState.system.reportPeriod, loadAnalytics)

function updateRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = settingsState.system.autoRefresh
    ? setInterval(() => { void loadAnalytics() }, 30000)
    : null
}

watch(() => settingsState.system.autoRefresh, updateRefreshTimer)

onMounted(async () => {
  try {
    await loadSettings()
  } catch (err) {
    console.error('Failed to load audit period preference:', err)
  }
  await loadAnalytics()
  updateRefreshTimer()
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.reports-container {
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
  flex-wrap: wrap;
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
  grid-template-columns: repeat(3, 1fr);
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

.text-blue { color: var(--accent-sage); }
.text-green { color: var(--primary); }

.unit-text {
  font-size: 14px;
  color: var(--text-muted);
}

.metric-sub {
  font-size: 11px;
  color: var(--text-muted);
}

/* Split */
.charts-split {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
}

.panel-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
}

.panel-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
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

/* Bar Chart */
.bar-chart-container {
  display: grid;
  grid-auto-columns: minmax(52px, 1fr);
  grid-auto-flow: column;
  align-items: stretch;
  gap: 12px;
  height: 250px;
  padding: 8px 10px 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.bar-group {
  display: grid;
  grid-template-rows: 20px minmax(0, 1fr) 52px;
  align-items: stretch;
  min-width: 0;
  height: 100%;
}

.bar-plot {
  position: relative;
  min-height: 0;
}

.bar-value {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
}

.bar-slot {
  position: absolute;
  inset: 0 auto 0 50%;
  width: min(28px, 70%);
  background-color: var(--bg-surface);
  border-radius: 5px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  transform: translateX(-50%);
}

.bar-fill {
  width: 100%;
  background-color: var(--primary);
  border-radius: 5px;
  transition: height 0.3s ease;
}

.bar-label {
  display: -webkit-box;
  align-self: start;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-muted);
  text-align: center;
  overflow-wrap: anywhere;
}

/* Category List */
.category-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.category-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.category-name {
  color: var(--text-main);
}

.category-percent {
  color: var(--text-muted);
}

.category-bar-bg {
  height: 6px;
  background-color: var(--bg-surface);
  border-radius: 4px;
  overflow: hidden;
}

.category-bar-fill {
  height: 100%;
  background-color: var(--primary);
  border-radius: 4px;
}

/* Timeline */
.timeline-chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-svg {
  width: 100%;
  height: 160px;
}

.x-axis-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  padding: 0 4px;
}

@media (max-width: 900px) {
  .charts-split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions > .btn {
    flex: 1;
    justify-content: center;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .panel-card {
    padding: 15px;
  }

  .bar-chart-container {
    grid-auto-columns: 62px;
    gap: 10px;
  }
}
</style>