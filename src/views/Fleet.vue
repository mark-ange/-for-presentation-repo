<template>
  <div class="fleet-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Garbage Truck Fleet Management</h1>
        <p class="page-subtitle">Real-time collection vehicle status, driver assignments, and depot routes.</p>
        <p v-if="errorMessage" class="text-red" role="alert">{{ errorMessage }}</p>
      </div>

      <button type="button" class="btn btn-primary" @click="openAddForm">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>Add Vehicle</span>
      </button>
    </div>

    <!-- Status Cards -->
    <div class="status-grid">
      <div class="status-card transit-state">
        <div class="status-header">
          <span class="status-label">IN TRANSIT</span>
          <div class="status-dot green"></div>
        </div>
        <div class="status-val text-green">{{ fleetStats.inTransit }}</div>
        <span class="status-sub">Active collection routes</span>
      </div>

      <div class="status-card idle-state">
        <div class="status-header">
          <span class="status-label">STANDBY / DEPOT</span>
          <div class="status-dot yellow"></div>
        </div>
        <div class="status-val text-yellow">{{ fleetStats.idle }}</div>
        <span class="status-sub">Ready for dispatch</span>
      </div>

      <div class="status-card maint-state">
        <div class="status-header">
          <span class="status-label">MAINTENANCE</span>
          <div class="status-dot red"></div>
        </div>
        <div class="status-val text-red">{{ fleetStats.maintenance }}</div>
        <span class="status-sub">Scheduled repair in depot</span>
      </div>
    </div>

    <!-- City Sector Map Section -->
    <div class="map-card">
      <div class="map-header">
        <div>
          <h2 class="panel-title">Live Fleet & Incident Map</h2>
          <span class="panel-subtitle">OpenStreetMap • Refreshes every 15 seconds</span>
        </div>

        <div class="map-legend">
          <span class="legend-item"><span class="dot green"></span> In transit</span>
          <span class="legend-item"><span class="dot yellow"></span> Idle</span>
          <span class="legend-item"><span class="dot red"></span> Maintenance</span>
          <span class="legend-item"><span class="dot report-dot"></span> Reports</span>
        </div>
      </div>

      <div ref="mapContainer" class="map-viewport" aria-label="Cagayan de Oro fleet and incident map"></div>

      <p class="map-note">
        Nearby pins are grouped when they overlap; click a group to zoom in and reveal individual pins, including exact overlaps. Grouping does not change or remove their saved locations. Pins remain anchored to map coordinates. Truck pins use approximate barangay centers until live GPS is provided. Select a report pin to find the nearest available truck.
      </p>

      <div v-if="selectedReport && closestTruck" class="closest-truck-panel">
        <div>
          <span class="inspector-kicker">NEAREST AVAILABLE VEHICLE</span>
          <strong class="closest-truck-title">{{ closestTruck.truckId }} · {{ closestTruck.distanceLabel }}</strong>
          <span class="panel-subtitle">For {{ selectedReport.reportId || selectedReport.id }} · {{ closestTruck.driver }}</span>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="assigningTruck || ['RESOLVED', 'REJECTED'].includes(normalizeStatus(selectedReport.status))"
          @click="assignNearestTruck"
        >
          {{ assigningTruck ? 'Assigning…' : 'Assign this truck' }}
        </button>
      </div>

      <div v-if="selectedTruck" class="vehicle-inspector">
        <div class="inspector-header">
          <div>
            <span class="inspector-kicker">VEHICLE DETAILS</span>
            <h3 class="inspector-id font-mono">{{ selectedTruck.id }}</h3>
          </div>
          <button class="inspector-close" @click="selectedTruck = null">✕</button>
        </div>

        <div class="inspector-grid">
          <div class="inspector-item">
            <span class="item-label">Plate Number</span>
            <strong class="item-val font-mono">{{ selectedTruck.plate }}</strong>
          </div>
          <div class="inspector-item">
            <span class="item-label">Driver / Operator</span>
            <strong class="item-val">{{ selectedTruck.driver }}</strong>
          </div>
          <div class="inspector-item">
            <span class="item-label">Assigned Sector</span>
            <strong class="item-val">Brgy. {{ selectedTruck.barangay }}</strong>
          </div>
          <div class="inspector-item">
            <span class="item-label">Operational Status</span>
            <strong class="item-val font-mono">{{ selectedTruck.status }}</strong>
          </div>
          <div class="inspector-item">
            <span class="item-label">Location source</span>
            <strong class="item-val">{{ selectedTruck.locationSource === 'gps' ? 'Live GPS' : 'Estimated barangay center' }}</strong>
          </div>
        </div>

        <div class="inspector-footer">
          <button class="btn btn-secondary btn-sm" @click="changeVehicleStatus">
            Cycle Status ({{ selectedTruck.status }})
          </button>
        </div>
      </div>
    </div>

    <!-- Fleet Inventory Table -->
    <div class="table-card">
      <div class="table-card-header">
        <div>
          <h2 class="panel-title">Active Fleet Inventory</h2>
          <span class="panel-subtitle">Registered dump trucks and compactor units</span>
        </div>

        <div class="table-search">
          <input
            v-model="search"
            type="search"
            placeholder="Search by ID, plate, or driver..."
          />
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>VEHICLE ID</th>
            <th>LICENSE PLATE</th>
            <th>ASSIGNED BARANGAY</th>
            <th>ASSIGNED DRIVER</th>
            <th>STATUS</th>
            <th class="text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="truck in filteredTrucks"
            :key="truck.id"
            class="table-row"
            :class="{ active: selectedTruck && selectedTruck.id === truck.id }"
            @click="selectTruck(truck)"
          >
            <td>
              <span class="id-badge font-mono">{{ truck.id }}</span>
            </td>
            <td>
              <span class="plate-badge font-mono">{{ truck.plate }}</span>
            </td>
            <td>
              <span class="location-text">Brgy. {{ truck.barangay }}</span>
            </td>
            <td>
              <div class="driver-wrap">
                <span class="driver-avatar">{{ getInitials(truck.driver) }}</span>
                <span class="driver-name">{{ truck.driver }}</span>
              </div>
            </td>
            <td>
              <span class="status-badge" :class="statusClass(truck.status)">
                {{ truck.status }}
              </span>
            </td>
            <td class="text-right" @click.stop>
              <button class="action-btn" @click="selectTruck(truck)">
                Inspect
              </button>
            </td>
          </tr>

          <tr v-if="filteredTrucks.length === 0">
            <td colspan="6" class="empty-state">
              No vehicles found matching "{{ search }}".
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Vehicle Modal -->
    <div v-if="showAddForm" class="modal-backdrop" @click.self="closeAddForm">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Register Vehicle / Driver</h3>
          <button class="modal-close" @click="closeAddForm">✕</button>
        </div>

        <form @submit.prevent="addTruck" class="modal-form">
          <div class="form-item">
            <label>Vehicle ID</label>
            <input v-model="newTruck.id" type="text" class="form-input" placeholder="Generated by system if left blank" />
          </div>

          <div class="form-item">
            <label>License Plate</label>
            <input v-model="newTruck.plate" type="text" class="form-input" required />
          </div>

          <div class="form-item">
            <label>Assigned Barangay</label>
            <select v-model="newTruck.barangay" class="form-input select-input">
              <option value="" disabled>Select a barangay</option>
              <option v-for="barangay in barangays" :key="barangay._id" :value="barangay.name">{{ barangay.name }}</option>
            </select>
          </div>

          <div class="form-item">
            <label>Assigned Driver</label>
            <input v-model="newTruck.driver" type="text" placeholder="Driver Full Name" class="form-input" required />
          </div>

          <div class="form-item">
            <label>Initial Status</label>
            <select v-model="newTruck.status" class="form-input select-input">
              <option>In Transit</option>
              <option>Idle</option>
              <option>Maintenance</option>
            </select>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeAddForm">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Vehicle</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { barangayApi, fleetApi, reportsApi } from '../services/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const search = ref('')
