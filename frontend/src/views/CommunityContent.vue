<template>
  <section class="content-page">
    <header class="page-header">
      <div>
        <h1>Community Content</h1>
        <p>Manage resident-facing recycling information, events, tips, and blog posts.</p>
      </div>
      <button class="primary-button" type="button" @click="openCreateForm">Add content</button>
    </header>

    <div class="content-toolbar">
      <div class="type-tabs" role="tablist" aria-label="Content type">
        <button
          v-for="item in contentTypes"
          :key="item.value"
          type="button"
          role="tab"
          :aria-selected="selectedType === item.value"
          :class="{ selected: selectedType === item.value }"
          @click="selectType(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <button class="secondary-button" type="button" :disabled="isLoading" @click="loadContent">
        {{ isLoading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <p v-if="errorMessage" class="notice error-notice" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success-notice" role="status">{{ successMessage }}</p>

    <div v-if="isLoading && records.length === 0" class="empty-state">Loading content...</div>
    <div v-else-if="records.length === 0" class="empty-state">
      <strong>No {{ selectedTypeLabel.toLowerCase() }} content yet</strong>
      <span>Create an item here; save it as a draft or publish it for the resident app.</span>
    </div>

    <div v-else class="record-list">
      <article v-for="record in records" :key="record._id" class="record-card">
        <img v-if="record.imageUrl" class="record-image" :src="record.imageUrl" alt="" loading="lazy" />
        <div class="record-main">
          <div class="record-heading">
            <div>
              <div class="record-meta">
                <span class="type-label">{{ typeLabel(record.type) }}</span>
                <span class="status-label" :class="`status-${record.status}`">{{ record.status }}</span>
              </div>
              <h2>{{ record.title }}</h2>
            </div>
            <div class="record-actions">
              <button class="secondary-button" type="button" :disabled="isLoadingImages" @click="openEditForm(record)">Edit</button>
              <button class="delete-button" type="button" :disabled="deletingId === record._id" @click="deleteRecord(record)">
                {{ deletingId === record._id ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
          <p v-if="record.summary" class="record-summary">{{ record.summary }}</p>
          <p class="record-body">{{ record.body }}</p>
          <p v-if="record.images?.length" class="gallery-count">{{ record.images.length }} attached image{{ record.images.length === 1 ? '' : 's' }}</p>
          <a v-if="record.sourceUrl" class="source-link" :href="record.sourceUrl" target="_blank" rel="noopener noreferrer">
            Open source link
          </a>
          <p v-if="record.type === 'event'" class="event-details">
            {{ formatEventDate(record.eventStartAt) }}<span v-if="record.eventEndAt"> – {{ formatEventDate(record.eventEndAt) }}</span>
            · {{ record.location }}
          </p>
          <small>Last updated {{ formatDate(record.updatedAt) }}</small>
        </div>
      </article>
    </div>

    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
      <form class="content-form" @submit.prevent="saveRecord">
        <div class="form-heading">
          <div>
            <h2>{{ editingRecord ? 'Edit content' : 'Add content' }}</h2>
            <p>Fields marked required must be filled in before saving.</p>
          </div>
          <button class="close-button" type="button" aria-label="Close form" @click="closeForm">×</button>
        </div>

        <p v-if="formError" class="notice error-notice" role="alert">{{ formError }}</p>

        <label class="form-field">
          <span>Content type <b aria-hidden="true">*</b></span>
          <select v-model="form.type" :disabled="Boolean(editingRecord)" required>
            <option v-for="item in contentTypes.slice(1)" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>Title <b aria-hidden="true">*</b></span>
          <input v-model.trim="form.title" maxlength="140" required />
        </label>

        <label class="form-field">
          <span>Short description</span>
          <textarea v-model.trim="form.summary" rows="2" maxlength="300"></textarea>
        </label>

        <label class="form-field">
          <span>Details <b aria-hidden="true">*</b></span>
          <textarea v-model.trim="form.body" rows="6" maxlength="12000" required></textarea>
        </label>

        <label class="form-field">
          <span>Source / more information link</span>
          <input v-model.trim="form.sourceUrl" type="url" placeholder="https://..." />
          <small>Residents can open this link in an in-app browser. Use an HTTPS link.</small>
        </label>

        <label class="form-field">
          <span>Image URL</span>
          <input v-model.trim="form.imageUrl" type="url" placeholder="https://example.com/image.jpg" />
          <small>Optional direct HTTPS link to an image. Residents will see it in the content card.</small>
        </label>

        <template v-if="form.type === 'event'">
          <label class="form-field">
            <span>Starts <b aria-hidden="true">*</b></span>
            <input v-model="form.eventStartAt" type="datetime-local" required />
          </label>
          <label class="form-field">
            <span>Ends</span>
            <input v-model="form.eventEndAt" type="datetime-local" />
          </label>
          <label class="form-field">
            <span>Location <b aria-hidden="true">*</b></span>
            <input v-model.trim="form.location" maxlength="240" required />
          </label>
        </template>

        <div class="form-field">
          <span>Image gallery</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            :disabled="isLoadingImages || isSaving"
            @change="handleImageSelection"
          />
          <small>JPEG, PNG, or WebP. Up to 5 images and 8 MB total; each file can be up to 2 MB.</small>
          <small v-if="isLoadingImages">Loading attached image previews...</small>
          <div v-if="visibleImages.length" class="image-gallery">
            <div v-for="image in visibleImages" :key="image.id" class="gallery-image">
              <img :src="image.previewUrl" :alt="image.name" />
              <span :title="image.name">{{ image.name }}</span>
              <button type="button" :disabled="isSaving" @click="removeImage(image)">
                {{ image.existing ? 'Remove' : 'Cancel' }}
              </button>
            </div>
          </div>
          <small>{{ visibleImages.length }} / 5 images · {{ formatBytes(visibleImageBytes) }} / 8 MB</small>
        </div>

        <label class="form-field">
          <span>Visibility</span>
          <select v-model="form.status">
            <option value="draft">Draft — only visible to admins</option>
            <option value="published">Published — visible from the public API</option>
          </select>
        </label>

        <div class="form-actions">
          <button class="secondary-button" type="button" :disabled="isSaving" @click="closeForm">Cancel</button>
          <button class="primary-button" type="submit" :disabled="isSaving || isLoadingImages">
            {{ isSaving ? 'Saving...' : editingRecord ? 'Save changes' : 'Create content' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { contentApi } from '../services/api'

const contentTypes = [
  { value: 'all', label: 'All content' },
  { value: 'recycle', label: 'Recycle' },
  { value: 'event', label: 'Events' },
  { value: 'tip', label: 'Tips' },
  { value: 'blog', label: 'Blog' }
]

const selectedType = ref('all')
const records = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const deletingId = ref('')
const isLoadingImages = ref(false)
const showForm = ref(false)
const editingRecord = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const formError = ref('')
const existingImages = ref([])
const selectedImages = ref([])
let nextImageId = 0

const emptyForm = () => ({
  type: selectedType.value === 'all' ? 'recycle' : selectedType.value,
  title: '',
  summary: '',
  body: '',
  imageUrl: '',
  sourceUrl: '',
  status: 'draft',
  eventStartAt: '',
  eventEndAt: '',
  location: ''
})
const form = reactive(emptyForm())

const selectedTypeLabel = computed(() =>
  contentTypes.find((item) => item.value === selectedType.value)?.label || 'Content'
)
const visibleImages = computed(() => [
  ...existingImages.value.filter((image) => !image.removed),
  ...selectedImages.value.filter((image) => !image.removed)
])
const visibleImageBytes = computed(() =>
  visibleImages.value.reduce((total, image) => total + image.size, 0)
)

function typeLabel(type) {
  return contentTypes.find((item) => item.value === type)?.label || type
}

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function dateTimeToIso(value) {
  return value ? new Date(value).toISOString() : ''
}

function formatEventDate(value) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleString()
}

function formatDate(value) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString()
}

function formatBytes(value) {
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

function releaseImagePreviews() {
  for (const image of [...existingImages.value, ...selectedImages.value]) {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl)
  }
  existingImages.value = []
  selectedImages.value = []
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, dataUrl: reader.result })
    reader.onerror = () => reject(new Error(`Could not read image "${file.name}".`))
    reader.readAsDataURL(file)
  })
}

