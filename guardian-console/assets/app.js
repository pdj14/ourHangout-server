const app = document.getElementById('app')
const runtimeConfig = window.__GUARDIAN_CONFIG__ || {
  googleClientId: '',
  guardianMasterEmails: []
}

const TAB_META = {
  dashboard: {
    title: 'Overview',
    copy: 'DB summary, family links, and storage warnings.'
  },
  users: {
    title: 'Users',
    copy: 'Account search, profile updates, and session control.'
  },
  rooms: {
    title: 'Messages',
    copy: 'Parent review for children messages and test cleanup.'
  },
  storage: {
    title: 'Storage',
    copy: 'Assets, orphan files, and disk usage checks.'
  }
}

const state = {
  session: loadSession(),
  user: null,
  activeTab: 'dashboard',
  flash: null,
  loading: {
    dashboard: false,
    users: false,
    rooms: false,
    roomMessages: false,
    storage: false,
    auth: false
  },
  summary: null,
  familyLinks: [],
  users: [],
  rooms: [],
  selectedRoomId: null,
  roomMessages: {
    items: [],
    nextBefore: null
  },
  storageOverview: null,
  storageAssets: [],
  editDraft: null,
  bulkDeletePreview: null,
  googleButtonReady: false,
  filters: {
    users: {
      q: '',
      role: '',
      limit: 100
    },
    rooms: {
      type: '',
      memberUserId: '',
      q: '',
      limit: 60
    },
    storage: {
      ownerUserId: '',
      status: '',
      unreferencedOnly: true,
      limit: 80
    },
    bulkDelete: {
      searchText: 'test',
      roomId: '',
      senderId: '',
      before: '',
      kinds: ['text', 'system'],
      limit: 80
    }
  }
}

function getMasterEmailLabel() {
  return runtimeConfig.guardianMasterEmails?.[0] || 'dj14.park@gmail.com'
}

function hasGoogleClientConfig() {
  return !!runtimeConfig.googleClientId
}

function hasGoogleIdentityApi() {
  return !!window.google?.accounts?.id
}

function loadSession() {
  try {
    const raw = localStorage.getItem('guardian-console-session')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(session) {
  state.session = session
  localStorage.setItem('guardian-console-session', JSON.stringify(session))
}

function clearSession() {
  state.session = null
  state.user = null
  localStorage.removeItem('guardian-console-session')
}

function setFlash(type, message) {
  state.flash = { type, message }
  render()
}

function clearFlash() {
  state.flash = null
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

function roleBadge(role) {
  if (role === 'parent') {
    return '<span class="badge teal">Parent</span>'
  }

  return '<span class="badge">User</span>'
}

function statusBadge(label, tone = '') {
  const toneClass = tone ? ` ${tone}` : ''
  return `<span class="badge${toneClass}">${escapeHtml(label)}</span>`
}

function isSelectedTab(tab) {
  return state.activeTab === tab ? 'is-active' : ''
}

function getSelectedRoom() {
  return state.rooms.find((room) => room.id === state.selectedRoomId) || null
}

function buildQuery(params) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return
    searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function apiRequest(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {})
  const isBodyObject =
    options.body &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    typeof options.body === 'object'

  if (isBodyObject) {
    headers.set('Content-Type', 'application/json')
  }

  if (state.session?.accessToken) {
    headers.set('Authorization', `Bearer ${state.session.accessToken}`)
  }

  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: isBodyObject ? JSON.stringify(options.body) : options.body
  })

  if (response.status === 401 && retry && state.session?.refreshToken) {
    const refreshed = await refreshSession().catch(() => false)
    if (refreshed) {
      return apiRequest(path, options, false)
    }
  }

  let payload = null
  if (response.status !== 204) {
    payload = await response.json().catch(() => null)
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.error?.message || `Request failed (${response.status})`
    throw new Error(message)
  }

  return payload?.data ?? payload
}

async function refreshSession() {
  if (!state.session?.refreshToken) return false

  const response = await fetch('/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: state.session.refreshToken
    })
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    clearSession()
    throw new Error(payload?.error?.message || 'Could not refresh session.')
  }

  saveSession({
    ...state.session,
    accessToken: payload.data.tokens.accessToken,
    refreshToken: payload.data.tokens.refreshToken
  })

  return true
}

async function login(email, password) {
  state.loading.auth = true
  render()

  try {
    const data = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email, password }
    })

    saveSession({
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken
    })
    state.user = data.user
    clearFlash()
    await loadAllData()
  } finally {
    state.loading.auth = false
    render()
  }
}

async function loginWithGoogle(idToken) {
  state.loading.auth = true
  render()

  try {
    const data = await apiRequest('/v1/auth/google', {
      method: 'POST',
      body: { idToken }
    })

    saveSession({
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken
    })
    state.user = data.user
    clearFlash()
    await loadAllData()
  } finally {
    state.loading.auth = false
    render()
  }
}

async function fetchMe() {
  return apiRequest('/v1/auth/me')
}

async function loadDashboard() {
  state.loading.dashboard = true
  render()

  try {
    const [summary, familyLinks] = await Promise.all([
      apiRequest('/v1/guardian/summary'),
      apiRequest('/v1/guardian/family-links')
    ])
    state.summary = summary
    state.familyLinks = familyLinks.items || []
  } finally {
    state.loading.dashboard = false
    render()
  }
}