const selectedTruck = ref(null)
const selectedReport = ref(null)
const closestTruck = ref(null)
const assigningTruck = ref(false)
const showAddForm = ref(false)
const mapContainer = ref(null)
const mapInstance = ref(null)

const newTruck = ref({
  id: '',
  plate: '',
  barangay: '',
  driver: '',
  status: 'Idle'
})

const trucks = ref([])
const barangays = ref([])
const reports = ref([])
const errorMessage = ref('')
let markerClusterLayer
let routeLayer
let refreshTimer
const truckMarkers = new Map()
const reportMarkers = new Map()

function reportLocation(report) {
  return parseMapCoordinates(report.geoLocation) ||
    parseMapCoordinates(report.gpsCoordinates || report.gps)
}

function parseMapCoordinates(value) {
  if (value && value.type === 'Point' && Array.isArray(value.coordinates)) {
    return [Number(value.coordinates[1]), Number(value.coordinates[0])]
  }
  if (typeof value !== 'string') return null
  const match = value.trim().match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[°º]?\s*([NS])?\s*,\s*(-?\d+(?:\.\d+)?)\s*[°º]?\s*([EW])?\s*$/i
  )
  if (!match) return null
  const hemisphereValue = (coordinate, hemisphere) => {
    const number = Number(coordinate)
    return hemisphere?.toUpperCase() === 'S' || hemisphere?.toUpperCase() === 'W'
      ? -Math.abs(number)
      : hemisphere?.toUpperCase() === 'N' || hemisphere?.toUpperCase() === 'E'
        ? Math.abs(number)
        : number
  }
  const values = [hemisphereValue(match[1], match[2]), hemisphereValue(match[3], match[4])]
  if (!Number.isFinite(values[0]) || !Number.isFinite(values[1]) ||
    values[0] < -90 || values[0] > 90 || values[1] < -180 || values[1] > 180) return null
  return values
}