function handleImageSelection(event) {
  formError.value = ''
  const files = Array.from(event.target.files || [])
  event.target.value = ''

  const currentCount = visibleImages.value.length
  const currentBytes = visibleImageBytes.value
  const acceptedFiles = []
  let nextBytes = currentBytes

  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      formError.value = `"${file.name}" is not a JPEG, PNG, or WebP image.`
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      formError.value = `"${file.name}" exceeds the 2 MB per-image limit.`
      return
    }
    if (currentCount + acceptedFiles.length + 1 > 5) {
      formError.value = 'A content item can have at most 5 images.'
      return
    }
    nextBytes += file.size
    if (nextBytes > 8 * 1024 * 1024) {
      formError.value = 'The total image size cannot exceed 8 MB.'
      return
    }
    acceptedFiles.push(file)
  }

  selectedImages.value.push(...acceptedFiles.map((file) => ({
    id: `new-image-${nextImageId++}`,
    name: file.name,
    size: file.size,
    file,
    previewUrl: URL.createObjectURL(file),
    existing: false
  })))
}

function removeImage(image) {
  if (image.existing) {
    image.removed = true
    URL.revokeObjectURL(image.previewUrl)
  } else {
    selectedImages.value = selectedImages.value.filter((item) => item.id !== image.id)
    URL.revokeObjectURL(image.previewUrl)
  }
}

