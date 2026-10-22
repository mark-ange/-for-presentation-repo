<template>
  <div class="fleet-container admin-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Garbage Truck Fleet Management</h1>
        <p class="page-subtitle">Real-time collection vehicle status, driver assignments, and depot routes.</p>
        <p v-if="errorMessage" class="text-red" role="alert">{{ errorMessage }}</p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" :disabled="isRefreshing" @click="manualRefresh">
          {{ isRefreshing ? 'Refreshing...' : 'Refresh Fleet' }}
        </button>
        <button type="button" class="btn btn-primary" @click="openAddForm">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Add Vehicle</span>
        </button>
      </div>
    </div>

    <!-- Status Cards -->
    <div class="status-grid">
      <div class="status-card transit-state">
        <div class="status-header">
          <span class="status-label">DISPATCHING / IN TRANSIT</span>
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

      <div class="status-card out-of-service-state">
        <div class="status-header">
          <span class="status-label">OUT OF SERVICE</span>
          <div class="status-dot gray"></div>
        </div>
        <div class="status-val">{{ fleetStats.outOfService }}</div>
        <span class="status-sub">Unavailable for assignment</span>
      </div>
    </div>

    <!-- City Sector Map Section -->
    <div ref="mapCardContainer" class="map-card">
      <div class="map-header">
        <div>
          <h2 class="panel-title">Fleet & Incident Map</h2>
          <span class="panel-subtitle">OpenStreetMap • Refreshes every 15 seconds</span>
        </div>

        <div class="map-header-actions">
          <div class="map-legend">
            <span class="legend-item"><span class="dot dispatching"></span> Dispatching</span>
            <span class="legend-item"><span class="dot green"></span> In transit</span>
            <span class="legend-item"><span class="dot yellow"></span> Idle</span>
            <span class="legend-item"><span class="dot red"></span> Maintenance</span>
            <span class="legend-item"><span class="dot out-of-service"></span> Out of service</span>
            <span class="legend-item"><span class="dot report-dot"></span> Reports</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" @click="toggleMapFullscreen">
            {{ isMapFullscreen ? 'Exit full screen' : 'Full screen' }}
          </button>
        </div>
      </div>

      <div ref="mapContainer" class="map-viewport" aria-label="Cagayan de Oro fleet and incident map">
        <div class="map-controls" aria-label="Map controls">
          <button type="button" title="Zoom in" aria-label="Zoom in" :disabled="mapZoom >= 19" @click.stop="zoomMap(1)">+</button>
          <input
            class="map-zoom-slider"
            type="range"
            min="3"
            max="19"
            :value="mapZoom"
            aria-label="Map zoom level"
            title="Adjust map zoom"
            @input.stop="setMapZoom(Number($event.target.value))"
          />
          <span class="map-zoom-level" aria-live="polite">z{{ mapZoom }}</span>
          <button type="button" title="Zoom out" aria-label="Zoom out" :disabled="mapZoom <= 3" @click.stop="zoomMap(-1)">−</button>
          <button type="button" class="map-center-button" title="Center on Cagayan de Oro" aria-label="Center map on Cagayan de Oro" @click.stop="resetMapView">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="8"/>
              <circle cx="12" cy="12" r="2"/>
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
            </svg>
          </button>
        </div>
      </div>

      <p class="map-note">
        Idle trucks are hidden from the map. When dispatching a truck, choose its map location from the status control, then click the map to set its position. Other positions are approximate unless marked Live GPS.
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
            <div class="status-control" @click.stop>
              <select
                class="status-select inspector-status-select"
                :value="pendingTruckStatuses[selectedTruck.id] || selectedTruck.status"
                :disabled="isStatusSaving(selectedTruck.id)"
                :aria-label="`Status for ${selectedTruck.id}`"
                @change="setPendingTruckStatus(selectedTruck, $event.target.value)"
              >
                <option v-for="status in fleetStatuses" :key="status" :value="status">{{ status }}</option>
              </select>
              <button
                v-if="['Dispatching', 'In Transit'].includes(pendingTruckStatuses[selectedTruck.id] || selectedTruck.status)"
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="isStatusSaving(selectedTruck.id)"
                @click="beginLocationPick(selectedTruck)"
              >
                {{ locationPickingTruckId === selectedTruck.id ? 'Click map to place truck…' : 'Choose map location' }}
              </button>
              <button
                v-if="pendingTruckStatuses[selectedTruck.id] || pendingTruckLocations[selectedTruck.id]"
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="isStatusSaving(selectedTruck.id)"
                @click="saveTruckStatus(selectedTruck)"
              >
                {{ isStatusSaving(selectedTruck.id) ? 'Saving…' : 'Update status' }}
              </button>
              <span
                v-if="truckStatusFeedback[selectedTruck.id]"
                class="status-feedback"
                :class="truckStatusFeedback[selectedTruck.id].type"
                role="status"
              >{{ truckStatusFeedback[selectedTruck.id].message }}</span>
              <span v-if="pendingTruckLocations[selectedTruck.id]" class="status-feedback pending">
                Selected: {{ formatCoordinates(pendingTruckLocations[selectedTruck.id]) }}
              </span>
            </div>
          </div>
          <div class="inspector-item">
            <span class="item-label">Location source</span>
            <strong class="item-val">
              {{ selectedTruck.locationSource === 'gps'
                ? 'Live GPS'
                : selectedTruck.locationSource === 'manual'
                  ? 'Manually selected'
                : selectedTruck.status === 'Idle'
                  ? 'Estimated Central Depot'
                  : 'Estimated barangay center' }}
            </strong>
          </div>
        </div>

        <div class="inspector-footer">
          <span class="panel-subtitle">Choose a status and click Update to save.</span>
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
              <div class="status-control" @click.stop>
                <select
                  class="status-badge status-select"
                  :class="statusClass(pendingTruckStatuses[truck.id] || truck.status)"
                  :value="pendingTruckStatuses[truck.id] || truck.status"
                  :disabled="isStatusSaving(truck.id)"
                  :aria-label="`Status for ${truck.id}`"
                  @change="setPendingTruckStatus(truck, $event.target.value)"
                >
                  <option v-for="status in fleetStatuses" :key="status" :value="status">{{ status }}</option>
                </select>
                <button
                  v-if="['Dispatching', 'In Transit'].includes(pendingTruckStatuses[truck.id] || truck.status)"
                  type="button"
                  class="btn btn-secondary btn-sm status-update-button"
                  :disabled="isStatusSaving(truck.id)"
                  @click="beginLocationPick(truck)"
                >
                  {{ locationPickingTruckId === truck.id ? 'Click map…' : 'Pick map location' }}
                </button>
                <button
                  v-if="pendingTruckStatuses[truck.id] || pendingTruckLocations[truck.id]"
                  type="button"
                  class="btn btn-primary btn-sm status-update-button"
                  :disabled="isStatusSaving(truck.id)"
                  @click="saveTruckStatus(truck)"
                >
                  {{ isStatusSaving(truck.id) ? 'Saving…' : 'Update' }}
                </button>
                <span
                  v-if="truckStatusFeedback[truck.id]"
                  class="status-feedback"
                  :class="truckStatusFeedback[truck.id].type"
                  role="status"
                >{{ truckStatusFeedback[truck.id].message }}</span>
                <span v-if="pendingTruckLocations[truck.id]" class="status-feedback pending">
                  {{ formatCoordinates(pendingTruckLocations[truck.id]) }}
                </span>
              </div>
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
              <option v-for="status in fleetStatuses" :key="status" :value="status">{{ status }}</option>
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
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { barangayApi, fleetApi, reportsApi } from '../services/api'
import { useRouter } from 'vue-router'
import { loadSettings, settingsState } from '../services/settingsStore'