function normalizeStatus(status) {
  return String(status || 'PENDING').toUpperCase().replace(/[\s-]+/g, '_')
}

function markerIcon(className, html) {
  return L.divIcon({
    className,
    html,
    iconSize: [30, 34],
    iconAnchor: [15, 17]
  })
}

function addText(parent, tagName, text, className = '') {
  const element = document.createElement(tagName)
  element.textContent = text
  if (className) element.className = className
  parent.appendChild(element)
  return element
}

function createTruckPopup(truck) {
  const content = document.createElement('div')
  content.className = 'map-popup'
  addText(content, 'strong', `${truck.truckId} · ${truck.status}`)
  addText(content, 'span', `${truck.driver} · ${truck.plate}`)
  addText(
    content,
    'small',
    truck.locationSource === 'gps' ? 'Live GPS location' : 'Approximate barangay-center location'
  )
  return content
}

function createReportPopup(report) {
  const content = document.createElement('div')
  content.className = 'map-popup'
  addText(content, 'strong', report.reportId || report.id || 'Incident report')
  addText(content, 'span', `${report.title || report.location || 'Reported location'} · ${report.status || 'Pending'}`)
  if (report.landmark) addText(content, 'small', report.landmark)
  const viewButton = addText(content, 'button', 'View in Dispatch Management')
  viewButton.type = 'button'
  viewButton.addEventListener('click', () => {
    const reportId = report.reportId || report.id || report._id
    if (reportId) void router.push({ path: '/tickets', query: { report: reportId } })
  })
  const button = addText(content, 'button', 'Find closest truck')
  button.type = 'button'
  button.disabled = !report.reportId && !report.id
  button.addEventListener('click', () => { void findClosestTruck(report) })
  return content
}