async function loadContent() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const response = await contentApi.getManaged(selectedType.value === 'all' ? '' : selectedType.value)
    records.value = response?.data || []
  } catch (error) {
    errorMessage.value = error.message || 'Unable to load community content.'
  } finally {
    isLoading.value = false
  }
}

async function selectType(type) {
  selectedType.value = type
  successMessage.value = ''
  await loadContent()
}

function setFormValues(values) {
  Object.assign(form, values)
}

function openCreateForm() {
  releaseImagePreviews()
  editingRecord.value = null
  formError.value = ''
  setFormValues(emptyForm())
  showForm.value = true
}

async function openEditForm(record) {
  releaseImagePreviews()
  editingRecord.value = record
  formError.value = ''
  setFormValues({
    type: record.type,
    title: record.title,
    summary: record.summary || '',
    body: record.body,
    imageUrl: record.imageUrl || '',
    sourceUrl: record.sourceUrl || '',
    status: record.status,
    eventStartAt: toLocalDateTime(record.eventStartAt),
    eventEndAt: toLocalDateTime(record.eventEndAt),
    location: record.location || ''
  })
  showForm.value = true
  isLoadingImages.value = true
  try {
    existingImages.value = await Promise.all((record.images || []).map(async (image) => {
      const blob = await contentApi.getImage(record._id, image.id, true)
      return {
        id: image.id,
        name: image.name,
        size: image.size,
        previewUrl: URL.createObjectURL(blob),
        existing: true,
        removed: false
      }
    }))
  } catch (error) {
    formError.value = error.message || 'Unable to load attached image previews.'
  } finally {
    isLoadingImages.value = false
  }
}

function closeForm() {
  if (isSaving.value || isLoadingImages.value) return
  releaseImagePreviews()
  showForm.value = false
  editingRecord.value = null
}

async function saveRecord() {
  formError.value = ''
  const payload = {
    type: form.type,
    title: form.title,
    summary: form.summary,
    body: form.body,
    imageUrl: form.imageUrl,
    sourceUrl: form.sourceUrl,
    status: form.status,
    eventStartAt: form.type === 'event' ? dateTimeToIso(form.eventStartAt) : '',
    eventEndAt: form.type === 'event' ? dateTimeToIso(form.eventEndAt) : '',
    location: form.type === 'event' ? form.location : ''
  }

  if (payload.sourceUrl && !payload.sourceUrl.startsWith('https://')) {
    formError.value = 'Source link must start with https://.'
    return
  }
  if (payload.imageUrl && !payload.imageUrl.startsWith('https://')) {
    formError.value = 'Image URL must start with https://.'
    return
  }

  isSaving.value = true
  try {
    const newImageUploads = await Promise.all(
      selectedImages.value.filter((image) => !image.removed).map((image) => fileToDataUrl(image.file))
    )
    const updatePayload = editingRecord.value
      ? {
          ...payload,
          appendImages: newImageUploads,
          removeImageIds: existingImages.value.filter((image) => image.removed).map((image) => image.id)
        }
      : { ...payload, images: newImageUploads }
    const response = editingRecord.value
      ? await contentApi.update(editingRecord.value._id, updatePayload)
      : await contentApi.create(updatePayload)
    const savedRecord = response?.data
    if (!savedRecord) throw new Error('The server did not return the saved content.')

    const index = records.value.findIndex((record) => record._id === savedRecord._id)
    if (index === -1) records.value.unshift(savedRecord)
    else records.value.splice(index, 1, savedRecord)
    records.value = records.value.filter((record) =>
      selectedType.value === 'all' || record.type === selectedType.value
    )
    successMessage.value = `${typeLabel(savedRecord.type)} content ${editingRecord.value ? 'updated' : 'created'}.`
    releaseImagePreviews()
    showForm.value = false
    editingRecord.value = null
  } catch (error) {
    formError.value = error.message || 'Unable to save content.'
  } finally {
    isSaving.value = false
  }
}