async function loadUsers() {
  state.loading.users = true
  render()

  try {
    const data = await apiRequest(`/v1/guardian/users${buildQuery(state.filters.users)}`)
    state.users = data.items || []

    if (state.editDraft) {
      const fresh = state.users.find((item) => item.id === state.editDraft.id)
      if (!fresh) {
        state.editDraft = null
      }
    }
  } finally {
    state.loading.users = false
    render()
  }
}

async function loadRooms() {
  state.loading.rooms = true
  render()

  try {
    const data = await apiRequest(`/v1/guardian/rooms${buildQuery(state.filters.rooms)}`)
    state.rooms = data.items || []

    if (!state.selectedRoomId || !state.rooms.some((room) => room.id === state.selectedRoomId)) {
      state.selectedRoomId = state.rooms[0]?.id || null
    }

    if (state.selectedRoomId) {
      await loadRoomMessages({ reset: true })
    } else {
      state.roomMessages = { items: [], nextBefore: null }
    }
  } finally {
    state.loading.rooms = false
    render()
  }
}

async function loadRoomMessages({ reset = false } = {}) {
  if (!state.selectedRoomId) return

  state.loading.roomMessages = true
  render()

  try {
    const data = await apiRequest(
      `/v1/guardian/rooms/${state.selectedRoomId}/messages${buildQuery({
        limit: 80,
        before: reset ? '' : state.roomMessages.nextBefore
      })}`
    )

    state.roomMessages = {
      items: reset ? data.items || [] : [...state.roomMessages.items, ...(data.items || [])],
      nextBefore: data.nextBefore || null
    }
  } finally {
    state.loading.roomMessages = false
    render()
  }
}

async function loadStorage() {
  state.loading.storage = true
  render()

  try {
    const [overview, assets] = await Promise.all([
      apiRequest('/v1/guardian/storage'),
      apiRequest(`/v1/guardian/storage/assets${buildQuery(state.filters.storage)}`)
    ])
    state.storageOverview = overview
    state.storageAssets = assets.items || []
  } finally {
    state.loading.storage = false
    render()
  }
}

async function loadAllData() {
  state.user = await fetchMe()
  await Promise.all([loadDashboard(), loadUsers(), loadRooms(), loadStorage()])
}

function renderFlash() {
  if (!state.flash) return ''
  return `<div class="flash ${escapeHtml(state.flash.type)}">${escapeHtml(state.flash.message)}</div>`
}