function renderMapLayers() {
  if (!mapInstance.value) return
  const visibleTruckIds = new Set()
  const visibleReportIds = new Set()

  for (const truck of trucks.value) {
    const point = truck.location && truck.location.coordinates
    if (!point || point.length !== 2) continue
    const latitude = Number(point[1])
    const longitude = Number(point[0])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue
    visibleTruckIds.add(truck.id)
    const truckStatus = ['idle', 'in-transit', 'maintenance'].includes(statusClass(truck.status))
      ? statusClass(truck.status)
      : 'idle'
    const latLng = [latitude, longitude]
    let marker = truckMarkers.get(truck.id)
    if (marker) {
      const previous = marker._cityCareState
      if (previous.latitude !== latitude || previous.longitude !== longitude) marker.setLatLng(latLng)
      if (previous.status !== truckStatus) {
        marker.setIcon(markerIcon(
          'truck-marker-wrapper',
          `<span class="truck-marker ${truckStatus}" aria-label="Truck">🚛</span>`
        ))
      }
      marker.setPopupContent(createTruckPopup(truck))
    } else {
      marker = L.marker(latLng, {
        icon: markerIcon(
          'truck-marker-wrapper',
          `<span class="truck-marker ${truckStatus}" aria-label="Truck">🚛</span>`
        )
      })
      marker.bindPopup(createTruckPopup(truck), { autoPan: true })
      marker.on('click', () => {
        selectedTruck.value = trucks.value.find(item => item.id === truck.id) || truck
        mapInstance.value.setView(marker.getLatLng(), Math.max(mapInstance.value.getZoom(), 14))
      })
      marker.addTo(markerClusterLayer)
      truckMarkers.set(truck.id, marker)
    }
    marker._cityCareState = { latitude, longitude, status: truckStatus }
  }

  for (const report of reports.value) {
    const point = reportLocation(report)
    if (!point) continue
    const reportId = report.reportId || report.id || report._id
    if (!reportId) continue
    visibleReportIds.add(reportId)
    const reportStatus = normalizeStatus(report.status).toLowerCase().replace(/_/g, '-')
    const status = ['pending', 'assigned', 'in-progress', 'resolved', 'rejected'].includes(reportStatus)
      ? reportStatus
      : 'pending'
    const [latitude, longitude] = point
    let marker = reportMarkers.get(reportId)
    if (marker) {
      const previous = marker._cityCareState
      if (previous.latitude !== latitude || previous.longitude !== longitude) marker.setLatLng(point)
      if (previous.status !== status) {
        marker.setIcon(markerIcon(
          'report-marker-wrapper',
          `<span class="report-marker ${status}" aria-label="Report ${status}">●</span>`
        ))
      }
      marker.setPopupContent(createReportPopup(report))
    } else {
      marker = L.marker(point, {
        icon: markerIcon(
          'report-marker-wrapper',
          `<span class="report-marker ${status}" aria-label="Report ${status}">●</span>`
        )
      })
      marker.bindPopup(createReportPopup(report), { autoPan: true })
      marker.on('click', () => {
        selectedReport.value = reports.value.find(item =>
          (item.reportId || item.id || item._id) === reportId
        ) || report
        closestTruck.value = null
        if (routeLayer) routeLayer.clearLayers()
        mapInstance.value.setView(marker.getLatLng(), Math.max(mapInstance.value.getZoom(), 14))
      })
      marker.addTo(markerClusterLayer)
      reportMarkers.set(reportId, marker)
    }
    marker._cityCareState = { latitude, longitude, status }
  }

  for (const [truckId, marker] of truckMarkers) {
    if (!visibleTruckIds.has(truckId)) {
      markerClusterLayer.removeLayer(marker)
      truckMarkers.delete(truckId)
    }
  }
  for (const [reportId, marker] of reportMarkers) {
    if (!visibleReportIds.has(reportId)) {
      markerClusterLayer.removeLayer(marker)
      reportMarkers.delete(reportId)
    }
  }

  if (selectedReport.value && closestTruck.value) drawClosestRoute()
}