async function deleteRecord(record) {
  if (!window.confirm(`Delete "${record.title}"? This cannot be undone.`)) return
  deletingId.value = record._id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await contentApi.delete(record._id)
    records.value = records.value.filter((item) => item._id !== record._id)
    successMessage.value = 'Content deleted.'
  } catch (error) {
    errorMessage.value = error.message || 'Unable to delete content.'
  } finally {
    deletingId.value = ''
  }
}

onMounted(loadContent)
onUnmounted(releaseImagePreviews)
</script>

<style scoped>
.content-page {
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1280px;
  margin: 0 auto;
}

.page-header,
.content-toolbar,
.record-heading,
.form-heading,
.form-actions,
.record-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.page-header h1 {
  margin: 0;
  color: var(--text-main);
  font-size: 25px;
}

.page-header p,
.form-heading p {
  margin: 6px 0 0;
  color: var(--text-dim);
  font-size: 14px;
}

.primary-button,
.secondary-button,
.delete-button {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 13px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button {
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
}

.secondary-button {
  background: var(--bg-surface);
  color: var(--text-main);
}

.delete-button {
  border-color: #dc2626;
  background: transparent;
  color: #dc2626;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.content-toolbar {
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.type-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.type-tabs button {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 8px 13px;
  background: transparent;
  color: var(--text-dim);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.type-tabs button.selected {
  border-color: var(--primary);
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 700;
}

.notice {
  margin: 0;
  border-radius: 8px;
  padding: 11px 13px;
  font-size: 13px;
}

.error-notice {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.success-notice {
  background: rgba(22, 163, 74, 0.1);
  color: #16a34a;
}

.empty-state {
  display: flex;
  min-height: 170px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-dim);
  text-align: center;
}

.empty-state strong {
  color: var(--text-main);
}

.record-list {
  display: grid;
  gap: 12px;
}

.record-card {
  display: flex;
  gap: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-surface);
}

.record-image {
  width: 150px;
  min-height: 150px;
  object-fit: cover;
  background: var(--bg-input);
}

.record-main {
  min-width: 0;
  flex: 1;
  padding: 16px;
}

.record-heading {
  align-items: flex-start;
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.type-label,
.status-label {
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--bg-input);
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
}

.status-published {
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
}

.status-draft {
  background: rgba(234, 179, 8, 0.13);
  color: #ca8a04;
}

.record-heading h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 17px;
}

.record-actions {
  flex-shrink: 0;
}

.record-summary,
.record-body,
.event-details {
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.6;
}

.record-summary {
  margin: 9px 0 0;
  color: var(--text-main);
  font-weight: 600;
}

.record-body {
  margin: 7px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.gallery-count,
.source-link {
  display: block;
  margin: 8px 0 0;
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
}

.source-link {
  width: fit-content;
  text-decoration: underline;
}

.event-details {
  color: var(--primary);
  font-weight: 600;
}

.record-main small {
  color: var(--text-dim);
  font-size: 11px;
}

.modal-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 24px;
  background: rgba(0, 0, 0, 0.56);
}

.content-form {
  display: grid;
  gap: 15px;
  width: min(100%, 620px);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 22px;
  background: var(--bg-surface);
  color: var(--text-main);
}

.form-heading {
  align-items: flex-start;
}

.form-heading h2 {
  margin: 0;
  font-size: 20px;
}

.close-button {
  border: 0;
  background: transparent;
  color: var(--text-dim);
  font-size: 25px;
  cursor: pointer;
}

.form-field {
  display: grid;
  gap: 6px;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 600;
}

.form-field b {
  color: #dc2626;
}

.form-field input,
.form-field textarea,
.form-field select {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 10px;
  background: var(--bg-input);
  color: var(--text-main);
  font: inherit;
  font-size: 13px;
}

.form-field textarea {
  resize: vertical;
}

.form-field small {
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 400;
}

.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
  gap: 10px;
  margin-top: 4px;
}

.gallery-image {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  background: var(--bg-input);
}

.gallery-image img {
  width: 100%;
  height: 85px;
  border-radius: 5px;
  object-fit: cover;
}

.gallery-image span {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-image button {
  border: 0;
  padding: 4px;
  background: transparent;
  color: #dc2626;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.form-actions {
  justify-content: flex-end;
  padding-top: 4px;
}

@media (max-width: 700px) {
  .page-header,
  .record-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .record-card {
    flex-direction: column;
  }

  .record-image {
    width: 100%;
    height: 170px;
  }

  .record-actions {
    align-self: stretch;
  }

  .modal-backdrop {
    padding: 10px;
  }

  .content-form {
    max-height: calc(100vh - 20px);
    padding: 16px;
  }
}
</style>