function renderTopbar() {
  const name = state.user?.displayName || state.user?.email || 'Guardian'
  return `
    <div class="topbar">
      <section class="hero">
        <span class="hero-kicker">ourHangout Guardian Console</span>
        <h1>Parent operations for ourHangout</h1>
        <p>Review DB content, inspect children message history, clean up test messages, and manage storage from one place.</p>
      </section>
      <section class="session-card">
        <div>
          <div class="session-label">Signed In</div>
          <div class="session-name">${escapeHtml(name)}</div>
          <div class="session-meta">${escapeHtml(state.user?.email || '')}<br />Role: ${escapeHtml(state.user?.role || '-')}</div>
        </div>
        <div class="top-actions">
          <button class="button secondary" data-action="refresh-current">Refresh Current Tab</button>
          <button class="button ghost" data-action="logout">Log Out</button>
        </div>
      </section>
    </div>
  `
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="nav-title">Console Areas</div>
      <div class="nav-list">
        ${Object.entries(TAB_META)
          .map(
            ([key, meta]) => `
              <button class="nav-button ${isSelectedTab(key)}" data-tab="${key}">
                <strong>${escapeHtml(meta.title)}</strong>
                <span>${escapeHtml(meta.copy)}</span>
              </button>
            `
          )
          .join('')}
      </div>
    </aside>
  `
}

function renderKpi(label, value, sub) {
  return `
    <article class="kpi">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
      <div class="kpi-sub">${escapeHtml(sub)}</div>
    </article>
  `
}

function scheduleGoogleButtonRender() {
  if (state.session || !hasGoogleClientConfig()) {
    state.googleButtonReady = false
    return
  }

  const renderGoogleButton = () => {
    const container = document.getElementById('google-signin-area')
    if (!container || state.session) return

    if (!hasGoogleIdentityApi()) {
      window.setTimeout(renderGoogleButton, 250)
      return
    }

    container.innerHTML = ''
    window.google.accounts.id.initialize({
      client_id: runtimeConfig.googleClientId,
      callback: async (response) => {
        if (!response?.credential) {
          setFlash('error', 'Google sign-in did not return an ID token.')
          return
        }

        try {
          await loginWithGoogle(response.credential)
        } catch (error) {
          setFlash('error', error.message || 'Google sign-in failed.')
        }
      }
    })

    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 320
    })

    state.googleButtonReady = true
  }

  window.setTimeout(renderGoogleButton, 0)
}

function renderLogin() {
  return `
    <div class="login-wrap">
      <section class="login-card">
        <span class="hero-kicker">Parent Access Only</span>
        <h1>Guardian Console</h1>
        <p>Use Google sign-in for the master guardian account. The configured master address is ${escapeHtml(getMasterEmailLabel())}.</p>
        ${renderFlash()}
        <div class="section-stack">
          <div class="field">
            <label>Google Sign-In</label>
            ${
              hasGoogleClientConfig()
                ? `<div id="google-signin-area"></div>`
                : `<div class="empty-state">Google web client ID is not configured on this server yet.</div>`
            }
          </div>
        </div>
        <form id="login-form" class="section-stack" style="margin-top:18px">
          <div class="field">
            <label>Fallback Email Login</label>
            <div class="muted">Keep this only as a fallback path while Google login is being used.</div>
          </div>
          <div class="field">
            <label for="login-email">Email</label>
            <input class="input" id="login-email" name="email" type="email" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="login-password">Password</label>
            <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <div class="button-row">
            <button class="button primary" type="submit" ${state.loading.auth ? 'disabled' : ''}>
              ${state.loading.auth ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
        <div class="footer-note">This page uses /v1/auth/google, /v1/auth/login, and /v1/guardian/*. Access is restricted to parent-role accounts and configured guardian master accounts.</div>
      </section>
    </div>
  `
}

function renderDashboard() {
  const summary = state.summary

  if (state.loading.dashboard && !summary) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Overview</h2>
            <p class="panel-copy">Loading summary data from the server.</p>
          </div>
        </div>
        <div class="empty-state">Reading DB summary, family links, and storage warnings.</div>
      </section>
    `
  }

  if (!summary) {
    return `
      <section class="panel">
        <div class="empty-state">No dashboard data available.</div>
      </section>
    `
  }

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Operational Snapshot</h2>
          <p class="panel-copy">Quick status across accounts, rooms, messages, and storage.</p>
        </div>
        <div class="pill-row">
          ${statusBadge(`Parent-child ${summary.moderation.parentChildLinks}`, 'teal')}
          ${statusBadge(`Open reports ${summary.moderation.openReports}`, summary.moderation.openReports > 0 ? 'danger' : 'teal')}
          ${statusBadge(`Test-like ${summary.messages.recentTestLike}`, summary.messages.recentTestLike > 0 ? 'danger' : '')}
        </div>
      </div>
      <div class="kpi-grid">
        ${renderKpi('Users', summary.users.total, `Parent ${summary.users.parents} / Child ${summary.users.children}`)}
        ${renderKpi('Rooms', summary.rooms.total, `Direct ${summary.rooms.direct} / Group ${summary.rooms.group}`)}
        ${renderKpi('Messages', summary.messages.total, `Text ${summary.messages.text} / Media ${summary.messages.image + summary.messages.video}`)}
        ${renderKpi('Storage', formatBytes(summary.storage.trackedBytes), `Disk ${formatBytes(summary.storage.actualDiskBytes)}`)}
      </div>
    </section>

    <section class="split-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Family Links</h2>
            <p class="panel-copy">Use active parent-child links to narrow message review to children.</p>
          </div>
        </div>
        <div class="card-list">
          ${
            state.familyLinks.length
              ? state.familyLinks
                  .map(
                    (link) => `
                      <article class="info-card">
                        <div class="message-head">
                          <strong>${escapeHtml(link.parent.name)} -> ${escapeHtml(link.child.name)}</strong>
                          <span class="chip">${formatDate(link.createdAt)}</span>
                        </div>
                        <div class="muted">${escapeHtml(link.parent.email)} / ${escapeHtml(link.child.email)}</div>
                      </article>
                    `
                  )
                  .join('')
              : '<div class="empty-state">No active parent-child links were found.</div>'
          }
        </div>
      </section>

      <div class="mini-grid">
        <section class="mini-panel">
          <h3>Storage Alerts</h3>
          <p>Review orphan files and missing tracked uploads together.</p>
          <div class="stat-grid">
            ${statusBadge(`Orphan files ${summary.storage.orphanFileCount}`, summary.storage.orphanFileCount > 0 ? 'danger' : 'teal')}
            ${statusBadge(`Missing tracked ${summary.storage.missingTrackedFileCount}`, summary.storage.missingTrackedFileCount > 0 ? 'danger' : 'teal')}
          </div>
          <div class="card-list" style="margin-top:12px">
            ${
              summary.orphanFiles.length
                ? summary.orphanFiles
                    .map(
                      (file) => `
                        <article class="info-card">
                          <strong>${escapeHtml(file.relativePath)}</strong>
                          <div class="muted">${formatBytes(file.sizeBytes)}</div>
                        </article>
                      `
                    )
                    .join('')
                : '<div class="empty-state">No orphan files are currently detected.</div>'
            }
          </div>
        </section>

        <section class="mini-panel">
          <h3>Top Storage Users</h3>
          <p>Largest completed media owners first.</p>
          <div class="card-list">
            ${
              summary.topStorageUsers.length
                ? summary.topStorageUsers
                    .map(
                      (user) => `
                        <article class="info-card">
                          <div class="message-head">
                            <strong>${escapeHtml(user.name)}</strong>
                            ${roleBadge(state.users.find((item) => item.id === user.userId)?.role || 'user')}
                          </div>
                          <div class="muted">${escapeHtml(user.email)}</div>
                          <div class="message-foot" style="margin-top:10px">
                            <span class="chip">${formatBytes(user.storageBytes)}</span>
                            <span class="chip">${user.assetCount} assets</span>
                          </div>
                        </article>
                      `
                    )
                    .join('')
                : '<div class="empty-state">No completed upload assets yet.</div>'
            }
          </div>
        </section>
      </div>
    </section>
  `
}

function renderUserOptions(selectedValue, includeBlankLabel = 'All users') {
  return `
    <option value="">${escapeHtml(includeBlankLabel)}</option>
    ${state.users
      .map(
        (user) => `
          <option value="${escapeHtml(user.id)}" ${user.id === selectedValue ? 'selected' : ''}>
            ${escapeHtml(user.effectiveName)} | ${escapeHtml(user.email)}
          </option>
        `
      )
      .join('')}
  `
}

function renderUsers() {
  const draft = state.editDraft

  return `
    <section class="panel section-stack">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">User Management</h2>
          <p class="panel-copy">Update display name, status, phone, locale, and role, then revoke sessions when needed.</p>
        </div>
      </div>

      <form id="user-filter-form" class="form-grid">
        <div class="wide-field">
          <label for="user-q">Search</label>
          <input class="input" id="user-q" name="q" value="${escapeHtml(state.filters.users.q)}" placeholder="email, display name, phone" />
        </div>
        <div class="field">
          <label for="user-role">Role</label>
          <select class="select" id="user-role" name="role">
            <option value="">All</option>
            <option value="parent" ${state.filters.users.role === 'parent' ? 'selected' : ''}>Parent</option>
            <option value="user" ${state.filters.users.role === 'user' ? 'selected' : ''}>User</option>
          </select>
        </div>
        <div class="field">
          <label for="user-limit">Limit</label>
          <input class="input" id="user-limit" name="limit" type="number" min="1" max="200" value="${escapeHtml(state.filters.users.limit)}" />
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">Load Users</button>
          <button class="button ghost" type="button" data-action="refresh-users">Refresh</button>
        </div>
      </form>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Activity</th>
              <th>Storage</th>
              <th>Meta</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.users.length
                ? state.users
                    .map(
                      (user) => `
                        <tr>
                          <td>
                            <strong>${escapeHtml(user.effectiveName)}</strong>
                            <div class="muted">${escapeHtml(user.email)}</div>
                            <div class="muted">${user.phoneE164 ? escapeHtml(user.phoneE164) : 'No phone set'}</div>
                          </td>
                          <td>${roleBadge(user.role)}</td>
                          <td>
                            <div class="stack">
                              <span>${user.roomCount} rooms</span>
                              <span>${user.messageCount} messages</span>
                              <span>${user.familyLinkCount} family links</span>
                            </div>
                          </td>
                          <td>${formatBytes(user.storageBytes)}</td>
                          <td>
                            <div class="stack muted">
                              <span>${user.locale || '-'}</span>
                              <span>${user.statusMessage ? escapeHtml(user.statusMessage) : 'No status message'}</span>
                              <span>${formatDate(user.updatedAt)}</span>
                            </div>
                          </td>
                          <td>
                            <div class="button-row">
                              <button class="button secondary" type="button" data-edit-user="${escapeHtml(user.id)}">Edit</button>
                              <button class="button danger" type="button" data-revoke-user="${escapeHtml(user.id)}">Revoke Sessions</button>
                            </div>
                          </td>
                        </tr>
                      `
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="6">
                      <div class="empty-state">No users matched this filter.</div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>

      ${
        draft
          ? `
            <section class="mini-panel">
              <div class="panel-header">
                <div>
                  <h3 style="margin:0">Edit ${escapeHtml(draft.effectiveName)}</h3>
                  <p class="panel-copy">Save writes directly to the users table.</p>
                </div>
                <button class="button ghost" type="button" data-action="cancel-edit">Close</button>
              </div>
              <form id="user-edit-form" class="form-grid">
                <input type="hidden" name="userId" value="${escapeHtml(draft.id)}" />
                <div class="field">
                  <label for="edit-role">Role</label>
                  <select class="select" id="edit-role" name="role">
                    <option value="parent" ${draft.role === 'parent' ? 'selected' : ''}>Parent</option>
                    <option value="user" ${draft.role === 'user' ? 'selected' : ''}>User</option>
                  </select>
                </div>
                <div class="wide-field">
                  <label for="edit-name">Display Name</label>
                  <input class="input" id="edit-name" name="displayName" value="${escapeHtml(draft.displayName || '')}" />
                </div>
                <div class="field">
                  <label for="edit-phone">Phone E.164</label>
                  <input class="input" id="edit-phone" name="phoneE164" value="${escapeHtml(draft.phoneE164 || '')}" placeholder="+821012345678" />
                </div>
                <div class="field">
                  <label for="edit-locale">Locale</label>
                  <input class="input" id="edit-locale" name="locale" value="${escapeHtml(draft.locale || '')}" placeholder="ko-KR" />
                </div>
                <div class="wide-field">
                  <label for="edit-status">Status Message</label>
                  <textarea class="textarea" id="edit-status" name="statusMessage">${escapeHtml(draft.statusMessage || '')}</textarea>
                </div>
                <div class="button-row">
                  <button class="button primary" type="submit">Save</button>
                  <button class="button ghost" type="button" data-action="cancel-edit">Cancel</button>
                </div>
              </form>
            </section>
          `
          : ''
      }
    </section>
  `
}

function renderRooms() {
  const selectedRoom = getSelectedRoom()
  const bulkKinds = new Set(state.filters.bulkDelete.kinds)

  return `
    <section class="panel section-stack">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Message Review</h2>
          <p class="panel-copy">Parents can review room history, inspect children conversations, and clean up test data.</p>
        </div>
      </div>

      <form id="room-filter-form" class="form-grid">
        <div class="field">
          <label for="room-type">Room Type</label>
          <select class="select" id="room-type" name="type">
            <option value="">All</option>
            <option value="direct" ${state.filters.rooms.type === 'direct' ? 'selected' : ''}>Direct</option>
            <option value="group" ${state.filters.rooms.type === 'group' ? 'selected' : ''}>Group</option>
          </select>
        </div>
        <div class="wide-field">
          <label for="room-member">Child Filter</label>
          <select class="select" id="room-member" name="memberUserId">
            <option value="">All linked children</option>
            ${state.familyLinks
              .map(
                (link) => `
                  <option value="${escapeHtml(link.child.userId)}" ${state.filters.rooms.memberUserId === link.child.userId ? 'selected' : ''}>
                    ${escapeHtml(link.child.name)} | ${escapeHtml(link.child.email)}
                  </option>
                `
              )
              .join('')}
          </select>
        </div>
        <div class="wide-field">
          <label for="room-q">Search</label>
          <input class="input" id="room-q" name="q" value="${escapeHtml(state.filters.rooms.q)}" placeholder="room title, member name, or email" />
        </div>
        <div class="field">
          <label for="room-limit">Limit</label>
          <input class="input" id="room-limit" name="limit" type="number" min="1" max="120" value="${escapeHtml(state.filters.rooms.limit)}" />
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">Load Rooms</button>
          <button class="button ghost" type="button" data-action="refresh-rooms">Refresh</button>
        </div>
      </form>

      <section class="mini-panel">
        <div class="panel-header">
          <div>
            <h3 style="margin:0">Bulk Test Message Cleanup</h3>
            <p class="panel-copy">Default search is set to the word "test". Preview first, then run delete only after confirmation.</p>
          </div>
        </div>
        <form id="bulk-delete-form" class="form-grid">
          <div class="wide-field">
            <label for="bulk-searchText">Search Text</label>
            <input class="input" id="bulk-searchText" name="searchText" value="${escapeHtml(state.filters.bulkDelete.searchText)}" placeholder="test" />
          </div>
          <div class="field">
            <label for="bulk-roomId">Room</label>
            <select class="select" id="bulk-roomId" name="roomId">
              <option value="">All rooms</option>
              ${state.rooms
                .map(
                  (room) => `
                    <option value="${escapeHtml(room.id)}" ${state.filters.bulkDelete.roomId === room.id ? 'selected' : ''}>
                      ${escapeHtml(room.title)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>
          <div class="field">
            <label for="bulk-senderId">Sender</label>
            <select class="select" id="bulk-senderId" name="senderId">
              ${renderUserOptions(state.filters.bulkDelete.senderId)}
            </select>
          </div>
          <div class="field">
            <label for="bulk-before">Before</label>
            <input class="input" id="bulk-before" name="before" type="datetime-local" value="${escapeHtml(state.filters.bulkDelete.before)}" />
          </div>
          <div class="field">
            <label for="bulk-limit">Limit</label>
            <input class="input" id="bulk-limit" name="limit" type="number" min="1" max="500" value="${escapeHtml(state.filters.bulkDelete.limit)}" />
          </div>
          <div class="wide-field">
            <label>Message Kinds</label>
            <div class="filter-row">
              ${['text', 'system', 'image', 'video']
                .map(
                  (kind) => `
                    <label class="chip">
                      <input type="checkbox" name="kinds" value="${kind}" ${bulkKinds.has(kind) ? 'checked' : ''} />
                      ${kind}
                    </label>
                  `
                )
                .join('')}
            </div>
          </div>
          <div class="button-row">
            <button class="button secondary" type="submit" name="mode" value="preview">Preview</button>
            <button class="button danger" type="submit" name="mode" value="delete">Delete Matches</button>
          </div>
        </form>
        ${
          state.bulkDeletePreview
            ? `
              <div class="card-list" style="margin-top:16px">
                <article class="info-card">
                  <div class="message-head">
                    <strong>Preview Result</strong>
                    ${statusBadge(`${state.bulkDeletePreview.matchedCount} matches`, state.bulkDeletePreview.deletedCount > 0 ? 'danger' : 'teal')}
                  </div>
                  <div class="muted">${state.bulkDeletePreview.dryRun ? 'Preview only. No delete has been executed yet.' : `${state.bulkDeletePreview.deletedCount} messages were deleted.`}</div>
                </article>
                ${
                  state.bulkDeletePreview.items.length
                    ? state.bulkDeletePreview.items
                        .slice(0, 8)
                        .map(
                          (message) => `
                            <article class="info-card">
                              <div class="message-head">
                                <strong>${escapeHtml(message.senderName)} | ${escapeHtml(message.kind)}</strong>
                                <span class="chip">${formatDate(message.createdAt)}</span>
                              </div>
                              <div class="muted">${escapeHtml(message.roomTitle || message.roomId)}</div>
                              <div class="message-body">${escapeHtml(message.text || message.uri || '(empty content)')}</div>
                            </article>
                          `
                        )
                        .join('')
                    : '<div class="empty-state">No messages matched the bulk filter.</div>'
                }
              </div>
            `
            : ''
        }
      </section>

      <div class="room-grid">
        <section class="mini-panel">
          <div class="panel-header">
            <div>
              <h3 style="margin:0">Rooms</h3>
              <p class="panel-copy">Choose a room to inspect message history.</p>
            </div>
          </div>
          <div class="room-list">
            ${
              state.rooms.length
                ? state.rooms
                    .map(
                      (room) => `
                        <button class="room-card ${room.id === state.selectedRoomId ? 'is-selected' : ''}" type="button" data-select-room="${escapeHtml(room.id)}">
                          <div class="room-title">${escapeHtml(room.title)}</div>
                          <div class="room-meta">
                            ${statusBadge(room.type, room.type === 'group' ? 'teal' : '')}
                            <span class="chip">${room.messageCount} messages</span>
                            <span class="chip">${room.activeMemberCount} members</span>
                          </div>
                          <div class="muted" style="margin-top:10px">${escapeHtml(room.members.map((member) => member.name).join(', '))}</div>
                          <div class="muted" style="margin-top:8px">${room.lastMessage ? escapeHtml(`${room.lastMessage.senderName}: ${room.lastMessage.preview || room.lastMessage.kind}`) : 'No messages yet'}</div>
                        </button>
                      `
                    )
                    .join('')
                : '<div class="empty-state">No rooms matched this filter.</div>'
            }
          </div>
        </section>

        <section class="mini-panel">
          <div class="panel-header">
            <div>
              <h3 style="margin:0">${selectedRoom ? escapeHtml(selectedRoom.title) : 'Select a room'}</h3>
              <p class="panel-copy">${selectedRoom ? `${selectedRoom.members.map((member) => member.name).join(', ')}` : 'Select a room on the left to load messages.'}</p>
            </div>
            ${selectedRoom ? '<button class="button ghost" type="button" data-action="refresh-room-messages">Refresh Messages</button>' : ''}
          </div>
          <div class="message-list">
            ${
              selectedRoom
                ? state.roomMessages.items.length
                  ? state.roomMessages.items
                      .map(
                        (message) => `
                          <article class="message-card">
                            <div class="message-head">
                              <strong>${escapeHtml(message.senderName)}</strong>
                              <div class="filter-row">
                                ${statusBadge(message.kind, message.kind === 'system' ? 'teal' : '')}
                                <span class="chip">${formatDate(message.createdAt)}</span>
                              </div>
                            </div>
                            <div class="message-body">${escapeHtml(message.text || '(no text payload)')}</div>
                            ${message.uri ? `<div class="message-media">${escapeHtml(message.uri)}</div>` : ''}
                            <div class="message-foot" style="margin-top:12px">
                              <span class="muted">${escapeHtml(message.delivery)}</span>
                              <button class="button danger" type="button" data-delete-message="${escapeHtml(message.id)}">Delete</button>
                            </div>
                          </article>
                        `
                      )
                      .join('')
                  : '<div class="room-empty">No messages loaded for this room.</div>'
                : '<div class="room-empty">Select a room.</div>'
            }
            ${selectedRoom && state.roomMessages.nextBefore ? '<button class="button ghost" type="button" data-action="load-older">Load Older Messages</button>' : ''}
          </div>
        </section>
      </div>
    </section>
  `
}

function renderStorage() {
  const overview = state.storageOverview

  return `
    <section class="panel section-stack">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Storage Management</h2>
          <p class="panel-copy">Review tracked uploads, unreferenced assets, and disk-only files together.</p>
        </div>
        <div class="button-row">
          <button class="button secondary" type="button" data-action="refresh-storage">Refresh</button>
          <button class="button danger" type="button" data-action="cleanup-orphans">Delete Orphan Files</button>
        </div>
      </div>

      ${
        overview
          ? `
            <div class="kpi-grid">
              ${renderKpi('Tracked', overview.totals.trackedAssets, `Completed ${overview.totals.completedAssets} / Pending ${overview.totals.pendingAssets}`)}
              ${renderKpi('Tracked Bytes', formatBytes(overview.totals.trackedBytes), `Disk ${formatBytes(overview.totals.actualDiskBytes)}`)}
              ${renderKpi('Orphans', overview.totals.orphanFileCount, `Missing tracked ${overview.totals.missingTrackedFileCount}`)}
              ${renderKpi('Failed Assets', overview.totals.failedAssets, 'Rows with failed status')}
            </div>

            <div class="split-grid">
              <section class="mini-panel">
                <h3>By Kind</h3>
                <div class="card-list">
                  ${overview.byKind
                    .map(
                      (item) => `
                        <article class="info-card">
                          <div class="message-head">
                            <strong>${escapeHtml(item.kind)}</strong>
                            <span class="chip">${item.assetCount} assets</span>
                          </div>
                          <div class="muted">${formatBytes(item.totalBytes)}</div>
                        </article>
                      `
                    )
                    .join('')}
                </div>
              </section>
              <section class="mini-panel">
                <h3>Top Users</h3>
                <div class="card-list">
                  ${overview.topUsers
                    .map(
                      (user) => `
                        <article class="info-card">
                          <div class="message-head">
                            <strong>${escapeHtml(user.name)}</strong>
                            <span class="chip">${formatBytes(user.storageBytes)}</span>
                          </div>
                          <div class="muted">${escapeHtml(user.email)}</div>
                          <div class="muted">${user.assetCount} assets</div>
                        </article>
                      `
                    )
                    .join('')}
                </div>
              </section>
            </div>
          `
          : '<div class="empty-state">Loading storage overview.</div>'
      }

      <form id="storage-filter-form" class="form-grid">
        <div class="wide-field">
          <label for="storage-ownerUserId">Owner</label>
          <select class="select" id="storage-ownerUserId" name="ownerUserId">
            ${renderUserOptions(state.filters.storage.ownerUserId, 'All owners')}
          </select>
        </div>
        <div class="field">
          <label for="storage-status">Status</label>
          <select class="select" id="storage-status" name="status">
            <option value="">All</option>
            <option value="completed" ${state.filters.storage.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="pending" ${state.filters.storage.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="failed" ${state.filters.storage.status === 'failed' ? 'selected' : ''}>Failed</option>
          </select>
        </div>
        <div class="field">
          <label for="storage-limit">Limit</label>
          <input class="input" id="storage-limit" name="limit" type="number" min="1" max="200" value="${escapeHtml(state.filters.storage.limit)}" />
        </div>
        <div class="field">
          <label class="chip" style="margin-top:28px">
            <input type="checkbox" name="unreferencedOnly" ${state.filters.storage.unreferencedOnly ? 'checked' : ''} />
            unreferenced only
          </label>
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">Load Assets</button>
        </div>
      </form>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Asset</th>
              <th>References</th>
              <th>File State</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.storageAssets.length
                ? state.storageAssets
                    .map(
                      (asset) => `
                        <tr>
                          <td>
                            <strong>${escapeHtml(asset.owner.name)}</strong>
                            <div class="muted">${escapeHtml(asset.owner.email)}</div>
                          </td>
                          <td>
                            <div class="stack">
                              <span>${statusBadge(asset.kind, asset.kind === 'video' ? 'teal' : '')}</span>
                              <span>${escapeHtml(asset.mimeType)}</span>
                              <span>${formatBytes(asset.sizeBytes)}</span>
                              <span class="muted">${escapeHtml(asset.fileUrl)}</span>
                            </div>
                          </td>
                          <td>
                            <div class="stack">
                              <span>${asset.referencedByAvatar ? 'Avatar linked' : 'No avatar link'}</span>
                              <span>${asset.messageReferenceCount} room message refs</span>
                              <span>${statusBadge(asset.status, asset.status === 'failed' ? 'danger' : asset.status === 'completed' ? 'teal' : '')}</span>
                            </div>
                          </td>
                          <td>
                            <div class="stack">
                              <span>${asset.fileExists ? 'File exists' : 'File missing'}</span>
                              <span>${asset.actualSizeBytes !== undefined ? formatBytes(asset.actualSizeBytes) : '-'}</span>
                            </div>
                          </td>
                          <td>${formatDate(asset.updatedAt)}</td>
                          <td>
                            <button
                              class="button danger"
                              type="button"
                              data-delete-asset="${escapeHtml(asset.id)}"
                              data-avatar-ref="${asset.referencedByAvatar ? '1' : '0'}"
                              data-message-refs="${asset.messageReferenceCount}"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      `
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="6">
                      <div class="empty-state">No assets matched this filter.</div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderActiveTab() {
  switch (state.activeTab) {
    case 'users':
      return renderUsers()
    case 'rooms':
      return renderRooms()
    case 'storage':
      return renderStorage()
    case 'dashboard':
    default:
      return renderDashboard()
  }
}

function renderConsole() {
  return `
    <div class="app-shell">
      ${renderTopbar()}
      ${renderFlash()}
      <div class="layout">
        ${renderSidebar()}
        <main class="main">
          ${renderActiveTab()}
        </main>
      </div>
    </div>
  `
}

function render() {
  app.innerHTML = state.session ? renderConsole() : renderLogin()

  if (!state.session) {
    scheduleGoogleButtonRender()
  }
}

function startEditUser(userId) {
  const user = state.users.find((item) => item.id === userId)
  if (!user) return

  state.editDraft = {
    id: user.id,
    role: user.role,
    displayName: user.displayName || '',
    effectiveName: user.effectiveName,
    statusMessage: user.statusMessage || '',
    phoneE164: user.phoneE164 || '',
    locale: user.locale || ''
  }
  state.activeTab = 'users'
  render()
}

async function refreshCurrentTab() {
  if (state.activeTab === 'dashboard') {
    await loadDashboard()
    return
  }

  if (state.activeTab === 'users') {
    await loadUsers()
    return
  }

  if (state.activeTab === 'rooms') {
    await loadRooms()
    return
  }

  await loadStorage()
}

app.addEventListener('click', async (event) => {
  const target = event.target.closest(
    '[data-tab],[data-action],[data-edit-user],[data-revoke-user],[data-select-room],[data-delete-message],[data-delete-asset]'
  )
  if (!target) return

  try {
    clearFlash()

    if (target.dataset.tab) {
      state.activeTab = target.dataset.tab
      render()
      return
    }

    if (target.dataset.editUser) {
      startEditUser(target.dataset.editUser)
      return
    }

    if (target.dataset.revokeUser) {
      if (!window.confirm('Revoke all refresh sessions for this user?')) return
      const result = await apiRequest(`/v1/guardian/users/${target.dataset.revokeUser}/revoke-sessions`, {
        method: 'POST'
      })
      setFlash('info', result.revoked ? 'User sessions revoked.' : 'There were no active sessions to revoke.')
      return
    }

    if (target.dataset.selectRoom) {
      state.selectedRoomId = target.dataset.selectRoom
      await loadRoomMessages({ reset: true })
      return
    }

    if (target.dataset.deleteMessage) {
      if (!window.confirm('Delete this message?')) return
      await apiRequest(`/v1/guardian/messages/${target.dataset.deleteMessage}`, {
        method: 'DELETE'
      })
      setFlash('info', 'Message deleted.')
      await Promise.all([loadRooms(), loadDashboard()])
      return
    }

    if (target.dataset.deleteAsset) {
      const messageRefs = Number(target.dataset.messageRefs || '0')
      const avatarRef = target.dataset.avatarRef === '1'

      if (messageRefs > 0) {
        setFlash('error', 'This asset is still referenced by room messages. Delete those messages first.')
        return
      }

      let forceAvatarDetach = false
      if (avatarRef) {
        forceAvatarDetach = window.confirm('This asset is linked as an avatar. Clear the avatar and continue?')
        if (!forceAvatarDetach) return
      }

      if (!window.confirm('Delete this asset?')) return

      await apiRequest(
        `/v1/guardian/storage/assets/${target.dataset.deleteAsset}${buildQuery({ forceAvatarDetach })}`,
        {
          method: 'DELETE'
        }
      )
      setFlash('info', 'Asset deleted.')
      await Promise.all([loadStorage(), loadDashboard(), loadUsers()])
      return
    }

    switch (target.dataset.action) {
      case 'logout':
        clearSession()
        clearFlash()
        render()
        return
      case 'refresh-current':
        await refreshCurrentTab()
        return
      case 'refresh-users':
        await loadUsers()
        return
      case 'refresh-rooms':
        await loadRooms()
        return
      case 'refresh-room-messages':
        await loadRoomMessages({ reset: true })
        return
      case 'refresh-storage':
        await loadStorage()
        return
      case 'cancel-edit':
        state.editDraft = null
        render()
        return
      case 'load-older':
        await loadRoomMessages({ reset: false })
        return
      case 'cleanup-orphans':
        if (!window.confirm('Delete files on disk that are not tracked in media_assets?')) return
        const cleanup = await apiRequest('/v1/guardian/storage/cleanup-orphans', {
          method: 'POST'
        })
        setFlash('info', `${cleanup.deletedCount} files deleted, ${formatBytes(cleanup.freedBytes)} reclaimed.`)
        await Promise.all([loadStorage(), loadDashboard()])
        return
      default:
        return
    }
  } catch (error) {
    setFlash('error', error.message || 'Action failed.')
  }
})

app.addEventListener('submit', async (event) => {
  event.preventDefault()

  const form = event.target
  if (!(form instanceof HTMLFormElement)) return

  try {
    clearFlash()

    if (form.id === 'login-form') {
      const formData = new FormData(form)
      await login(String(formData.get('email') || ''), String(formData.get('password') || ''))
      return
    }

    if (form.id === 'user-filter-form') {
      const formData = new FormData(form)
      state.filters.users = {
        q: String(formData.get('q') || ''),
        role: String(formData.get('role') || ''),
        limit: Number(formData.get('limit') || 100)
      }
      await loadUsers()
      return
    }

    if (form.id === 'user-edit-form') {
      const formData = new FormData(form)
      const userId = String(formData.get('userId') || '')
      await apiRequest(`/v1/guardian/users/${userId}`, {
        method: 'PATCH',
        body: {
          role: String(formData.get('role') || 'user'),
          displayName: String(formData.get('displayName') || ''),
          statusMessage: String(formData.get('statusMessage') || ''),
          phoneE164: String(formData.get('phoneE164') || ''),
          locale: String(formData.get('locale') || '')
        }
      })
      state.editDraft = null
      setFlash('info', 'User profile updated.')
      await Promise.all([loadUsers(), loadDashboard(), loadRooms()])
      return
    }

    if (form.id === 'room-filter-form') {
      const formData = new FormData(form)
      state.filters.rooms = {
        type: String(formData.get('type') || ''),
        memberUserId: String(formData.get('memberUserId') || ''),
        q: String(formData.get('q') || ''),
        limit: Number(formData.get('limit') || 60)
      }
      await loadRooms()
      return
    }

    if (form.id === 'bulk-delete-form') {
      const formData = new FormData(form)
      const rawBefore = String(formData.get('before') || '')
      const mode = event.submitter?.value || 'preview'

      state.filters.bulkDelete = {
        searchText: String(formData.get('searchText') || ''),
        roomId: String(formData.get('roomId') || ''),
        senderId: String(formData.get('senderId') || ''),
        before: rawBefore,
        kinds: formData.getAll('kinds').map((value) => String(value)),
        limit: Number(formData.get('limit') || 80)
      }

      if (mode === 'delete' && !window.confirm('Delete all matched messages?')) return

      const result = await apiRequest('/v1/guardian/messages/bulk-delete', {
        method: 'POST',
        body: {
          searchText: state.filters.bulkDelete.searchText,
          roomId: state.filters.bulkDelete.roomId || undefined,
          senderId: state.filters.bulkDelete.senderId || undefined,
          before: rawBefore ? new Date(rawBefore).toISOString() : undefined,
          kinds: state.filters.bulkDelete.kinds,
          limit: state.filters.bulkDelete.limit,
          dryRun: mode !== 'delete'
        }
      })

      state.bulkDeletePreview = result
      if (result.deletedCount > 0) {
        setFlash('info', `${result.deletedCount} messages deleted.`)
        await Promise.all([loadRooms(), loadDashboard()])
      } else {
        render()
      }
      return
    }

    if (form.id === 'storage-filter-form') {
      const formData = new FormData(form)
      state.filters.storage = {
        ownerUserId: String(formData.get('ownerUserId') || ''),
        status: String(formData.get('status') || ''),
        unreferencedOnly: formData.get('unreferencedOnly') === 'on',
        limit: Number(formData.get('limit') || 80)
      }
      await loadStorage()
    }
  } catch (error) {
    setFlash('error', error.message || 'Action failed.')
  }
})

async function bootstrap() {
  render()

  if (!state.session) return

  try {
    await loadAllData()
  } catch (error) {
    clearSession()
    setFlash('error', error.message || 'Session validation failed. Please sign in again.')
  }
}

bootstrap()