function drawClosestRoute(zoomToRoute = false) {
  if (!routeLayer || !selectedReport.value || !closestTruck.value) return
  routeLayer.clearLayers()
  const reportPoint = reportLocation(selectedReport.value)
  const truckPoint = closestTruck.value.location?.coordinates
  if (!reportPoint || !truckPoint) return
  const truckLatLng = [Number(truckPoint[1]), Number(truckPoint[0])]
  L.polyline([reportPoint, truckLatLng], {
    color: '#2563eb',
    weight: 4,
    dashArray: '8 8'
  }).addTo(routeLayer)
  if (zoomToRoute) {
    mapInstance.value.fitBounds([reportPoint, truckLatLng], { padding: [48, 48], maxZoom: 15 })
  }
}

async function initializeMap() {
  await nextTick()
  if (!mapContainer.value || mapInstance.value) return
  mapInstance.value = L.map(mapContainer.value, { scrollWheelZoom: true })
    .setView([8.48, 124.64], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance.value)
  markerClusterLayer = L.markerClusterGroup({
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount()
      const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large'
      return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: `marker-cluster marker-cluster-${size} citycare-cluster-icon`,
        iconSize: L.point(40, 40)
      })
    }
  }).addTo(mapInstance.value)
  routeLayer = L.layerGroup().addTo(mapInstance.value)
  renderMapLayers()
  mapInstance.value.invalidateSize()
}

async function loadFleet() {
  try {
    const res = await fleetApi.getAll()
    trucks.value = res.data || []
    errorMessage.value = ''
    renderMapLayers()
  } catch (err) {
    console.error('Failed to load fleet data:', err)
    errorMessage.value = err.message || 'Unable to load fleet data.'
  }
}

async function loadReports() {
  try {
    const response = await reportsApi.getAll({ limit: 1000 })
    reports.value = response.data || []
    renderMapLayers()
  } catch (err) {
    console.error('Failed to load report locations:', err)
    errorMessage.value = err.message || 'Unable to load report locations.'
  }
}

async function findClosestTruck(report) {
  const reportId = report.reportId || report.id
  if (!reportId) return
  selectedReport.value = report
  closestTruck.value = null
  errorMessage.value = ''
  if (routeLayer) routeLayer.clearLayers()
  try {
    const response = await fleetApi.getClosest(reportId)
    closestTruck.value = response.data?.[0] || null
    if (!closestTruck.value) {
      errorMessage.value = 'No available truck with a known or estimated location was found.'
      return
    }
    renderMapLayers()
    drawClosestRoute(true)
  } catch (err) {
    console.error('Failed to find the closest truck:', err)
    errorMessage.value = err.message || 'Unable to find the closest truck.'
  }
}

async function assignNearestTruck() {
  if (!selectedReport.value || !closestTruck.value) return
  assigningTruck.value = true
  try {
    const previousNotes = selectedReport.value.notes || ''
    const assignmentNote = `Nearest truck selected: ${closestTruck.value.truckId} (${closestTruck.value.distanceLabel}).`
    const response = await reportsApi.updateStatus(
      selectedReport.value.reportId || selectedReport.value.id,
      {
        status: normalizeStatus(selectedReport.value.status) === 'PENDING'
          ? 'Assigned'
          : selectedReport.value.status,
        unitAssigned: closestTruck.value.truckId,
        team: closestTruck.value.truckId,
        personnel: closestTruck.value.driver,
        notes: previousNotes ? `${previousNotes}\n${assignmentNote}` : assignmentNote
      }
    )
    selectedReport.value = response.data
    await loadReports()
    renderMapLayers()
  } catch (err) {
    console.error('Failed to assign the closest truck:', err)
    errorMessage.value = err.message || 'Unable to assign the closest truck.'
  } finally {
    assigningTruck.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadFleet(),
    loadReports(),
    barangayApi.getAll()
      .then(response => {
        barangays.value = response.data || []
        if (!newTruck.value.barangay && barangays.value.length) {
          newTruck.value.barangay = barangays.value[0].name
        }
      })
      .catch(err => {
        console.error('Failed to load barangay options:', err)
        errorMessage.value = err.message || 'Unable to load barangay options.'
      })
  ])
  await initializeMap()
  refreshTimer = window.setInterval(() => {
    void Promise.all([loadFleet(), loadReports()])
  }, 15000)
})

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})