const router = useRouter()
const search = ref('')
const selectedTruck = ref(null)
const selectedReport = ref(null)
const closestTruck = ref(null)
const assigningTruck = ref(false)
const showAddForm = ref(false)
const isRefreshing = ref(false)
const mapCardContainer = ref(null)
const mapContainer = ref(null)
const mapInstance = ref(null)
const isMapFullscreen = ref(false)
const mapZoom = ref(12)
const defaultMapCenter = [8.48, 124.64]
const fleetStatuses = ['Idle', 'Dispatching', 'In Transit', 'Maintenance', 'Out of Service']
const statusSavingIds = ref([])
const pendingTruckStatuses = ref({})
const pendingTruckLocations = ref({})
const locationPickingTruckId = ref('')
const truckStatusFeedback = ref({})

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
let truckLayer
let routeLayer
let locationPickLayer
let refreshTimer
let mapWheelDelta = 0
let mapWheelTimer
const truckMarkers = new Map()
const reportMarkers = new Map()

function reportLocation(report) {
  return parseMapCoordinates(report.geoLocation) ||
    parseMapCoordinates(report.gpsCoordinates || report.gps)
}

function formatCoordinates(location) {
  return `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`
}

function beginLocationPick(truck) {
  locationPickingTruckId.value = truck.id
  errorMessage.value = 'Click the map where this truck should be shown, then save its status.'
  if (mapInstance.value) {
    mapInstance.value.getContainer().classList.add('location-pick-mode')
    mapInstance.value.getContainer().scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function setPendingTruckLocation(event) {
  const truckId = locationPickingTruckId.value
  if (!truckId) return

  const { lat, lng } = event.latlng
  const location = { latitude: lat, longitude: lng }
  pendingTruckLocations.value = { ...pendingTruckLocations.value, [truckId]: location }
  locationPickingTruckId.value = ''
  mapInstance.value?.getContainer().classList.remove('location-pick-mode')
  errorMessage.value = ''
  if (locationPickLayer) {
    locationPickLayer.clearLayers()
    L.marker([lat, lng], { icon: truckMarkerIcon('dispatching'), zIndexOffset: 2000 })
      .bindPopup('Selected truck location')
      .addTo(locationPickLayer)
      .openPopup()
  }
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

function truckMarkerIcon(status) {
  return L.divIcon({
    className: 'truck-marker-wrapper',
    html: `<span class="truck-marker ${status}" aria-label="Truck">🚛</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
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
    truck.locationSource === 'gps'
      ? 'Live GPS location'
      : truck.locationSource === 'manual'
        ? 'Manually selected map location'
      : truck.status === 'Idle'
        ? 'Approximate Central Depot location'
        : 'Approximate barangay-center location'
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
    if (String(truck.status || '').trim().toLowerCase() === 'idle') continue

    const point = truck.location && truck.location.coordinates
    if (!point || point.length !== 2) continue
    const latitude = Number(point[1])
    const longitude = Number(point[0])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue
    visibleTruckIds.add(truck.id)
    const truckStatus = ['idle', 'dispatching', 'in-transit', 'maintenance', 'out-of-service'].includes(statusClass(truck.status))
      ? statusClass(truck.status)
      : 'idle'
    const latLng = [latitude, longitude]
    let marker = truckMarkers.get(truck.id)
    if (marker) {
      const previous = marker._cityCareState
      if (previous.latitude !== latitude || previous.longitude !== longitude) marker.setLatLng(latLng)
      if (previous.status !== truckStatus) {
        marker.setIcon(truckMarkerIcon(truckStatus))
      }
      marker.setPopupContent(createTruckPopup(truck))
    } else {
      marker = L.marker(latLng, {
        pane: 'truckPane',
        zIndexOffset: 1000,
        icon: truckMarkerIcon(truckStatus)
      })
      marker.bindPopup(createTruckPopup(truck), { autoPan: true })
      marker.on('click', () => {
        selectedTruck.value = trucks.value.find(item => item.id === truck.id) || truck
        mapInstance.value.setView(marker.getLatLng(), Math.max(mapInstance.value.getZoom(), 14))
      })
      marker.addTo(truckLayer)
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
      truckLayer.removeLayer(marker)
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
  mapInstance.value = L.map(mapContainer.value, {
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: true,
    touchZoom: true,
    markerZoomAnimation: true,
    keyboard: true,
    minZoom: 3,
    maxZoom: 19
  }).setView(defaultMapCenter, 12)
  mapInstance.value.attributionControl.setPrefix(false)
  mapContainer.value.addEventListener('wheel', handleMapWheel, { passive: false })
  mapInstance.value.on('zoomend', () => {
    mapZoom.value = mapInstance.value?.getZoom() ?? mapZoom.value
  })
  mapInstance.value.on('click', setPendingTruckLocation)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance.value)
  mapInstance.value.createPane('truckPane')
  mapInstance.value.getPane('truckPane').style.zIndex = '650'
  truckLayer = L.layerGroup().addTo(mapInstance.value)
  markerClusterLayer = L.markerClusterGroup({
    maxClusterRadius: 56,
    animate: false,
    animateAddingMarkers: false,
    spiderfyOnMaxZoom: false,
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
  locationPickLayer = L.layerGroup().addTo(mapInstance.value)
  renderMapLayers()
  mapInstance.value.invalidateSize()
}

function zoomMap(direction) {
  if (!mapInstance.value) return
  mapInstance.value.setZoom(mapInstance.value.getZoom() + direction)
}

function setMapZoom(zoom) {
  mapInstance.value?.setZoom(zoom)
}

function handleMapWheel(event) {
  if (!event.ctrlKey || !mapInstance.value) return

  event.preventDefault()
  event.stopPropagation()
  mapWheelDelta += event.deltaY

  while (Math.abs(mapWheelDelta) >= 100) {
    mapInstance.value.setZoom(mapInstance.value.getZoom() + (mapWheelDelta < 0 ? 1 : -1))
    mapWheelDelta += mapWheelDelta < 0 ? 100 : -100
  }

  window.clearTimeout(mapWheelTimer)
  mapWheelTimer = window.setTimeout(() => {
    mapWheelDelta = 0
  }, 150)
}

function resetMapView() {
  mapInstance.value?.setView(defaultMapCenter, 12)
}

async function toggleMapFullscreen() {
  const mapCard = mapCardContainer.value
  if (!mapCard) return

  try {
    if (document.fullscreenElement === mapCard) {
      await document.exitFullscreen()
    } else if (!document.fullscreenElement) {
      await mapCard.requestFullscreen()
    }
  } catch (err) {
    console.error('Unable to toggle map full screen:', err)
    errorMessage.value = 'Unable to enter full screen. Check your browser permissions and try again.'
  }
}

function handleFullscreenChange() {
  isMapFullscreen.value = document.fullscreenElement === mapCardContainer.value
  requestAnimationFrame(() => mapInstance.value?.invalidateSize())
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

async function manualRefresh() {
  isRefreshing.value = true
  try {
    await Promise.all([loadFleet(), loadReports()])
  } finally {
    isRefreshing.value = false
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

function updateFleetRefreshTimer() {
  if (refreshTimer) window.clearInterval(refreshTimer)
  refreshTimer = settingsState.system.autoRefresh
    ? window.setInterval(() => {
      void Promise.all([loadFleet(), loadReports()])
    }, 15000)
    : null
}

watch(() => settingsState.system.autoRefresh, updateFleetRefreshTimer)

onMounted(async () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  try {
    await loadSettings()
  } catch (err) {
    console.error('Failed to load fleet preferences:', err)
  }
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
  updateFleetRefreshTimer()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (mapContainer.value) mapContainer.value.removeEventListener('wheel', handleMapWheel)
  if (mapWheelTimer) window.clearTimeout(mapWheelTimer)
  if (refreshTimer) window.clearInterval(refreshTimer)
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})

const fleetStats = computed(() => ({
  inTransit: trucks.value.filter(t => ['Dispatching', 'In Transit'].includes(t.status)).length,
  idle: trucks.value.filter(t => t.status === 'Idle').length,
  maintenance: trucks.value.filter(t => t.status === 'Maintenance').length,
  outOfService: trucks.value.filter(t => t.status === 'Out of Service').length
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

function isStatusSaving(truckId) {
  return statusSavingIds.value.includes(truckId)
}

function setPendingTruckStatus(truck, nextStatus) {
  if (!truck || !fleetStatuses.includes(nextStatus)) return

  const pending = { ...pendingTruckStatuses.value }
  if (nextStatus === truck.status) {
    delete pending[truck.id]
  } else {
    pending[truck.id] = nextStatus
  }
  pendingTruckStatuses.value = pending
  const pendingLocations = { ...pendingTruckLocations.value }
  delete pendingLocations[truck.id]
  pendingTruckLocations.value = pendingLocations
  if (locationPickingTruckId.value === truck.id) {
    locationPickingTruckId.value = ''
    mapInstance.value?.getContainer().classList.remove('location-pick-mode')
  }
  locationPickLayer?.clearLayers()
  truckStatusFeedback.value = {
    ...truckStatusFeedback.value,
    [truck.id]: { type: 'pending', message: nextStatus === truck.status ? '' : 'Click Update to save this change.' }
  }
}

async function saveTruckStatus(truck) {
  if (!truck || isStatusSaving(truck.id)) return
  const nextStatus = pendingTruckStatuses.value[truck.id] || truck.status
  const pickedLocation = pendingTruckLocations.value[truck.id]
  if (!fleetStatuses.includes(nextStatus) || (nextStatus === truck.status && !pickedLocation)) return
  const isDispatching = ['Dispatching', 'In Transit'].includes(nextStatus)
  const wasDispatching = ['Dispatching', 'In Transit'].includes(truck.status)
  if (isDispatching && !wasDispatching && !pickedLocation) {
    truckStatusFeedback.value = {
      ...truckStatusFeedback.value,
      [truck.id]: { type: 'error', message: 'Choose a map location before dispatching this truck.' }
    }
    return
  }

  statusSavingIds.value = [...statusSavingIds.value, truck.id]
  truckStatusFeedback.value = {
    ...truckStatusFeedback.value,
    [truck.id]: { type: 'pending', message: 'Saving status…' }
  }
  try {
    const response = await fleetApi.update(truck.id, {
      ...(nextStatus !== truck.status ? { status: nextStatus } : {}),
      ...(pickedLocation ? { location: pickedLocation } : {})
    })
    if (response?.success !== true || response.data?.status !== nextStatus) {
      throw new Error(response?.message || 'The server did not confirm the status update.')
    }

    Object.assign(truck, response.data)
    if (selectedTruck.value?.id === truck.id) Object.assign(selectedTruck.value, response.data)
    const pending = { ...pendingTruckStatuses.value }
    delete pending[truck.id]
    pendingTruckStatuses.value = pending
    const locations = { ...pendingTruckLocations.value }
    delete locations[truck.id]
    pendingTruckLocations.value = locations
    locationPickLayer?.clearLayers()
    truckStatusFeedback.value = {
      ...truckStatusFeedback.value,
      [truck.id]: { type: 'success', message: `Status updated to ${nextStatus}.` }
    }
    renderMapLayers()
    errorMessage.value = ''
  } catch (err) {
    console.error('Failed to update vehicle status:', err)
    truckStatusFeedback.value = {
      ...truckStatusFeedback.value,
      [truck.id]: { type: 'error', message: err.message || 'Unable to update vehicle status.' }
    }
  } finally {
    statusSavingIds.value = statusSavingIds.value.filter(id => id !== truck.id)
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
  gap: 22px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: clamp(22px, 2vw, 28px);
  font-weight: 750;
  letter-spacing: -0.035em;
  color: var(--text-main);
}

.page-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 9px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.btn:active { transform: translateY(1px); }

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
  border-color: var(--primary);
}

.btn-primary {
  background-color: var(--primary);
  color: #fff;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.status-card {
  position: relative;
  overflow: hidden;
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 19px 20px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.status-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-muted);
  box-shadow: var(--shadow-md);
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  font-family: var(--font-mono);
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 14%, transparent);
}

.status-dot.green { background-color: var(--primary); color: var(--primary); }
.status-dot.yellow { background-color: var(--status-pending); color: var(--status-pending); }
.status-dot.red { background-color: var(--status-urgent); color: var(--status-urgent); }
.status-dot.gray { background-color: #475569; color: #475569; }

.status-val {
  margin: 12px 0 2px;
  font-size: 32px;
  font-weight: 750;
  font-family: var(--font-mono);
  line-height: 1.1;
}

.out-of-service-state .status-val { color: #475569; }

.text-green { color: var(--primary); }
.text-yellow { color: var(--status-pending); }
.text-red { color: var(--status-urgent); }

.status-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Map Card */
.map-card {
  position: relative;
  background-color: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 18px;
  padding: 22px;
  box-shadow: var(--shadow-sm);
}

.map-card:fullscreen {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
  border: 0;
  border-radius: 0;
  background-color: var(--bg-card);
}

.map-card:fullscreen .map-viewport {
  flex: 1;
  height: auto;
  min-height: 240px;
  max-height: none;
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.map-header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--text-main);
}

.panel-subtitle {
  display: inline-block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.map-legend {
  display: flex;
  align-items: center;
  gap: 13px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-item .dot.green { background-color: var(--primary); }
.legend-item .dot.dispatching { background-color: #2563eb; }
.legend-item .dot.yellow { background-color: var(--status-pending); }
.legend-item .dot.red { background-color: var(--status-urgent); }
.legend-item .dot.out-of-service { background-color: #475569; }
.legend-item .dot.report-dot { background-color: #8b5cf6; }

.map-viewport {
  position: relative;
  height: min(68vh, 680px);
  min-height: 440px;
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-surface);
}

.map-controls {
  position: absolute;
  z-index: 1000;
  top: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 9px;
  border: 1px solid #d9e2df;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px #10281b26;
}

.map-controls button {
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: #f3f7f5;
  color: #183b2a;
  font-size: 27px;
  font-weight: 500;
  line-height: 1;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.map-controls button:hover:not(:disabled) {
  background: var(--primary);
  color: #fff;
}

.map-controls button:active:not(:disabled) { transform: scale(0.96); }
.map-controls button:disabled { cursor: not-allowed; opacity: 0.38; }

.map-controls .map-center-button {
  width: 44px;
  height: 44px;
  margin-top: 3px;
  border-top: 1px solid #d9e2df;
  border-radius: 0 0 10px 10px;
  background: #fff;
}

.map-center-button svg { width: 19px; height: 19px; }

.map-zoom-slider {
  width: 28px;
  height: 126px;
  margin: 2px 0;
  accent-color: var(--primary);
  cursor: ns-resize;
  direction: rtl;
  touch-action: none;
  writing-mode: vertical-lr;
}

.map-zoom-level {
  min-width: 40px;
  color: #52645a;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.map-note {
  margin: 12px 2px 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}

.closest-truck-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 15px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
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

:deep(.leaflet-container:focus-visible) {
  outline: 3px solid var(--primary);
  outline-offset: -3px;
}

:deep(.leaflet-container.location-pick-mode) {
  cursor: crosshair;
}

:deep(.truck-marker-wrapper),
:deep(.report-marker-wrapper) {
  background: transparent;
  border: 0;
}

:deep(.truck-marker) {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 3px solid white;
  border-radius: 12px;
  background: #059669;
  box-shadow: 0 2px 9px #0008;
  font-size: 22px;
}

:deep(.truck-marker.idle) { background: #d97706; }
:deep(.truck-marker.dispatching) { background: #2563eb; }
:deep(.truck-marker.maintenance) { background: #dc2626; }
:deep(.truck-marker.out-of-service) { background: #475569; }

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
  border-radius: 14px;
  padding: 18px;
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
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 19px 22px;
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
  padding: 12px 16px;
  font-family: var(--font-mono);
}

.data-table td {
  padding: 14px 16px;
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

.status-select {
  border: 0;
  cursor: pointer;
}

.status-select:disabled {
  cursor: progress;
  opacity: 0.7;
}

.status-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.status-update-button {
  padding: 4px 7px;
  font-size: 10px;
}

.status-feedback {
  flex-basis: 100%;
  font-size: 10px;
  line-height: 1.35;
}

.status-feedback.pending { color: var(--text-muted); }
.status-feedback.success { color: var(--status-resolved); }
.status-feedback.error { color: var(--status-urgent); }

.status-select option {
  background: var(--bg-surface);
  color: var(--text-main);
}

.status-select.dispatching {
  background-color: #dbeafe;
  color: #1d4ed8;
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

.status-badge.out-of-service {
  background-color: #e2e8f0;
  color: #334155;
}

.inspector-status-select {
  max-width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-muted);
  border-radius: 6px;
  background-color: var(--bg-surface);
  color: var(--text-main);
  font: inherit;
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

@media (max-width: 1024px) {
  .status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .page-header,
  .map-header,
  .map-header-actions,
  .closest-truck-panel,
  .table-card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions { width: 100%; }
  .header-actions .btn { flex: 1; justify-content: center; }
  .status-grid { grid-template-columns: 1fr; }
  .map-card { padding: 16px; }
  .map-header-actions { gap: 12px; }

  .map-legend {
    flex-wrap: wrap;
  }

  .map-viewport {
    height: 62vh;
    min-height: 340px;
  }

  .map-controls {
    top: 10px;
    right: 10px;
    padding: 5px;
  }

  .map-controls button {
    width: 48px;
    height: 48px;
  }

  .map-zoom-slider { height: 110px; }

  .table-search,
  .table-search input { width: 100%; }
}
</style>