const fleetStats = computed(() => ({
  inTransit: trucks.value.filter(t => t.status === 'In Transit').length,
  idle: trucks.value.filter(t => t.status === 'Idle').length,
  maintenance: trucks.value.filter(t => t.status === 'Maintenance').length
}))

const filteredTrucks = computed(() => {
  const kw = search.value.toLowerCase().trim()
  if (!kw) return trucks.value

  return trucks.value.filter(t => {
    return [t.id, t.plate, t.barangay, t.driver, t.status].join(' ').toLowerCase().includes(kw)
  })
})

function getInitials(name) {
  if (!name) return 'TR'
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

function statusClass(st) {
  return (st || 'idle').toLowerCase().replace(/[\s_]+/g, '-')
}

function selectTruck(truck) {
  selectedTruck.value = truck
  const marker = truckMarkers.get(truck.id)
  if (marker && mapInstance.value) {
    mapInstance.value.setView(marker.getLatLng(), Math.max(mapInstance.value.getZoom(), 14))
    marker.openPopup()
  }
}

async function changeVehicleStatus() {
  if (!selectedTruck.value) return

  const cycle = {
    'In Transit': 'Idle',
    'Idle': 'Maintenance',
    'Maintenance': 'In Transit'
  }
  const next = cycle[selectedTruck.value.status] || 'In Transit'

  try {
    await fleetApi.update(selectedTruck.value.id, { status: next })
    selectedTruck.value.status = next
    const found = trucks.value.find(t => t.id === selectedTruck.value.id)
    if (found) found.status = next
    renderMapLayers()
    errorMessage.value = ''
  } catch (err) {
    console.error('Failed to update vehicle status:', err)
    errorMessage.value = err.message || 'Unable to update vehicle status.'
  }
}

function openAddForm() {
  newTruck.value = {
    id: '',
    plate: '',
    barangay: '',
    driver: '',
    status: 'Idle'
  }
  showAddForm.value = true
}

function closeAddForm() {
  showAddForm.value = false
}

async function addTruck() {
  try {
    const res = await fleetApi.create(newTruck.value)
    trucks.value.push(res.data)
    renderMapLayers()
    errorMessage.value = ''
    closeAddForm()
  } catch (err) {
    console.error('Failed to add vehicle:', err)
    errorMessage.value = err.message || 'Unable to add vehicle.'
  }
}
</script>

<style scoped>
.fleet-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-title {
  margin: 0;
  font-size: 20px;
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
  color: #04140a;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
}

.btn-sm {
  padding: 6px 10px;
  font-size: 11px;
}

/* Status Grid */
.status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.status-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  font-family: var(--font-mono);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.green { background-color: var(--primary); }
.status-dot.yellow { background-color: var(--status-pending); }
.status-dot.red { background-color: var(--status-urgent); }

.status-val {
  margin: 10px 0 4px;
  font-size: 26px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.text-green { color: var(--primary); }
.text-yellow { color: var(--status-pending); }
.text-red { color: var(--status-urgent); }

.status-sub {
  font-size: 11px;
  color: var(--text-muted);
}

/* Map Card */
.map-card {
  position: relative;
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 18px 20px;
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
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

.map-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11px;
  color: var(--text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.legend-item .dot.green { background-color: var(--primary); }
.legend-item .dot.yellow { background-color: var(--status-pending); }
.legend-item .dot.red { background-color: var(--status-urgent); }
.legend-item .dot.report-dot { background-color: #8b5cf6; }

.map-viewport {
  position: relative;
  height: min(62vh, 560px);
  min-height: 360px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  overflow: hidden;
}

.map-note {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.closest-truck-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
}

.closest-truck-panel > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.closest-truck-title {
  font-size: 13px;
  color: var(--text-main);
}

:deep(.leaflet-container) {
  font: inherit;
  z-index: 0;
}

:deep(.truck-marker-wrapper),
:deep(.report-marker-wrapper) {
  background: transparent;
  border: 0;
}

:deep(.truck-marker) {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 2px solid white;
  border-radius: 50%;
  background: #059669;
  box-shadow: 0 1px 6px #0006;
  font-size: 18px;
}

:deep(.truck-marker.idle) { background: #d97706; }
:deep(.truck-marker.maintenance) { background: #dc2626; }

:deep(.report-marker) {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 2px solid white;
  border-radius: 50%;
  background: #7c3aed;
  box-shadow: 0 1px 6px #0006;
  color: white;
  font-size: 14px;
}

:deep(.report-marker.assigned),
:deep(.report-marker.in-progress) { background: #2563eb; }
:deep(.report-marker.resolved) { background: #059669; }
:deep(.report-marker.rejected) { background: #dc2626; }

:deep(.map-popup) {
  display: flex;
  min-width: 190px;
  flex-direction: column;
  gap: 5px;
}

:deep(.map-popup strong) { color: #111827; }
:deep(.map-popup span),
:deep(.map-popup small) { color: #4b5563; }

:deep(.map-popup button) {
  margin-top: 4px;
  padding: 6px 9px;
  border: 0;
  border-radius: 4px;
  background: #047857;
  color: white;
  cursor: pointer;
}

:deep(.map-popup button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Inspector */
.vehicle-inspector {
  position: relative;
  width: min(100%, 420px);
  margin-top: 12px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-muted);
  border-radius: 6px;
  padding: 14px;
  box-shadow: var(--shadow-md);
  z-index: 100;
}

.inspector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.inspector-kicker {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.inspector-id {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.inspector-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
}

.inspector-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 11px;
}

.inspector-item {
  display: flex;
  justify-content: space-between;
}

.item-label { color: var(--text-muted); }
.item-val { color: var(--text-main); }

.inspector-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
}

/* Inventory Table */
.table-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.table-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
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

.id-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-sage);
}

.plate-badge {
  font-size: 11px;
  color: var(--text-secondary);
}

.location-text {
  font-size: 12px;
  font-weight: 600;
}

.driver-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.driver-avatar {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: var(--bg-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--accent-sage);
}

.driver-name {
  font-size: 12px;
}

.status-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.status-badge.in-transit {
  background-color: var(--status-resolved-bg);
  color: var(--status-resolved);
}

.status-badge.idle {
  background-color: var(--status-pending-bg);
  color: var(--status-pending);
}

.status-badge.maintenance {
  background-color: var(--status-urgent-bg);
  color: var(--status-urgent);
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

.text-right {
  text-align: right;
}

.empty-state {
  text-align: center;
  padding: 30px !important;
  color: var(--text-muted);
}

/* Modal */
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
  max-width: 440px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-muted);
  border-radius: 8px;
  padding: 24px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.modal-title {
  margin: 0;
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

.modal-footer {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 720px) {
  .map-header,
  .closest-truck-panel {
    align-items: flex-start;
    flex-direction: column;
  }

  .map-legend {
    flex-wrap: wrap;
  }

  .map-viewport {
    min-height: 320px;
  }
}
</style>