// Initialize Lucide icons
lucide.createIcons();

// Supabase Configuration
const SUPABASE_URL = 'https://nooioyejqenuhipmxojq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vb2lveWVqcWVudWhpcG14b2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTY2MjYsImV4cCI6MjA3MjMzMjYyNn0.KAVa_sg0_0phDKND9_cEWtjZz_sPtNKlk8JYsAbmrXg';
const supabaseClient = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

let currentAuthUser = null;
let currentAuthRole = 'viewer'; // viewer | editor
let isAuthSignupMode = false;
let cloudSaveTimeoutId = null;
let isCloudSaving = false;

// Data Storage Keys
const STORAGE_KEYS = {
    MEMBERS: 'qa_team_members',
    PERFORMANCE: 'qa_performance_data',
    ATTENDANCE: 'qa_attendance_data',
    GOALS: 'qa_goals_data',
    RATINGS: 'qa_ratings_data',
    HOLIDAYS: 'qa_holidays_data',
    SETTINGS: 'qa_settings'
};

// Initialize data structures
let teamMembers = [];
let performanceData = [];
let attendanceData = [];
let goalsData = [];
let ratingsData = [];
let holidaysData = [];
let holidaysPagination = {
    currentPage: 1,
    itemsPerPage: 10
};
let appSettings = {
    weekendDays: [0, 6], // 0 = Sunday, 6 = Saturday
    excludeWeekendsFromAttendance: true
};

// Charts
let performanceChart = null;
let testTrendsChart = null;
let bugDistributionChart = null;
let memberComparisonChart = null;
let attendanceChart = null;

// Load data from data.json (web-hosted) or localStorage on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Auth form handler
    document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);

    // Initialize auth FIRST to restore session
    await initAuth();
    
    // Load initial data (will only load if authenticated)
    await loadAllData();
    
    // Render all sections with loaded data
    renderDashboard();
    renderTeamMembers();
    renderPerformanceMetrics();
    renderAttendance();
    renderHolidays();
    renderAppraisal();
    renderAnalytics();
    updateAttendanceStats();
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Set today's date as default for attendance
    document.getElementById('att-date').valueAsDate = new Date();
    
    // Set current month for performance
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    document.getElementById('perf-period').value = currentMonth;
    
    // Initialize period input
    updatePeriodInput();
    
    // Restore last active section after page refresh
    const lastSection = localStorage.getItem('lastActiveSection') || 'dashboard';
    console.log('🔄 Restoring last section:', lastSection);
    showSection(lastSection);

    // Setup event listeners
    setupEventListeners();
});

// Load all data from data.json (web-hosted) or localStorage as fallback
async function loadAllData() {
    // Don't load any data if not authenticated
    if (!currentAuthUser) {
        console.log('⚠️ Not authenticated, skipping data load');
        return;
    }
    
    try {
        // Try to load from data.json first (web-hosted, survives browser clear)
        const response = await fetch('data.json');
        if (response.ok) {
            const webData = await response.json();
            
            // Apply web data to app
            teamMembers = webData.teamMembers || [];
            performanceData = webData.performanceData || [];
            attendanceData = webData.attendanceData || [];
            goalsData = webData.goalsData || [];
            ratingsData = webData.ratingsData || [];
            holidaysData = webData.holidaysData || [];
            appSettings = webData.appSettings || {
                weekendDays: [0, 6],
                excludeWeekendsFromAttendance: true
            };
            
            console.log('✓ Data loaded from web (data.json)');
            return;
        }
    } catch (err) {
        console.warn('Could not load data.json, falling back to localStorage:', err);
    }
    
    // Fallback: load from localStorage
    teamMembers = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '[]');
    performanceData = JSON.parse(localStorage.getItem(STORAGE_KEYS.PERFORMANCE) || '[]');
    attendanceData = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
    goalsData = JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]');
    ratingsData = JSON.parse(localStorage.getItem(STORAGE_KEYS.RATINGS) || '[]');
    holidaysData = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOLIDAYS) || '[]');
    
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
    appSettings = {
        weekendDays: savedSettings.weekendDays || [0, 6],
        excludeWeekendsFromAttendance: savedSettings.excludeWeekendsFromAttendance !== false
    };
}

// Save data to localStorage
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));

    // Also persist entire dataset to Supabase if logged in as editor
    if (currentAuthUser && currentAuthRole === 'editor') {
        scheduleCloudSave();
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('add-member-form').addEventListener('submit', handleAddMember);
    document.getElementById('performance-form').addEventListener('submit', handleAddPerformance);
    document.getElementById('attendance-form').addEventListener('submit', handleAddAttendance);
    document.getElementById('goals-form').addEventListener('submit', handleAddGoal);
    document.getElementById('rating-form').addEventListener('submit', handleAddRating);
    
    const fileInput = document.getElementById('import-file-input');
    console.log('🔧 Setting up import file listener on:', fileInput);
    if (fileInput) {
        fileInput.addEventListener('change', handleImportFile);
        console.log('✅ Import file change listener attached');
        
        // Test that the listener works
        console.log('🧪 Testing if change event would fire...');
        fileInput.addEventListener('change', (e) => {
            console.log('🚨 TEST LISTENER: Change event detected!', e.target.files.length, 'files');
        });
    } else {
        console.error('❌ Could not find import-file-input element!');
    }

    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
}

function setAuthPanelState() {
    // Header auth elements
    const statusEl = document.getElementById('auth-status');
    const roleBadge = document.getElementById('auth-role-badge');
    const loginBtn = document.getElementById('auth-login-btn');
    const logoutBtn = document.getElementById('auth-logout-btn');

    // Sidebar auth elements
    const sidebarStatus = document.getElementById('sidebar-auth-status');
    const sidebarEmail = document.getElementById('sidebar-auth-email');
    const sidebarRole = document.getElementById('sidebar-auth-role');
    const sidebarLoginBtn = document.getElementById('sidebar-login-btn');
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');

    if (currentAuthUser) {
        // Update header
        if (statusEl) statusEl.textContent = currentAuthUser.email || 'Logged in';
        if (roleBadge) {
            roleBadge.textContent = (currentAuthRole || 'viewer').toUpperCase();
            roleBadge.classList.remove('hidden');
            roleBadge.classList.toggle('bg-emerald-100', currentAuthRole === 'editor');
            roleBadge.classList.toggle('text-emerald-800', currentAuthRole === 'editor');
            roleBadge.classList.toggle('bg-gray-100', currentAuthRole !== 'editor');
            roleBadge.classList.toggle('text-gray-700', currentAuthRole !== 'editor');
        }
        if (loginBtn) loginBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');

        // Update sidebar
        if (sidebarStatus) sidebarStatus.classList.add('hidden');
        if (sidebarEmail) {
            sidebarEmail.textContent = currentAuthUser.email || 'Logged in';
            sidebarEmail.classList.remove('hidden');
        }
        if (sidebarRole) {
            sidebarRole.textContent = (currentAuthRole || 'viewer').toUpperCase();
            sidebarRole.classList.remove('hidden');
            sidebarRole.classList.toggle('bg-emerald-100', currentAuthRole === 'editor');
            sidebarRole.classList.toggle('text-emerald-700', currentAuthRole === 'editor');
            sidebarRole.classList.toggle('bg-indigo-100', currentAuthRole !== 'editor');
            sidebarRole.classList.toggle('text-indigo-700', currentAuthRole !== 'editor');
        }
        if (sidebarLoginBtn) sidebarLoginBtn.classList.add('hidden');
        if (sidebarLogoutBtn) sidebarLogoutBtn.classList.remove('hidden');
    } else {
        // Update header
        if (statusEl) statusEl.textContent = 'Not logged in';
        if (roleBadge) roleBadge.classList.add('hidden');
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');

        // Update sidebar
        if (sidebarStatus) {
            sidebarStatus.textContent = 'Not logged in';
            sidebarStatus.classList.remove('hidden');
        }
        if (sidebarEmail) sidebarEmail.classList.add('hidden');
        if (sidebarRole) sidebarRole.classList.add('hidden');
        if (sidebarLoginBtn) sidebarLoginBtn.classList.remove('hidden');
        if (sidebarLogoutBtn) sidebarLogoutBtn.classList.add('hidden');
    }
}

function applyRolePermissions() {
    const canEdit = !!currentAuthUser && currentAuthRole === 'editor';
    const isLoggedIn = !!currentAuthUser;

    // Wait for DOM to be ready
    setTimeout(() => {
        // Show/hide entire app container and login gate
        const loginGate = document.getElementById('login-gate');
        const appContainer = document.getElementById('app-container');
        
        if (isLoggedIn) {
            // User logged in - show app, hide login gate
            if (loginGate) loginGate.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
        } else {
            // User not logged in - hide app, show login gate
            if (loginGate) {
                loginGate.classList.remove('hidden');
                lucide.createIcons();
            }
            if (appContainer) appContainer.classList.add('hidden');
        }

        // Disable all app forms for viewers (read-only). Auth form is excluded.
        document.querySelectorAll('form').forEach(form => {
            if (form.id === 'auth-form') return;

            form.querySelectorAll('input, select, textarea, button').forEach(el => {
                // Keep navigation/export/import usable
                if (el.id === 'import-file-input') return;
                if (el.id === 'auth-login-btn' || el.id === 'auth-logout-btn') return;
                if (el.closest && el.closest('#auth-modal')) return;

                if (el.tagName === 'BUTTON' || el.type !== 'hidden') {
                    el.disabled = !canEdit;
                    if (el.classList) {
                        el.classList.toggle('opacity-60', !canEdit);
                        el.classList.toggle('cursor-not-allowed', !canEdit);
                    }
                }
            });
        });
        
        // Explicitly ensure file input is enabled for imports
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) {
            fileInput.disabled = false;
            console.log('🔓 File input explicitly enabled, disabled:', fileInput.disabled);
        }
    }, 100);
}

function requireEditor() {
    if (!currentAuthUser) {
        showNotification('Please login to edit data.', 'error');
        openAuthModal();
        return false;
    }
    if (currentAuthRole !== 'editor') {
        showNotification('Read-only access. Ask admin to upgrade you to Editor.', 'error');
        return false;
    }
    return true;
}

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('hidden');
}

function toggleAuthMode() {
    isAuthSignupMode = !isAuthSignupMode;
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    if (!title || !submitBtn || !toggleText || !toggleBtn) return;

    if (isAuthSignupMode) {
        title.textContent = 'Sign up';
        submitBtn.textContent = 'Create account';
        toggleText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Login';
    } else {
        title.textContent = 'Login';
        submitBtn.textContent = 'Login';
        toggleText.textContent = 'Don’t have an account?';
        toggleBtn.textContent = 'Sign up';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) {
        showNotification('Supabase client not loaded. Please refresh the page.', 'error');
        return;
    }

    const email = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value;
    if (!email || !password) return;

    try {
        let result;
        if (isAuthSignupMode) {
            // Signup is disabled
            showNotification('Sign up is currently disabled. Please contact admin.', 'error');
            return;
        } else {
            result = await supabaseClient.auth.signInWithPassword({ email, password });
        }

        if (result.error) {
            showNotification(result.error.message || 'Authentication failed.', 'error');
            return;
        }

        // Update auth state immediately
        currentAuthUser = result.data.user;
        await ensureProfileRow();
        await loadCloudDatasetIntoApp();
        
        // Update UI
        setAuthPanelState();
        applyRolePermissions();
        
        closeAuthModal();
        showNotification(isAuthSignupMode ? 'Account created. You are logged in.' : 'Logged in successfully.', 'success');
    } catch (err) {
        showNotification(err?.message || 'Authentication failed.', 'error');
    }
}

async function logout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    
    // Clear auth state immediately
    currentAuthUser = null;
    currentAuthRole = 'viewer';
    
    // Clear all data
    teamMembers = [];
    performanceData = [];
    attendanceData = [];
    goalsData = [];
    ratingsData = [];
    holidaysData = [];
    
    // Update UI
    setAuthPanelState();
    applyRolePermissions();
    
    showNotification('Logged out.', 'success');
}

async function initAuth() {
    if (!supabaseClient) {
        setAuthPanelState();
        applyRolePermissions();
        return;
    }

    const { data } = await supabaseClient.auth.getSession();
    if (data?.session?.user) {
        currentAuthUser = data.session.user;
        await ensureProfileRow();
        await loadCloudDatasetIntoApp();
        console.log('✅ Session restored:', currentAuthUser.email, 'Role:', currentAuthRole);
    } else {
        currentAuthUser = null;
        currentAuthRole = 'viewer';
        console.log('⚠️ No session found');
    }

    // Update UI after session check
    setAuthPanelState();
    applyRolePermissions();

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        console.log('🔄 Auth state changed:', _event);
        currentAuthUser = session?.user || null;
        currentAuthRole = 'viewer';

        if (currentAuthUser) {
            await ensureProfileRow();
            await loadCloudDatasetIntoApp();
        }

        setAuthPanelState();
        applyRolePermissions();
    });
}

async function ensureProfileRow() {
    if (!currentAuthUser) return;

    console.log('🔍 Checking profile for user:', currentAuthUser.id);

    // Read role if profile exists
    const { data: profile, error: selectErr } = await supabaseClient
        .schema('qa_tool')
        .from('profiles')
        .select('id, role')
        .eq('id', currentAuthUser.id)
        .maybeSingle();

    console.log('📊 Profile query result:', { profile, error: selectErr });

    if (selectErr) {
        // If schema not created yet or policy blocks, keep viewer and continue
        console.error('❌ Error reading profile:', selectErr);
        currentAuthRole = 'viewer';
        return;
    }

    if (!profile) {
        console.log('⚠️ No profile found, creating viewer profile');
        // Create profile row (allowed by RLS: insert own)
        const { error: insertErr } = await supabaseClient
            .schema('qa_tool')
            .from('profiles')
            .insert({ id: currentAuthUser.id, role: 'viewer' });

        if (insertErr) {
            console.error('❌ Error creating profile:', insertErr);
            currentAuthRole = 'viewer';
            return;
        }
        currentAuthRole = 'viewer';
        return;
    }

    currentAuthRole = profile.role || 'viewer';
    console.log('✅ Role set to:', currentAuthRole);
}

function getLocalDatasetSnapshot() {
    return {
        teamMembers,
        performanceData,
        attendanceData,
        goalsData,
        ratingsData,
        holidaysData,
        appSettings
    };
}

function applyDatasetToApp(dataset) {
    teamMembers = Array.isArray(dataset.teamMembers) ? dataset.teamMembers : [];
    performanceData = Array.isArray(dataset.performanceData) ? dataset.performanceData : [];
    attendanceData = Array.isArray(dataset.attendanceData) ? dataset.attendanceData : [];
    goalsData = Array.isArray(dataset.goalsData) ? dataset.goalsData : [];
    ratingsData = Array.isArray(dataset.ratingsData) ? dataset.ratingsData : [];
    holidaysData = Array.isArray(dataset.holidaysData) ? dataset.holidaysData : [];
    appSettings = dataset.appSettings || appSettings;

    // Persist to localStorage as backup
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(teamMembers));
    localStorage.setItem(STORAGE_KEYS.PERFORMANCE, JSON.stringify(performanceData));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceData));
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goalsData));
    localStorage.setItem(STORAGE_KEYS.RATINGS, JSON.stringify(ratingsData));
    localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidaysData));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(appSettings));
}

async function loadCloudDatasetIntoApp() {
    if (!currentAuthUser) return;
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .schema('qa_tool')
        .from('user_app_data')
        .select('data')
        .eq('owner_id', currentAuthUser.id)
        .maybeSingle();

    if (error) {
        showNotification('Could not load cloud data. Using local data.', 'error');
        return;
    }

    if (!data || !data.data) {
        // No row yet
        if (currentAuthRole === 'editor') {
            // Create an empty dataset row so future updates work
            await supabaseClient
                .schema('qa_tool')
                .from('user_app_data')
                .insert({ owner_id: currentAuthUser.id, data: getLocalDatasetSnapshot() });
        } else {
            showNotification('No cloud data found for your account (read-only). Ask admin to initialize or upgrade to Editor.', 'error');
        }
        return;
    }

    applyDatasetToApp(data.data);

    // Rerender UI from loaded dataset
    updateDashboard();
    renderTeamMembers();
    updateAllDropdowns();
    renderAttendanceHistory();
    renderAttendanceSummary();
    updateCalendarMemberFilter();
    renderAttendanceCalendar();
    renderPerformanceHistory();
    renderHolidaysList();
}

function scheduleCloudSave() {
    if (!currentAuthUser || currentAuthRole !== 'editor') return;
    if (!supabaseClient) return;

    if (cloudSaveTimeoutId) {
        clearTimeout(cloudSaveTimeoutId);
    }

    cloudSaveTimeoutId = setTimeout(async () => {
        await saveCloudDataset();
    }, 800);
}

async function saveCloudDataset() {
    if (!currentAuthUser || currentAuthRole !== 'editor') return;
    if (!supabaseClient) return;
    if (isCloudSaving) return;

    isCloudSaving = true;
    const dataset = getLocalDatasetSnapshot();

    const { error } = await supabaseClient
        .schema('qa_tool')
        .from('user_app_data')
        .upsert({ owner_id: currentAuthUser.id, data: dataset }, { onConflict: 'owner_id' });

    isCloudSaving = false;

    if (error) {
        showNotification('Cloud save failed. Data is still available locally.', 'error');
        return;
    }
}

// Toggle collapsible sections
function toggleSection(sectionId) {
    const elements = document.querySelectorAll(`[data-collapsible="${sectionId}"]`);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    elements.forEach(element => {
        element.classList.toggle('hidden');
    });
    
    // Toggle icon between chevron-down and chevron-up
    if (icon) {
        const isHidden = elements[0]?.classList.contains('hidden');
        icon.setAttribute('data-lucide', isHidden ? 'chevron-down' : 'chevron-up');
        lucide.createIcons();
    }
}

// Navigation
function showSection(sectionName) {
    // Save current section to localStorage
    localStorage.setItem('lastActiveSection', sectionName);
    console.log('💾 Saved section to localStorage:', sectionName);
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName + '-section').classList.remove('hidden');
    
    // Add active class to clicked nav item
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        // If called programmatically, find and activate the nav item
        const navItem = document.querySelector(`[onclick*="showSection('${sectionName}')"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
    }
    
    // Reinitialize Lucide icons
    lucide.createIcons();
    
    // Update page-specific action buttons
    updatePageActions(sectionName + '-section');
    
    // Update section-specific content
    if (sectionName === 'dashboard') {
        updateDashboard();
    } else if (sectionName === 'team-members') {
        renderTeamMembers();
    } else if (sectionName === 'performance') {
        renderPerformanceHistory();
    } else if (sectionName === 'attendance') {
        renderAttendanceHistory();
        renderAttendanceSummary();
        populateYearDropdown();
        updateCalendarMemberFilter();
        renderAttendanceCalendar();
        populateBulkEditMembers();
    } else if (sectionName === 'holidays') {
        loadWeekendSettings();
        renderHolidaysList();
    } else if (sectionName === 'appraisal') {
        renderAppraisalHistory();
    } else if (sectionName === 'analytics') {
        renderAnalytics();
    }
}

// Modal functions
function showAddMemberModal() {
    document.getElementById('add-member-modal').classList.remove('hidden');
}

function closeAddMemberModal() {
    document.getElementById('add-member-modal').classList.add('hidden');
    document.getElementById('add-member-form').reset();
}

// Add team member
function handleAddMember(e) {
    e.preventDefault();

    if (!requireEditor()) return;
    
    const member = {
        id: Date.now().toString(),
        name: document.getElementById('member-name').value,
        email: document.getElementById('member-email').value,
        role: document.getElementById('member-role').value,
        joiningDate: document.getElementById('member-joining').value,
        addedDate: new Date().toISOString()
    };
    
    teamMembers.push(member);
    saveData(STORAGE_KEYS.MEMBERS, teamMembers);
    
    closeAddMemberModal();
    renderTeamMembers();
    updateAllDropdowns();
    updateDashboard();
    
    // Update bulk edit members list if on attendance section
    populateBulkEditMembers();
    
    showNotification('Team member added successfully!', 'success');
}

// Render team members
function renderTeamMembers() {
    const grid = document.getElementById('members-grid');
    const list = document.getElementById('team-members-list');
    
    if (teamMembers.length === 0) {
        grid.innerHTML = '<p class="text-gray-500 col-span-2">No team members added yet.</p>';
        list.innerHTML = '<p class="text-gray-500">No team members added yet. Go to Team Members section to add.</p>';
        return;
    }
    
    // Render grid view
    grid.innerHTML = teamMembers.map(member => `
        <div class="card member-card p-6">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        ${member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-900">${member.name}</h4>
                        <p class="text-sm text-gray-500">${member.role}</p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button onclick="openEditMemberModal('${member.id}')" class="text-gray-400 hover:text-indigo-500 transition" title="Edit">
                        <i data-lucide="edit" width="18" height="18"></i>
                    </button>
                    <button onclick="deleteMember('${member.id}')" class="text-gray-400 hover:text-red-500 transition" title="Delete">
                        <i data-lucide="trash-2" width="18" height="18"></i>
                    </button>
                </div>
            </div>
            <div class="space-y-2 text-sm">
                <div class="flex items-center text-gray-600">
                    <i data-lucide="mail" width="16" height="16" class="mr-2"></i>
                    ${member.email}
                </div>
                <div class="flex items-center text-gray-600">
                    <i data-lucide="calendar" width="16" height="16" class="mr-2"></i>
                    Joined: ${new Date(member.joiningDate).toLocaleDateString()}
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-100">
                <button onclick="viewMemberDetails('${member.id}')" class="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                    View Performance →
                </button>
            </div>
        </div>
    `).join('');
    
    // Render list view for dashboard
    list.innerHTML = teamMembers.map(member => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    ${member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p class="font-medium text-gray-900">${member.name}</p>
                    <p class="text-sm text-gray-500">${member.role}</p>
                </div>
            </div>
            <span class="text-sm text-gray-500">${member.email}</span>
        </div>
    `).join('');
    
    lucide.createIcons();
}

// Delete member
function deleteMember(memberId) {
    if (!confirm('Are you sure you want to delete this team member? This will also delete all associated data.')) {
        return;
    }
    
    teamMembers = teamMembers.filter(m => m.id !== memberId);
    performanceData = performanceData.filter(p => p.memberId !== memberId);
    attendanceData = attendanceData.filter(a => a.memberId !== memberId);
    goalsData = goalsData.filter(g => g.memberId !== memberId);
    ratingsData = ratingsData.filter(r => r.memberId !== memberId);
    
    saveData(STORAGE_KEYS.MEMBERS, teamMembers);
    saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
    saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
    saveData(STORAGE_KEYS.GOALS, goalsData);
    saveData(STORAGE_KEYS.RATINGS, ratingsData);
    
    renderTeamMembers();
    updateAllDropdowns();
    updateDashboard();
    
    showNotification('Team member deleted successfully!', 'success');
}

// Update all dropdowns
function updateAllDropdowns() {
    const dropdowns = [
        'perf-member',
        'att-member',
        'goal-member',
        'rating-member'
    ];
    
    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Choose a member...</option>' +
                teamMembers.map(member => 
                    `<option value="${member.id}">${member.name}</option>`
                ).join('');
        }
    });
    
    // Also update bulk attendance members list
    renderBulkMembersList();
    
    // Also update bulk edit members list
    populateBulkEditMembers();
}

// Update period input based on period type
function updatePeriodInput() {
    const periodType = document.getElementById('perf-period-type').value;
    const container = document.getElementById('period-input-container');
    const now = new Date();
    
    if (periodType === 'daily') {
        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-2">
                Date <span class="text-red-500">*</span>
            </label>
            <input type="date" id="perf-period" value="${now.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
        `;
    } else if (periodType === 'weekly') {
        // Get Monday of current week
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() + 1);
        // Get Sunday of current week
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-2">
                Week Range <span class="text-red-500">*</span>
            </label>
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <input type="date" id="perf-week-start" value="${monday.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Start Date" required>
                    <p class="text-xs text-gray-500 mt-1">Week Start</p>
                </div>
                <div>
                    <input type="date" id="perf-week-end" value="${sunday.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="End Date" required>
                    <p class="text-xs text-gray-500 mt-1">Week End</p>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-2">
                Month <span class="text-red-500">*</span>
            </label>
            <input type="month" id="perf-period" value="${now.toISOString().slice(0, 7)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
        `;
    }
}

// Get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Handle add performance
function handleAddPerformance(e) {
    e.preventDefault();

    if (!requireEditor()) return;
    
    const periodType = document.getElementById('perf-period-type').value;
    let periodValue;
    
    if (periodType === 'weekly') {
        const weekStart = document.getElementById('perf-week-start').value;
        const weekEnd = document.getElementById('perf-week-end').value;
        
        if (!weekStart || !weekEnd) {
            showNotification('Please select both start and end dates for the week', 'error');
            return;
        }
        
        // Validate that end date is after start date
        if (new Date(weekEnd) < new Date(weekStart)) {
            showNotification('Week end date must be after start date', 'error');
            return;
        }
        
        periodValue = `${weekStart} to ${weekEnd}`;
    } else {
        periodValue = document.getElementById('perf-period').value;
        
        if (!periodValue) {
            showNotification('Please select a date/month', 'error');
            return;
        }
    }
    
    const performance = {
        id: Date.now().toString(),
        memberId: document.getElementById('perf-member').value,
        projectName: document.getElementById('perf-project').value || '',
        periodType: periodType,
        period: periodValue,
        testsCreated: parseInt(document.getElementById('perf-tests-created').value) || 0,
        testsExecuted: parseInt(document.getElementById('perf-tests-executed').value) || 0,
        defectsReported: parseInt(document.getElementById('perf-defects-reported').value) || 0,
        asanaTickets: parseInt(document.getElementById('perf-asana-tickets').value) || 0,
        addedDate: new Date().toISOString()
    };
    
    performanceData.push(performance);
    saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
    
    document.getElementById('performance-form').reset();
    // Reset period type and value
    document.getElementById('perf-period-type').value = 'monthly';
    updatePeriodInput();
    
    renderPerformanceHistory();
    updateDashboard();
    
    showNotification('Performance data added successfully!', 'success');
}

// Format period display
function formatPeriod(periodType, period) {
    if (!period) return '-';
    
    if (periodType === 'daily') {
        return new Date(period).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else if (periodType === 'weekly') {
        // Check if it's a date range format (YYYY-MM-DD to YYYY-MM-DD)
        if (period.includes(' to ')) {
            const [start, end] = period.split(' to ');
            const startDate = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endDate = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return `${startDate} - ${endDate}`;
        }
        // Legacy format: 2024-W50 -> Week 50, 2024
        const parts = period.split('-W');
        if (parts.length === 2) {
            return `Week ${parts[1]}, ${parts[0]}`;
        }
        return period;
    } else {
        // Monthly or legacy data
        return new Date(period + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
}

// Performance filter state
let performanceFilters = {
    member: '',
    project: '',
    periodType: '',
    dateFrom: '',
    dateTo: '',
    minTcCreated: '',
    minTcExecuted: '',
    minDefects: ''
};

// Performance pagination state
let performanceCurrentPage = 1;
let performancePageSize = 10;

// Change performance page size
function changePerformancePageSize() {
    performancePageSize = parseInt(document.getElementById('performance-page-size').value);
    performanceCurrentPage = 1;
    renderPerformanceHistory();
}

// Go to performance page
function goToPerformancePage(page) {
    performanceCurrentPage = page;
    renderPerformanceHistory();
}

// Toggle performance filters panel
function togglePerformanceFilters() {
    const filtersPanel = document.getElementById('performance-filters');
    filtersPanel.classList.toggle('hidden');
    
    // Populate filter dropdowns when opening
    if (!filtersPanel.classList.contains('hidden')) {
        populatePerformanceFilterDropdowns();
    }
    
    lucide.createIcons();
}

// Populate filter dropdowns
function populatePerformanceFilterDropdowns() {
    // Populate members dropdown
    const memberSelect = document.getElementById('filter-member');
    const currentMemberValue = memberSelect.value;
    memberSelect.innerHTML = '<option value="">All Members</option>';
    teamMembers.forEach(member => {
        memberSelect.innerHTML += `<option value="${member.id}">${member.name}</option>`;
    });
    memberSelect.value = currentMemberValue;
    
    // Populate projects dropdown with unique projects
    const projectSelect = document.getElementById('filter-project');
    const currentProjectValue = projectSelect.value;
    const uniqueProjects = [...new Set(performanceData.map(p => p.projectName).filter(p => p))];
    projectSelect.innerHTML = '<option value="">All Projects</option>';
    uniqueProjects.sort().forEach(project => {
        projectSelect.innerHTML += `<option value="${project}">${project}</option>`;
    });
    projectSelect.value = currentProjectValue;
}

// Apply performance filters
function applyPerformanceFilters() {
    // Get filter values
    performanceFilters.member = document.getElementById('filter-member').value;
    performanceFilters.project = document.getElementById('filter-project').value;
    performanceFilters.periodType = document.getElementById('filter-period-type').value;
    performanceFilters.dateFrom = document.getElementById('filter-date-from').value;
    performanceFilters.dateTo = document.getElementById('filter-date-to').value;
    performanceFilters.minTcCreated = document.getElementById('filter-min-tc-created').value;
    performanceFilters.minTcExecuted = document.getElementById('filter-min-tc-executed').value;
    performanceFilters.minDefects = document.getElementById('filter-min-defects').value;
    
    // Re-render with filters
    renderPerformanceHistory();
}

// Clear performance filters
function clearPerformanceFilters() {
    // Reset filter values
    document.getElementById('filter-member').value = '';
    document.getElementById('filter-project').value = '';
    document.getElementById('filter-period-type').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-min-tc-created').value = '';
    document.getElementById('filter-min-tc-executed').value = '';
    document.getElementById('filter-min-defects').value = '';
    
    // Reset filter state
    performanceFilters = {
        member: '',
        project: '',
        periodType: '',
        dateFrom: '',
        dateTo: '',
        minTcCreated: '',
        minTcExecuted: '',
        minDefects: ''
    };
    
    // Re-render without filters
    renderPerformanceHistory();
}

// Filter performance data
function getFilteredPerformanceData() {
    let filtered = [...performanceData];
    
    // Filter by member
    if (performanceFilters.member) {
        filtered = filtered.filter(p => p.memberId === performanceFilters.member);
    }
    
    // Filter by project
    if (performanceFilters.project) {
        filtered = filtered.filter(p => p.projectName === performanceFilters.project);
    }
    
    // Filter by period type
    if (performanceFilters.periodType) {
        filtered = filtered.filter(p => (p.periodType || 'monthly') === performanceFilters.periodType);
    }
    
    // Filter by date range
    if (performanceFilters.dateFrom || performanceFilters.dateTo) {
        filtered = filtered.filter(p => {
            const period = p.period || p.month || '';
            if (!period) return false;
            
            // Convert period to comparable date string
            let compareDate = period;
            if (p.periodType === 'weekly' && period.includes(' to ')) {
                // For weekly, use start date
                compareDate = period.split(' to ')[0];
            } else if (p.periodType === 'monthly' && period.length === 7) {
                // For monthly (YYYY-MM), append -01 for comparison
                compareDate = period + '-01';
            }
            
            if (performanceFilters.dateFrom && compareDate < performanceFilters.dateFrom) {
                return false;
            }
            if (performanceFilters.dateTo && compareDate > performanceFilters.dateTo) {
                return false;
            }
            return true;
        });
    }
    
    // Filter by minimum values
    if (performanceFilters.minTcCreated) {
        const min = parseInt(performanceFilters.minTcCreated);
        filtered = filtered.filter(p => (p.testsCreated || 0) >= min);
    }
    
    if (performanceFilters.minTcExecuted) {
        const min = parseInt(performanceFilters.minTcExecuted);
        filtered = filtered.filter(p => (p.testsExecuted || 0) >= min);
    }
    
    if (performanceFilters.minDefects) {
        const min = parseInt(performanceFilters.minDefects);
        filtered = filtered.filter(p => (p.defectsReported || 0) >= min);
    }
    
    return filtered;
}

// Render performance history
function renderPerformanceHistory() {
    const tbody = document.getElementById('performance-table-body');
    const pageInfo = document.getElementById('performance-page-info');
    const pagination = document.getElementById('performance-pagination');
    
    if (performanceData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">No performance data available</td></tr>';
        const filterCount = document.getElementById('filter-results-count');
        if (filterCount) filterCount.textContent = 'No data';
        if (pageInfo) pageInfo.textContent = 'Showing 0 of 0 entries';
        if (pagination) pagination.innerHTML = '';
        return;
    }
    
    // Get filtered data
    const filteredData = getFilteredPerformanceData();
    
    // Update results count (for filters)
    const totalCount = performanceData.length;
    const filteredCount = filteredData.length;
    const resultsText = filteredCount === totalCount 
        ? `Showing all ${totalCount} records` 
        : `Showing ${filteredCount} of ${totalCount} records`;
    const filterCount = document.getElementById('filter-results-count');
    if (filterCount) filterCount.textContent = resultsText;
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">No records match the selected filters</td></tr>';
        if (pageInfo) pageInfo.textContent = 'Showing 0 of 0 entries';
        if (pagination) pagination.innerHTML = '';
        return;
    }
    
    // Sort by date (newest first)
    const sortedData = [...filteredData].sort((a, b) => {
        const dateA = a.period || a.month || '';
        const dateB = b.period || b.month || '';
        return dateB.localeCompare(dateA);
    });
    
    // Calculate pagination
    const totalRecords = sortedData.length;
    const totalPages = Math.ceil(totalRecords / performancePageSize);
    const startIndex = (performanceCurrentPage - 1) * performancePageSize;
    const endIndex = Math.min(startIndex + performancePageSize, totalRecords);
    const paginatedData = sortedData.slice(startIndex, endIndex);
    
    // Update page info
    if (pageInfo) {
        pageInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalRecords} entries`;
    }
    
    tbody.innerHTML = paginatedData.map(perf => {
        const member = teamMembers.find(m => m.id === perf.memberId);
        const periodType = perf.periodType || 'monthly'; // Default to monthly for legacy data
        const period = perf.period || perf.month; // Support legacy 'month' field
        
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium text-gray-900">${member ? member.name : 'Unknown'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-600">
                    ${perf.projectName || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${
                        periodType === 'daily' ? 'bg-blue-100 text-blue-800' :
                        periodType === 'weekly' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                    }">
                        ${periodType.charAt(0).toUpperCase() + periodType.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-600">
                    ${formatPeriod(periodType, period)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                    ${perf.testsCreated || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                    ${perf.testsExecuted || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                    ${perf.defectsReported || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                    ${perf.asanaTickets || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center space-x-2">
                        <button onclick="editPerformance('${perf.id}')" class="text-indigo-600 hover:text-indigo-800" title="Edit">
                            <i data-lucide="edit" width="16" height="16"></i>
                        </button>
                        <button onclick="duplicatePerformance('${perf.id}')" class="text-blue-600 hover:text-blue-800" title="Duplicate">
                            <i data-lucide="copy" width="16" height="16"></i>
                        </button>
                        <button onclick="archivePerformance('${perf.id}')" class="text-amber-600 hover:text-amber-800" title="Archive">
                            <i data-lucide="archive" width="16" height="16"></i>
                        </button>
                        <button onclick="deletePerformance('${perf.id}')" class="text-red-600 hover:text-red-800" title="Delete">
                            <i data-lucide="trash-2" width="16" height="16"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Render pagination buttons
    if (pagination && totalPages > 1) {
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button onclick="goToPerformancePage(${performanceCurrentPage - 1})" 
                    class="px-3 py-1 border rounded-lg ${performanceCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}" 
                    ${performanceCurrentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
        `;
        
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, performanceCurrentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button onclick="goToPerformancePage(${i})" 
                        class="px-3 py-1 border rounded-lg ${i === performanceCurrentPage ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button onclick="goToPerformancePage(${performanceCurrentPage + 1})" 
                    class="px-3 py-1 border rounded-lg ${performanceCurrentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}" 
                    ${performanceCurrentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    } else if (pagination) {
        pagination.innerHTML = '';
    }
    
    lucide.createIcons();
    
    // Update filter dropdowns if panel is open
    const filtersPanel = document.getElementById('performance-filters');
    if (filtersPanel && !filtersPanel.classList.contains('hidden')) {
        populatePerformanceFilterDropdowns();
    }
}

// Delete performance
function deletePerformance(perfId) {
    if (!confirm('Are you sure you want to delete this performance record?')) {
        return;
    }
    
    performanceData = performanceData.filter(p => p.id !== perfId);
    saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
    renderPerformanceHistory();
    updateDashboard();
    
    showNotification('Performance record deleted!', 'success');
}

// Handle add attendance
function handleAddAttendance(e) {
    e.preventDefault();

    if (!requireEditor()) return;
    
    const attendance = {
        id: Date.now().toString(),
        memberId: document.getElementById('att-member').value,
        date: document.getElementById('att-date').value,
        status: document.getElementById('att-status').value,
        notes: document.getElementById('att-notes').value,
        addedDate: new Date().toISOString()
    };
    
    attendanceData.push(attendance);
    saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
    
    document.getElementById('attendance-form').reset();
    document.getElementById('att-date').valueAsDate = new Date();
    renderAttendanceHistory();
    renderAttendanceSummary();
    renderAttendanceCalendar();
    updateDashboard();
    
    showNotification('Attendance marked successfully!', 'success');
}

// Attendance pagination state
let attendanceCurrentPage = 1;
let attendancePageSize = 10;

// Change attendance page size
function changeAttendancePageSize() {
    attendancePageSize = parseInt(document.getElementById('attendance-page-size').value);
    attendanceCurrentPage = 1;
    renderAttendanceHistory();
}

// Go to attendance page
function goToAttendancePage(page) {
    attendanceCurrentPage = page;
    renderAttendanceHistory();
}

// Render attendance history
function renderAttendanceHistory() {
    const tbody = document.getElementById('attendance-table-body');
    const pageInfo = document.getElementById('attendance-page-info');
    const pagination = document.getElementById('attendance-pagination');
    
    if (attendanceData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No attendance records available</td></tr>';
        if (pageInfo) pageInfo.textContent = 'Showing 0 of 0 entries';
        if (pagination) pagination.innerHTML = '';
        return;
    }
    
    const sortedAttendance = [...attendanceData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate pagination
    const totalRecords = sortedAttendance.length;
    const totalPages = Math.ceil(totalRecords / attendancePageSize);
    const startIndex = (attendanceCurrentPage - 1) * attendancePageSize;
    const endIndex = Math.min(startIndex + attendancePageSize, totalRecords);
    const paginatedData = sortedAttendance.slice(startIndex, endIndex);
    
    // Update page info
    if (pageInfo) {
        pageInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalRecords} entries`;
    }
    
    tbody.innerHTML = paginatedData.map(att => {
        const member = teamMembers.find(m => m.id === att.memberId);
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium text-gray-900">${member ? member.name : 'Unknown'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-600">
                    ${new Date(att.date).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge status-${att.status}">${att.status.toUpperCase()}</span>
                </td>
                <td class="px-6 py-4 text-gray-600">
                    ${att.notes || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center space-x-2">
                        <button onclick="editAttendance('${att.id}')" class="text-indigo-600 hover:text-indigo-800" title="Edit">
                            <i data-lucide="edit" width="16" height="16"></i>
                        </button>
                        <button onclick="duplicateAttendance('${att.id}')" class="text-blue-600 hover:text-blue-800" title="Duplicate">
                            <i data-lucide="copy" width="16" height="16"></i>
                        </button>
                        <button onclick="deleteAttendance('${att.id}')" class="text-red-600 hover:text-red-800" title="Delete">
                            <i data-lucide="trash-2" width="16" height="16"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Render pagination buttons
    if (pagination && totalPages > 1) {
        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <button onclick="goToAttendancePage(${attendanceCurrentPage - 1})" 
                    class="px-3 py-1 border rounded-lg ${attendanceCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}" 
                    ${attendanceCurrentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
        `;

        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, attendanceCurrentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button onclick="goToAttendancePage(${i})" 
                        class="px-3 py-1 border rounded-lg ${i === attendanceCurrentPage ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}">
                    ${i}
                </button>
            `;
        }

        // Next button
        paginationHTML += `
            <button onclick="goToAttendancePage(${attendanceCurrentPage + 1})" 
                    class="px-3 py-1 border rounded-lg ${attendanceCurrentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}" 
                    ${attendanceCurrentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        `;

        pagination.innerHTML = paginationHTML;
    } else if (pagination) {
        pagination.innerHTML = '';
    }

    lucide.createIcons();
}

// Render attendance summary
function renderAttendanceSummary() {
    const summary = document.getElementById('attendance-summary');
    
    if (teamMembers.length === 0) {
        summary.innerHTML = '<p class="text-gray-500">No team members to show summary</p>';
        return;
    }
    
    // Get selected month/year from calendar
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Get first and last day of selected month (using local date strings to avoid timezone issues)
    const firstDayStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0);
    const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    
    const summaryData = teamMembers.map(member => {
        // Filter attendance for selected month only
        const memberAttendance = attendanceData.filter(a => {
            if (!a || !a.memberId || !a.date) return false;
            return a.memberId === member.id && 
                   a.date >= firstDayStr && 
                   a.date <= lastDayStr;
        });
        
        const present = memberAttendance.filter(a => a.status === 'available').length;
        const total = memberAttendance.length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0';
        
        // Debug: Log member data
        console.log(`${member.name}: ${total} records, ${present} present, ${percentage}%`);
        if (memberAttendance.length > 0) {
            console.log(`  Dates: ${memberAttendance.map(a => a.date).join(', ')}`);
        }
        
        return {
            name: member.name,
            present,
            total,
            percentage
        };
    });
    
    const monthName = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    summary.innerHTML = summaryData.map(data => `
        <div class="card p-4">
            <h4 class="font-bold text-gray-900 mb-2">${data.name}</h4>
            <div class="text-2xl font-bold ${data.total === 0 ? 'text-gray-400' : 'text-indigo-600'} mb-1">${data.percentage}%</div>
            <p class="text-sm text-gray-500">${data.present} / ${data.total} days</p>
            <p class="text-xs text-gray-400 mt-1">${monthName}</p>
        </div>
    `).join('');
}

// Delete attendance
function deleteAttendance(attId) {
    if (!confirm('Are you sure you want to delete this attendance record?')) {
        return;
    }
    
    attendanceData = attendanceData.filter(a => a.id !== attId);
    saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
    renderAttendanceHistory();
    renderAttendanceSummary();
    renderAttendanceCalendar();
    updateDashboard();
    
    showNotification('Attendance record deleted!', 'success');
}

// Handle add goal
function handleAddGoal(e) {
    e.preventDefault();
    
    const goal = {
        id: Date.now().toString(),
        memberId: document.getElementById('goal-member').value,
        title: document.getElementById('goal-title').value,
        targetDate: document.getElementById('goal-date').value,
        description: document.getElementById('goal-description').value,
        status: 'pending',
        addedDate: new Date().toISOString()
    };
    
    goalsData.push(goal);
    saveData(STORAGE_KEYS.GOALS, goalsData);
    
    document.getElementById('goals-form').reset();
    renderAppraisalHistory();
    
    showNotification('Goal added successfully!', 'success');
}

// Handle add rating
function handleAddRating(e) {
    e.preventDefault();
    
    const rating = {
        id: Date.now().toString(),
        memberId: document.getElementById('rating-member').value,
        period: document.getElementById('rating-period').value,
        score: parseInt(document.getElementById('rating-score').value),
        strengths: document.getElementById('rating-strengths').value,
        improvements: document.getElementById('rating-improvements').value,
        addedDate: new Date().toISOString()
    };
    
    ratingsData.push(rating);
    saveData(STORAGE_KEYS.RATINGS, ratingsData);
    
    document.getElementById('rating-form').reset();
    renderAppraisalHistory();
    
    showNotification('Rating added successfully!', 'success');
}

// Render appraisal history
function renderAppraisalHistory() {
    const container = document.getElementById('appraisal-history');
    
    if (goalsData.length === 0 && ratingsData.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No appraisal data available</p>';
        return;
    }
    
    let html = '';
    
    // Render ratings
    if (ratingsData.length > 0) {
        html += '<h4 class="font-bold text-gray-900 mb-3">Performance Ratings</h4>';
        html += '<div class="space-y-3 mb-6">';
        ratingsData.forEach(rating => {
            const member = teamMembers.find(m => m.id === rating.memberId);
            html += `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h5 class="font-bold text-gray-900">${member ? member.name : 'Unknown'}</h5>
                            <p class="text-sm text-gray-500">${rating.period} - Rating: ${rating.score}/5</p>
                        </div>
                        <button onclick="deleteRating('${rating.id}')" class="text-red-600 hover:text-red-800">
                            <i data-lucide="trash-2" width="16" height="16"></i>
                        </button>
                    </div>
                    <div class="text-sm space-y-2">
                        <div>
                            <span class="font-medium text-gray-700">Strengths:</span>
                            <p class="text-gray-600">${rating.strengths}</p>
                        </div>
                        <div>
                            <span class="font-medium text-gray-700">Areas for Improvement:</span>
                            <p class="text-gray-600">${rating.improvements}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Render goals
    if (goalsData.length > 0) {
        html += '<h4 class="font-bold text-gray-900 mb-3">Goals</h4>';
        html += '<div class="space-y-3">';
        goalsData.forEach(goal => {
            const member = teamMembers.find(m => m.id === goal.memberId);
            html += `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h5 class="font-bold text-gray-900">${goal.title}</h5>
                            <p class="text-sm text-gray-500">${member ? member.name : 'Unknown'} - Target: ${new Date(goal.targetDate).toLocaleDateString()}</p>
                        </div>
                        <button onclick="deleteGoal('${goal.id}')" class="text-red-600 hover:text-red-800">
                            <i data-lucide="trash-2" width="16" height="16"></i>
                        </button>
                    </div>
                    <p class="text-sm text-gray-600">${goal.description}</p>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
    lucide.createIcons();
}

// Delete rating
function deleteRating(ratingId) {
    if (!confirm('Are you sure you want to delete this rating?')) {
        return;
    }
    
    ratingsData = ratingsData.filter(r => r.id !== ratingId);
    saveData(STORAGE_KEYS.RATINGS, ratingsData);
    renderAppraisalHistory();
    
    showNotification('Rating deleted!', 'success');
}

// Delete goal
function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) {
        return;
    }
    
    goalsData = goalsData.filter(g => g.id !== goalId);
    saveData(STORAGE_KEYS.GOALS, goalsData);
    renderAppraisalHistory();
    
    showNotification('Goal deleted!', 'success');
}

// Dashboard date filter state
let dashboardDateFilter = {
    preset: 'all',
    fromDate: null,
    toDate: null
};

// Apply dashboard date filter
function applyDashboardDateFilter() {
    const preset = document.getElementById('dashboard-date-preset').value;
    const customDates = document.getElementById('dashboard-custom-dates');
    
    dashboardDateFilter.preset = preset;
    
    if (preset === 'custom') {
        customDates.style.display = 'flex';
        dashboardDateFilter.fromDate = document.getElementById('dashboard-date-from').value;
        dashboardDateFilter.toDate = document.getElementById('dashboard-date-to').value;
    } else {
        customDates.style.display = 'none';
        
        if (preset === 'all') {
            dashboardDateFilter.fromDate = null;
            dashboardDateFilter.toDate = null;
        } else {
            const days = parseInt(preset);
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);
            
            dashboardDateFilter.fromDate = fromDate.toISOString().split('T')[0];
            dashboardDateFilter.toDate = toDate.toISOString().split('T')[0];
        }
    }
    
    updateDashboard();
}

// Clear dashboard date filter
function clearDashboardDateFilter() {
    document.getElementById('dashboard-date-preset').value = 'all';
    document.getElementById('dashboard-date-from').value = '';
    document.getElementById('dashboard-date-to').value = '';
    document.getElementById('dashboard-custom-dates').style.display = 'none';
    
    dashboardDateFilter = {
        preset: 'all',
        fromDate: null,
        toDate: null
    };
    
    updateDashboard();
}

// Filter dashboard performance data by date
function getFilteredDashboardPerformance(data) {
    if (!dashboardDateFilter.fromDate || !dashboardDateFilter.toDate) {
        return data;
    }
    
    return data.filter(perf => {
        const perfDate = perf.period || perf.month;
        if (!perfDate) return false;
        
        return perfDate >= dashboardDateFilter.fromDate && perfDate <= dashboardDateFilter.toDate;
    });
}

// Update dashboard
function updateDashboard() {
    // Update stats
    document.getElementById('total-members').textContent = teamMembers.length;
    
    // Filter performance data by selected date range
    const filteredPerformance = getFilteredDashboardPerformance(performanceData);
    
    const totalTests = filteredPerformance.reduce((sum, p) => sum + (p.testsExecuted || 0), 0);
    const totalDefects = filteredPerformance.reduce((sum, p) => sum + (p.defectsReported || 0), 0);
    
    document.getElementById('total-tests').textContent = totalTests;
    document.getElementById('total-bugs').textContent = totalDefects;
    
    // Calculate average attendance (filtered by date range)
    if (teamMembers.length > 0 && attendanceData.length > 0) {
        const avgAttendance = teamMembers.map(member => {
            let memberAtt = attendanceData.filter(a => a.memberId === member.id);
            
            // Apply date filter if set
            if (dashboardDateFilter.fromDate && dashboardDateFilter.toDate) {
                memberAtt = memberAtt.filter(a => 
                    a.date >= dashboardDateFilter.fromDate && 
                    a.date <= dashboardDateFilter.toDate
                );
            }
            
            const present = memberAtt.filter(a => 
                a.status === 'available' || 
                a.status === 'present' || 
                a.status === 'wfh'
            ).length;
            return memberAtt.length > 0 ? (present / memberAtt.length) * 100 : 0;
        });
        const avg = avgAttendance.reduce((sum, val) => sum + val, 0) / teamMembers.length;
        document.getElementById('avg-attendance').textContent = avg.toFixed(1) + '%';
    } else {
        document.getElementById('avg-attendance').textContent = '0%';
    }
    
    // Update performance chart
    updatePerformanceChart();
}

// Update performance chart
function updatePerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    // Filter data by selected date range
    const filteredData = getFilteredDashboardPerformance(performanceData);
    
    // Get last 6 months of data
    const months = [];
    const testsData = [];
    const bugsData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7);
        months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        
        const monthData = filteredData.filter(p => {
            const period = (p.period || p.month || '').slice(0, 7);
            return period === monthStr;
        });
        testsData.push(monthData.reduce((sum, p) => sum + (p.testsExecuted || 0), 0));
        bugsData.push(monthData.reduce((sum, p) => sum + (p.defectsReported || 0), 0));
    }
    
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Tests Executed',
                    data: testsData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Defects Reported',
                    data: bugsData,
                    borderColor: '#f5576c',
                    backgroundColor: 'rgba(245, 87, 108, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Render analytics
function renderAnalytics() {
    renderTestTrendsChart();
    renderBugDistributionChart();
    renderMemberComparisonChart();
    renderAttendanceChart();
}

// Test trends chart
function renderTestTrendsChart() {
    const ctx = document.getElementById('testTrendsChart');
    if (!ctx) return;
    
    if (testTrendsChart) {
        testTrendsChart.destroy();
    }
    
    const months = [];
    const writtenData = [];
    const executedData = [];
    const passedData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7);
        months.push(date.toLocaleDateString('en-US', { month: 'short' }));
        
        const monthData = performanceData.filter(p => p.month === monthStr);
        writtenData.push(monthData.reduce((sum, p) => sum + p.testsWritten, 0));
        executedData.push(monthData.reduce((sum, p) => sum + p.testsExecuted, 0));
        passedData.push(monthData.reduce((sum, p) => sum + p.testsPassed, 0));
    }
    
    testTrendsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Written',
                    data: writtenData,
                    backgroundColor: '#667eea'
                },
                {
                    label: 'Executed',
                    data: executedData,
                    backgroundColor: '#38ef7d'
                },
                {
                    label: 'Passed',
                    data: passedData,
                    backgroundColor: '#4facfe'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Bug distribution chart
function renderBugDistributionChart() {
    const ctx = document.getElementById('bugDistributionChart');
    if (!ctx) return;
    
    if (bugDistributionChart) {
        bugDistributionChart.destroy();
    }
    
    const critical = performanceData.reduce((sum, p) => sum + p.bugsCritical, 0);
    const high = performanceData.reduce((sum, p) => sum + p.bugsHigh, 0);
    const low = performanceData.reduce((sum, p) => sum + p.bugsLow, 0);
    
    bugDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Critical', 'High', 'Medium/Low'],
            datasets: [{
                data: [critical, high, low],
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Member comparison chart
function renderMemberComparisonChart() {
    const ctx = document.getElementById('memberComparisonChart');
    if (!ctx) return;
    
    if (memberComparisonChart) {
        memberComparisonChart.destroy();
    }
    
    const memberNames = teamMembers.map(m => m.name);
    const testsData = teamMembers.map(m => {
        const memberPerf = performanceData.filter(p => p.memberId === m.id);
        return memberPerf.reduce((sum, p) => sum + p.testsExecuted, 0);
    });
    const bugsData = teamMembers.map(m => {
        const memberPerf = performanceData.filter(p => p.memberId === m.id);
        return memberPerf.reduce((sum, p) => sum + p.bugsFound, 0);
    });
    
    memberComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: memberNames,
            datasets: [
                {
                    label: 'Tests Executed',
                    data: testsData,
                    backgroundColor: '#667eea'
                },
                {
                    label: 'Bugs Found',
                    data: bugsData,
                    backgroundColor: '#f5576c'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Attendance chart
function renderAttendanceChart() {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;
    
    if (attendanceChart) {
        attendanceChart.destroy();
    }
    
    const memberNames = teamMembers.map(m => m.name);
    const attendancePercentages = teamMembers.map(m => {
        const memberAtt = attendanceData.filter(a => a.memberId === m.id);
        const present = memberAtt.filter(a => a.status === 'present' || a.status === 'wfh').length;
        return memberAtt.length > 0 ? ((present / memberAtt.length) * 100).toFixed(1) : 0;
    });
    
    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: memberNames,
            datasets: [{
                label: 'Attendance %',
                data: attendancePercentages,
                backgroundColor: '#38ef7d'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// View member details
function viewMemberDetails(memberId) {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    // Switch to analytics section and show member-specific data
    showSection('analytics');
    
    // You can enhance this to show member-specific analytics
    showNotification(`Viewing performance for ${member.name}`, 'info');
}

// Show/Hide Export Menu
function showExportMenu() {
    document.getElementById('export-menu-modal').classList.remove('hidden');
    lucide.createIcons();
}

function closeExportMenu() {
    document.getElementById('export-menu-modal').classList.add('hidden');
}

// Show/Hide Import Menu
function showImportMenu() {
    console.log('📋 showImportMenu called');
    const modal = document.getElementById('import-menu-modal');
    if (!modal) {
        console.error('❌ Import menu modal not found!');
        return;
    }
    modal.classList.remove('hidden');
    console.log('✅ Import menu shown');
    lucide.createIcons();
}

function closeImportMenu() {
    document.getElementById('import-menu-modal').classList.add('hidden');
}

// Show/Hide Template Menu
function showTemplateMenu() {
    document.getElementById('template-menu-modal').classList.remove('hidden');
    lucide.createIcons();
}

function closeTemplateMenu() {
    document.getElementById('template-menu-modal').classList.add('hidden');
}

// Export as JSON
function exportAsJSON() {
    const data = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        teamMembers,
        performanceData,
        attendanceData,
        goalsData,
        ratingsData
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadFile(blob, `qa-team-data-${new Date().toISOString().slice(0, 10)}.json`);
    closeExportMenu();
    showNotification('JSON data exported successfully!', 'success');
}

// Export as CSV
function exportAsCSV(type) {
    let csvContent = '';
    let filename = '';
    
    if (type === 'members') {
        csvContent = 'ID,Name,Email,Role,Joining Date\n';
        teamMembers.forEach(member => {
            csvContent += `${member.id},"${member.name}","${member.email}","${member.role}",${member.joiningDate}\n`;
        });
        filename = `team-members-${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === 'performance') {
        csvContent = 'Team Member,Project Name,Period Type,Date,Test Cases Created,Test Cases Executed,Defects Reported,Asana Tickets\n';
        performanceData.forEach(perf => {
            const member = teamMembers.find(m => m.id === perf.memberId);
            const periodType = perf.periodType || 'monthly';
            const period = perf.period || perf.month || '';
            // Capitalize period type
            const periodTypeDisplay = periodType.charAt(0).toUpperCase() + periodType.slice(1);
            csvContent += `"${member ? member.name : 'Unknown'}","${perf.projectName || ''}",${periodTypeDisplay},${period},${perf.testsCreated || 0},${perf.testsExecuted || 0},${perf.defectsReported || 0},${perf.asanaTickets || 0}\n`;
        });
        filename = `performance-data-${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === 'attendance') {
        csvContent = 'ID,Member ID,Member Name,Date,Status,Notes\n';
        attendanceData.forEach(att => {
            const member = teamMembers.find(m => m.id === att.memberId);
            csvContent += `${att.id},${att.memberId},"${member ? member.name : 'Unknown'}",${att.date},${att.status},"${att.notes || ''}"\n`;
        });
        filename = `attendance-data-${new Date().toISOString().slice(0, 10)}.csv`;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, filename);
    closeExportMenu();
    showNotification('CSV exported successfully!', 'success');
}

// Import JSON
let currentImportType = '';

function importJSON() {
    console.log('📥 importJSON called');
    currentImportType = 'json';
    
    // Close modal first
    closeImportMenu();
    console.log('✅ Import menu closed immediately');
    
    // Create a completely fresh file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    
    // Attach listener
    fileInput.addEventListener('change', (e) => {
        console.log('🎯 FRESH INPUT: Change fired!', e.target.files.length, 'files');
        if (e.target.files.length > 0) {
            handleImportFile(e);
        }
        // Remove the temporary input
        document.body.removeChild(fileInput);
    });
    
    // Add to DOM temporarily
    document.body.appendChild(fileInput);
    console.log('✅ Fresh file input created and added to DOM');
    
    // Trigger click
    fileInput.click();
    console.log('✅ File dialog triggered on fresh input');
}

// Import CSV
function importCSV(type) {
    console.log('📥 importCSV called with type:', type);
    currentImportType = type;
    
    // Close modal first
    closeImportMenu();
    console.log('✅ Import menu closed immediately');
    
    // Create a completely fresh file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.xlsx,.xls';
    fileInput.style.display = 'none';
    
    // Attach listener
    fileInput.addEventListener('change', (e) => {
        console.log('🎯 FRESH INPUT: Change fired!', e.target.files.length, 'files');
        if (e.target.files.length > 0) {
            handleImportFile(e);
        }
        // Remove the temporary input
        document.body.removeChild(fileInput);
    });
    
    // Add to DOM temporarily
    document.body.appendChild(fileInput);
    console.log('✅ Fresh file input created and added to DOM');
    
    // Trigger click
    fileInput.click();
    console.log('✅ File dialog triggered on fresh input');
}

// Handle import file
function handleImportFile(e) {
    console.log('📂 Import file handler triggered');
    
    const file = e.target.files[0];
    if (!file) {
        console.log('⚠️ No file selected (user cancelled)');
        return;
    }
    
    console.log('📄 File selected:', file.name, 'Type:', currentImportType);
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (currentImportType === 'json') {
        console.log('📋 Processing as JSON');
        handleJSONImport(file);
    } else if (fileExtension === 'csv') {
        console.log('📊 Processing as CSV');
        handleCSVImport(file, currentImportType);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        console.log('📈 Processing as Excel');
        handleExcelImport(file, currentImportType);
    } else {
        console.log('❌ Unsupported format:', fileExtension);
        showNotification('Unsupported file format!', 'error');
    }
    
    // Reset file input
    e.target.value = '';
}

// Handle JSON import
function handleJSONImport(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            
            if (!confirm('This will replace all existing data. Are you sure you want to continue?')) {
                return;
            }
            
            teamMembers = data.teamMembers || [];
            performanceData = data.performanceData || [];
            attendanceData = data.attendanceData || [];
            goalsData = data.goalsData || [];
            ratingsData = data.ratingsData || [];
            
            saveData(STORAGE_KEYS.MEMBERS, teamMembers);
            saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
            saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
            saveData(STORAGE_KEYS.GOALS, goalsData);
            saveData(STORAGE_KEYS.RATINGS, ratingsData);
            
            updateDashboard();
            renderTeamMembers();
            updateAllDropdowns();
            
            showNotification('JSON data imported successfully!', 'success');
        } catch (error) {
            showNotification('Error importing JSON. Please check the file format.', 'error');
        }
    };
    reader.readAsText(file);
}

// Handle CSV import
function handleCSVImport(file, type) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            try {
                if (type === 'members') {
                    importMembersFromCSV(results.data);
                } else if (type === 'performance') {
                    importPerformanceFromCSV(results.data);
                } else if (type === 'attendance') {
                    importAttendanceFromCSV(results.data);
                }
            } catch (error) {
                showNotification('Error importing CSV: ' + error.message, 'error');
            }
        },
        error: function(error) {
            showNotification('Error parsing CSV file!', 'error');
        }
    });
}

// Handle Excel import
function handleExcelImport(file, type) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            if (type === 'members') {
                importMembersFromCSV(jsonData);
            } else if (type === 'performance') {
                importPerformanceFromCSV(jsonData);
            } else if (type === 'attendance') {
                importAttendanceFromCSV(jsonData);
            }
        } catch (error) {
            showNotification('Error importing Excel: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Import members from CSV/Excel data
function importMembersFromCSV(data) {
    if (!confirm('This will add new team members. Continue?')) {
        return;
    }
    
    let imported = 0;
    data.forEach(row => {
        if (row.Name && row.Email) {
            const member = {
                id: row.ID || Date.now().toString() + Math.random(),
                name: row.Name,
                email: row.Email,
                role: row.Role || 'QA Engineer',
                joiningDate: row['Joining Date'] || new Date().toISOString().slice(0, 10),
                addedDate: new Date().toISOString()
            };
            
            // Check if member already exists
            if (!teamMembers.find(m => m.email === member.email)) {
                teamMembers.push(member);
                imported++;
            }
        }
    });
    
    saveData(STORAGE_KEYS.MEMBERS, teamMembers);
    renderTeamMembers();
    updateAllDropdowns();
    updateDashboard();
    
    showNotification(`${imported} team members imported successfully!`, 'success');
}

// Import performance from CSV/Excel data
function importPerformanceFromCSV(data) {
    if (!confirm('This will add new performance records. Continue?')) {
        return;
    }
    
    let imported = 0;
    let failed = 0;
    const errors = [];
    
    data.forEach((row, index) => {
        const rowNum = index + 2; // +2 because index starts at 0 and row 1 is header
        
        // Support new format (Team Member, Date) and legacy formats
        const memberName = row['Team Member'] || row['Member Name'];
        const period = row.Date || row.Period || row.Month;
        let periodType = (row['Period Type'] || 'monthly').toLowerCase();
        
        // Validation
        if (!memberName) {
            errors.push(`Row ${rowNum}: Missing team member name`);
            failed++;
            return;
        }
        
        if (!period) {
            errors.push(`Row ${rowNum}: Missing date/period for ${memberName}`);
            failed++;
            return;
        }
        
        // Find member by name
        let memberId = row['Member ID'];
        if (!memberId && memberName) {
            const member = teamMembers.find(m => m.name.toLowerCase() === memberName.toLowerCase());
            if (member) {
                memberId = member.id;
            } else {
                errors.push(`Row ${rowNum}: Team member "${memberName}" not found. Please add them first.`);
                failed++;
                return;
            }
        }
        
        if (memberId && period) {
            const performance = {
                id: row.ID || Date.now().toString() + Math.random(),
                memberId: memberId,
                projectName: row['Project Name'] || '',
                periodType: periodType,
                period: period,
                testsCreated: parseInt(row['Test Cases Created']) || 0,
                testsExecuted: parseInt(row['Test Cases Executed']) || 0,
                defectsReported: parseInt(row['Defects Reported']) || 0,
                asanaTickets: parseInt(row['Asana Tickets']) || 0,
                addedDate: new Date().toISOString()
            };
            
            performanceData.push(performance);
            imported++;
        }
    });
    
    saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
    renderPerformanceHistory();
    updateDashboard();
    
    // Show detailed results
    if (failed === 0) {
        showNotification(`✓ ${imported} performance records imported successfully!`, 'success');
    } else if (imported === 0) {
        showNotification(`✗ Import failed! ${failed} records could not be imported. Check console for details.`, 'error');
        console.error('Import errors:', errors);
        alert('Import Errors:\n\n' + errors.join('\n'));
    } else {
        showNotification(`⚠ Partial import: ${imported} succeeded, ${failed} failed. Check console for details.`, 'error');
        console.error('Import errors:', errors);
        alert('Import completed with errors:\n\n' + 
              `✓ Successfully imported: ${imported} records\n` +
              `✗ Failed: ${failed} records\n\n` +
              'Errors:\n' + errors.join('\n'));
    }
}

// Import attendance from CSV/Excel data
function importAttendanceFromCSV(data) {
    if (!confirm('This will add new attendance records. Continue?')) {
        return;
    }
    
    let imported = 0;
    let failed = 0;
    const errors = [];
    
    data.forEach((row, index) => {
        const rowNum = index + 2;
        const memberName = row['Member Name'];
        
        if (!row['Member ID'] && !memberName) {
            errors.push(`Row ${rowNum}: Missing member ID or name`);
            failed++;
            return;
        }
        
        if (!row.Date) {
            errors.push(`Row ${rowNum}: Missing date for ${memberName || 'member'}`);
            failed++;
            return;
        }
        
        // Find member by ID or name
        let memberId = row['Member ID'];
        if (!memberId && memberName) {
            const member = teamMembers.find(m => m.name.toLowerCase() === memberName.toLowerCase());
            if (member) {
                memberId = member.id;
            } else {
                errors.push(`Row ${rowNum}: Team member "${memberName}" not found`);
                failed++;
                return;
            }
        }
        
        if (memberId && row.Date) {
            const attendance = {
                id: row.ID || Date.now().toString() + Math.random(),
                memberId: memberId,
                date: row.Date,
                status: row.Status || 'present',
                notes: row.Notes || '',
                addedDate: new Date().toISOString()
            };
            
            attendanceData.push(attendance);
            imported++;
        }
    });
    
    saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
    renderAttendanceHistory();
    renderAttendanceSummary();
    updateDashboard();
    
    // Show detailed results
    if (failed === 0) {
        showNotification(`✓ ${imported} attendance records imported successfully!`, 'success');
    } else if (imported === 0) {
        showNotification(`✗ Import failed! ${failed} records could not be imported.`, 'error');
        console.error('Import errors:', errors);
        alert('Import Errors:\n\n' + errors.join('\n'));
    } else {
        showNotification(`⚠ Partial import: ${imported} succeeded, ${failed} failed.`, 'error');
        console.error('Import errors:', errors);
        alert('Import completed with errors:\n\n' + 
              `✓ Successfully imported: ${imported} records\n` +
              `✗ Failed: ${failed} records\n\n` +
              'Errors:\n' + errors.join('\n'));
    }
}

// Download file helper
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Download CSV templates
function downloadTemplates() {
    // Team Members Template
    const membersCSV = 'ID,Name,Email,Role,Joining Date\n' +
                      '1,John Doe,john@example.com,QA Engineer,2024-01-15\n' +
                      '2,Jane Smith,jane@example.com,Senior QA Engineer,2023-06-01';
    
    // Performance Template
    const performanceCSV = 'Team Member,Project Name,Period Type,Date,Test Cases Created,Test Cases Executed,Defects Reported,Asana Tickets\n' +
                          'John Doe,DSOT,Daily,2024-12-10,50,45,1,2\n' +
                          'John Doe,CMUI,Weekly,2024-12-02 to 2024-12-08,100,90,3,5\n' +
                          'Jane Smith,DMB,Monthly,2024-12,260,250,10,15\n' +
                          'Jane Smith,DSOT,Daily,2024-12-11,30,28,2,1';
    
    // Attendance Template
    const attendanceCSV = 'ID,Member ID,Member Name,Date,Status,Notes\n' +
                         '1,1,John Doe,2024-12-01,present,\n' +
                         '2,1,John Doe,2024-12-02,wfh,Working from home\n' +
                         '3,2,Jane Smith,2024-12-01,present,';
    
    // Create zip-like download (download all three)
    downloadFile(new Blob([membersCSV], { type: 'text/csv' }), 'template-team-members.csv');
    setTimeout(() => {
        downloadFile(new Blob([performanceCSV], { type: 'text/csv' }), 'template-performance.csv');
    }, 500);
    setTimeout(() => {
        downloadFile(new Blob([attendanceCSV], { type: 'text/csv' }), 'template-attendance.csv');
    }, 1000);
    
    showNotification('CSV templates downloaded! Check your downloads folder.', 'success');
}

// Show notification
function showNotification(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// ===== EDIT MEMBER FUNCTIONALITY =====

// Open edit member modal
function openEditMemberModal(memberId) {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    document.getElementById('edit-member-id').value = member.id;
    document.getElementById('edit-member-name').value = member.name;
    document.getElementById('edit-member-email').value = member.email;
    document.getElementById('edit-member-role').value = member.role;
    document.getElementById('edit-member-joining').value = member.joiningDate;
    
    document.getElementById('edit-member-modal').classList.remove('hidden');
}

// Close edit member modal
function closeEditMemberModal() {
    document.getElementById('edit-member-modal').classList.add('hidden');
    document.getElementById('edit-member-form').reset();
}

// Handle edit member form submission
document.addEventListener('DOMContentLoaded', function() {
    const editForm = document.getElementById('edit-member-form');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const memberId = document.getElementById('edit-member-id').value;
            const memberIndex = teamMembers.findIndex(m => m.id === memberId);
            
            if (memberIndex === -1) {
                showNotification('Member not found!', 'error');
                return;
            }
            
            teamMembers[memberIndex] = {
                ...teamMembers[memberIndex],
                name: document.getElementById('edit-member-name').value,
                email: document.getElementById('edit-member-email').value,
                role: document.getElementById('edit-member-role').value,
                joiningDate: document.getElementById('edit-member-joining').value
            };
            
            saveData(STORAGE_KEYS.MEMBERS, teamMembers);
            renderTeamMembers();
            updateAllDropdowns();
            updateDashboard();
            closeEditMemberModal();
            
            showNotification('Team member updated successfully!', 'success');
        });
    }
});

// ===== BULK ATTENDANCE FUNCTIONALITY =====

// Switch attendance mode
function switchAttendanceMode(mode) {
    const singleForm = document.getElementById('single-attendance-form');
    const bulkForm = document.getElementById('bulk-attendance-form');
    const singleTab = document.getElementById('single-mode-tab');
    const bulkTab = document.getElementById('bulk-mode-tab');
    
    if (mode === 'single') {
        singleForm.classList.remove('hidden');
        bulkForm.classList.add('hidden');
        singleTab.classList.add('active', 'border-indigo-500', 'text-indigo-600');
        singleTab.classList.remove('border-transparent', 'text-gray-500');
        bulkTab.classList.remove('active', 'border-indigo-500', 'text-indigo-600');
        bulkTab.classList.add('border-transparent', 'text-gray-500');
    } else {
        singleForm.classList.add('hidden');
        bulkForm.classList.remove('hidden');
        bulkTab.classList.add('active', 'border-indigo-500', 'text-indigo-600');
        bulkTab.classList.remove('border-transparent', 'text-gray-500');
        singleTab.classList.remove('active', 'border-indigo-500', 'text-indigo-600');
        singleTab.classList.add('border-transparent', 'text-gray-500');
        
        // Initialize bulk form
        renderBulkMembersList();
        updateBulkPeriodInput();
    }
}

// Render members list for bulk selection
function renderBulkMembersList() {
    const container = document.getElementById('bulk-members-list');
    if (!container) return;
    
    if (teamMembers.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 italic">No team members available. Please add team members first.</p>';
        return;
    }
    
    container.innerHTML = teamMembers.map(member => `
        <label class="flex items-center mb-2">
            <input type="checkbox" class="bulk-member-checkbox mr-2 rounded" value="${member.id}" onchange="updateBulkPreview()">
            <span>${member.name}</span>
        </label>
    `).join('');
}

// Toggle all members selection
function toggleAllMembers() {
    const selectAll = document.getElementById('select-all-members');
    const checkboxes = document.querySelectorAll('.bulk-member-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateBulkPreview();
}

// Update bulk period input based on period type
function updateBulkPeriodInput() {
    const periodType = document.getElementById('bulk-period-type').value;
    const container = document.getElementById('bulk-period-container');
    const now = new Date();
    
    if (periodType === 'multiple') {
        container.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Select Dates</label>
                <div class="grid grid-cols-2 gap-2">
                    <input type="date" id="bulk-dates" multiple class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
                    <button type="button" onclick="addMoreDates()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        + Add Date
                    </button>
                </div>
                <div id="selected-dates-list" class="mt-2 space-y-1"></div>
            </div>
        `;
    } else if (periodType === 'week') {
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() + 1);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        container.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Week Range</label>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <input type="date" id="bulk-week-start" value="${monday.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
                        <p class="text-xs text-gray-500 mt-1">Week Start</p>
                    </div>
                    <div>
                        <input type="date" id="bulk-week-end" value="${sunday.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
                        <p class="text-xs text-gray-500 mt-1">Week End</p>
                    </div>
                </div>
            </div>
        `;
    } else if (periodType === 'month') {
        container.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                <input type="month" id="bulk-month" value="${now.toISOString().slice(0, 7)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
            </div>
        `;
    }
    
    updateBulkPreview();
}

// Selected dates for multiple days mode
let selectedDates = [];

function addMoreDates() {
    const dateInput = document.getElementById('bulk-dates');
    const date = dateInput.value;
    
    if (date && !selectedDates.includes(date)) {
        selectedDates.push(date);
        renderSelectedDates();
        dateInput.value = '';
    }
}

function renderSelectedDates() {
    const container = document.getElementById('selected-dates-list');
    if (!container) return;
    
    container.innerHTML = selectedDates.map((date, index) => `
        <div class="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
            <span class="text-sm">${new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            <button type="button" onclick="removeDate(${index})" class="text-red-600 hover:text-red-800">
                <i data-lucide="x" width="16" height="16"></i>
            </button>
        </div>
    `).join('');
    
    lucide.createIcons();
    updateBulkPreview();
}

function removeDate(index) {
    selectedDates.splice(index, 1);
    renderSelectedDates();
}

// Update bulk preview
function updateBulkPreview() {
    const preview = document.getElementById('bulk-preview');
    if (!preview) return;
    
    const selectedMembers = document.querySelectorAll('.bulk-member-checkbox:checked').length;
    const periodType = document.getElementById('bulk-period-type').value;
    
    let daysCount = 0;
    if (periodType === 'multiple') {
        daysCount = selectedDates.length;
    } else if (periodType === 'week') {
        const start = document.getElementById('bulk-week-start')?.value;
        const end = document.getElementById('bulk-week-end')?.value;
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            // Count only weekdays (exclude Saturday and Sunday)
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    daysCount++;
                }
            }
        }
    } else if (periodType === 'month') {
        const month = document.getElementById('bulk-month')?.value;
        if (month) {
            const [year, monthNum] = month.split('-');
            const totalDays = new Date(year, monthNum, 0).getDate();
            // Count only weekdays (exclude Saturday and Sunday)
            for (let day = 1; day <= totalDays; day++) {
                const date = new Date(year, monthNum - 1, day);
                const dayOfWeek = date.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    daysCount++;
                }
            }
        }
    }
    
    const totalRecords = selectedMembers * daysCount;
    preview.textContent = totalRecords > 0 ? `Will create ${totalRecords} attendance records (weekdays only)` : '';
}

// Handle bulk attendance form submission
document.addEventListener('DOMContentLoaded', function() {
    const bulkForm = document.getElementById('bulk-attendance-form-element');
    if (bulkForm) {
        bulkForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const selectedMemberIds = Array.from(document.querySelectorAll('.bulk-member-checkbox:checked')).map(cb => cb.value);
            
            if (selectedMemberIds.length === 0) {
                showNotification('Please select at least one team member', 'error');
                return;
            }
            
            const periodType = document.getElementById('bulk-period-type').value;
            const status = document.getElementById('bulk-status').value;
            const notes = document.getElementById('bulk-notes').value;
            
            let dates = [];
            
            if (periodType === 'multiple') {
                if (selectedDates.length === 0) {
                    showNotification('Please add at least one date', 'error');
                    return;
                }
                dates = selectedDates;
            } else if (periodType === 'week') {
                const start = document.getElementById('bulk-week-start').value;
                const end = document.getElementById('bulk-week-end').value;
                
                if (!start || !end) {
                    showNotification('Please select week range', 'error');
                    return;
                }
                
                const startDate = new Date(start);
                const endDate = new Date(end);
                
                // Exclude weekends (Saturday=6, Sunday=0)
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dayOfWeek = d.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        dates.push(d.toISOString().slice(0, 10));
                    }
                }
            } else if (periodType === 'month') {
                const month = document.getElementById('bulk-month').value;
                
                if (!month) {
                    showNotification('Please select a month', 'error');
                    return;
                }
                
                const [year, monthNum] = month.split('-');
                const daysInMonth = new Date(year, monthNum, 0).getDate();
                
                // Exclude weekends (Saturday=6, Sunday=0)
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, monthNum - 1, day);
                    const dayOfWeek = date.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        dates.push(`${year}-${monthNum}-${String(day).padStart(2, '0')}`);
                    }
                }
            }
            
            // Create attendance records
            let created = 0;
            selectedMemberIds.forEach(memberId => {
                dates.forEach(date => {
                    // Check if attendance already exists
                    const exists = attendanceData.some(a => a.memberId === memberId && a.date === date);
                    
                    if (!exists) {
                        attendanceData.push({
                            id: Date.now().toString() + Math.random(),
                            memberId: memberId,
                            date: date,
                            status: status,
                            notes: notes,
                            addedDate: new Date().toISOString()
                        });
                        created++;
                    }
                });
            });
            
            saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
            renderAttendanceHistory();
            renderAttendanceSummary();
            renderAttendanceCalendar();
            updateDashboard();
            
            // Reset form
            selectedDates = [];
            document.getElementById('bulk-attendance-form-element').reset();
            document.getElementById('select-all-members').checked = false;
            updateBulkPeriodInput();
            
            showNotification(`${created} attendance records created successfully!`, 'success');
        });
    }
    
    // Add event listeners for bulk preview updates
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('bulk-member-checkbox') || 
            e.target.id === 'bulk-period-type' ||
            e.target.id === 'bulk-week-start' ||
            e.target.id === 'bulk-week-end' ||
            e.target.id === 'bulk-month') {
            updateBulkPreview();
        }
    });
});

// ===== PERFORMANCE ACTIONS =====

// Edit performance
function editPerformance(perfId) {
    const perf = performanceData.find(p => p.id === perfId);
    if (!perf) return;
    
    // Populate edit form
    document.getElementById('edit-perf-id').value = perf.id;
    document.getElementById('edit-perf-member').value = perf.memberId;
    document.getElementById('edit-perf-project').value = perf.projectName || '';
    document.getElementById('edit-perf-period-type').value = perf.periodType || 'monthly';
    document.getElementById('edit-perf-tests-created').value = perf.testsCreated || 0;
    document.getElementById('edit-perf-tests-executed').value = perf.testsExecuted || 0;
    document.getElementById('edit-perf-defects-reported').value = perf.defectsReported || 0;
    document.getElementById('edit-perf-asana-tickets').value = perf.asanaTickets || 0;
    
    // Update period input and set value
    updateEditPeriodInput();
    
    // Set period value based on type
    setTimeout(() => {
        const periodType = perf.periodType || 'monthly';
        if (periodType === 'weekly' && perf.period && perf.period.includes(' to ')) {
            const [start, end] = perf.period.split(' to ');
            document.getElementById('edit-perf-week-start').value = start;
            document.getElementById('edit-perf-week-end').value = end;
        } else {
            const periodInput = document.getElementById('edit-perf-period');
            if (periodInput) {
                periodInput.value = perf.period || perf.month || '';
            }
        }
    }, 100);
    
    // Populate member dropdown
    const memberSelect = document.getElementById('edit-perf-member');
    memberSelect.innerHTML = '<option value="">Choose a member...</option>' +
        teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    memberSelect.value = perf.memberId;
    
    document.getElementById('edit-performance-modal').classList.remove('hidden');
    lucide.createIcons();
}

function closeEditPerformanceModal() {
    document.getElementById('edit-performance-modal').classList.add('hidden');
    document.getElementById('edit-performance-form').reset();
}

// Update period input for edit form
function updateEditPeriodInput() {
    const periodType = document.getElementById('edit-perf-period-type').value;
    const container = document.getElementById('edit-period-input-container');
    const now = new Date();
    
    if (periodType === 'daily') {
        container.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Date <span class="text-red-500">*</span></label>
                <input type="date" id="edit-perf-period" value="${now.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
            </div>
        `;
    } else if (periodType === 'weekly') {
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() + 1);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        container.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Week Range <span class="text-red-500">*</span></label>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <input type="date" id="edit-perf-week-start" value="${monday.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
                        <p class="text-xs text-gray-500 mt-1">Week Start</p>
                    </div>
                    <div>
                        <input type="date" id="edit-perf-week-end" value="${sunday.toISOString().slice(0, 10)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
                        <p class="text-xs text-gray-500 mt-1">Week End</p>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Month <span class="text-red-500">*</span></label>
                <input type="month" id="edit-perf-period" value="${now.toISOString().slice(0, 7)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required>
            </div>
        `;
    }
}

// Handle edit performance form submission
document.addEventListener('DOMContentLoaded', function() {
    const editPerfForm = document.getElementById('edit-performance-form');
    if (editPerfForm) {
        editPerfForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const perfId = document.getElementById('edit-perf-id').value;
            const perfIndex = performanceData.findIndex(p => p.id === perfId);
            
            if (perfIndex === -1) {
                showNotification('Performance record not found!', 'error');
                return;
            }
            
            const periodType = document.getElementById('edit-perf-period-type').value;
            let periodValue;
            
            if (periodType === 'weekly') {
                const weekStart = document.getElementById('edit-perf-week-start').value;
                const weekEnd = document.getElementById('edit-perf-week-end').value;
                
                if (!weekStart || !weekEnd) {
                    showNotification('Please select both start and end dates for the week', 'error');
                    return;
                }
                
                if (new Date(weekEnd) < new Date(weekStart)) {
                    showNotification('Week end date must be after start date', 'error');
                    return;
                }
                
                periodValue = `${weekStart} to ${weekEnd}`;
            } else {
                periodValue = document.getElementById('edit-perf-period').value;
                
                if (!periodValue) {
                    showNotification('Please select a date/month', 'error');
                    return;
                }
            }
            
            performanceData[perfIndex] = {
                ...performanceData[perfIndex],
                memberId: document.getElementById('edit-perf-member').value,
                projectName: document.getElementById('edit-perf-project').value || '',
                periodType: periodType,
                period: periodValue,
                testsCreated: parseInt(document.getElementById('edit-perf-tests-created').value) || 0,
                testsExecuted: parseInt(document.getElementById('edit-perf-tests-executed').value) || 0,
                defectsReported: parseInt(document.getElementById('edit-perf-defects-reported').value) || 0,
                asanaTickets: parseInt(document.getElementById('edit-perf-asana-tickets').value) || 0
            };
            
            saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
            renderPerformanceHistory();
            updateDashboard();
            closeEditPerformanceModal();
            
            showNotification('Performance data updated successfully!', 'success');
        });
    }
});

// Duplicate performance
function duplicatePerformance(perfId) {
    const perf = performanceData.find(p => p.id === perfId);
    if (!perf) return;
    
    if (!confirm('Create a duplicate of this performance record?')) {
        return;
    }
    
    const duplicate = {
        ...perf,
        id: Date.now().toString(),
        addedDate: new Date().toISOString()
    };
    
    performanceData.push(duplicate);
    saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
    renderPerformanceHistory();
    updateDashboard();
    
    showNotification('Performance record duplicated successfully!', 'success');
}

// Archive performance
let archivedPerformance = [];

function archivePerformance(perfId) {
    const perfIndex = performanceData.findIndex(p => p.id === perfId);
    if (perfIndex === -1) return;
    
    if (!confirm('Archive this performance record? You can restore it later.')) {
        return;
    }
    
    const perf = performanceData[perfIndex];
    perf.archived = true;
    perf.archivedDate = new Date().toISOString();
    
    archivedPerformance.push(perf);
    performanceData.splice(perfIndex, 1);
    
    saveData(STORAGE_KEYS.PERFORMANCE, performanceData);
    saveData('archivedPerformance', archivedPerformance);
    renderPerformanceHistory();
    updateDashboard();
    
    showNotification('Performance record archived successfully!', 'success');
}

// Load archived data on init
document.addEventListener('DOMContentLoaded', function() {
    archivedPerformance = loadData('archivedPerformance') || [];
});

// ===== PAGE-SPECIFIC BUTTONS =====

// Update page actions based on current section
function updatePageActions(sectionId) {
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const templateBtn = document.getElementById('template-btn');
    
    // Hide all by default
    exportBtn.classList.add('hidden');
    importBtn.classList.add('hidden');
    templateBtn.classList.add('hidden');
    
    // Show relevant buttons based on section
    if (sectionId === 'team-members-section') {
        exportBtn.classList.remove('hidden');
        importBtn.classList.remove('hidden');
        templateBtn.classList.remove('hidden');
        exportBtn.setAttribute('data-type', 'members');
        importBtn.setAttribute('data-type', 'members');
        templateBtn.setAttribute('data-type', 'members');
    } else if (sectionId === 'performance-section') {
        exportBtn.classList.remove('hidden');
        importBtn.classList.remove('hidden');
        templateBtn.classList.remove('hidden');
        exportBtn.setAttribute('data-type', 'performance');
        importBtn.setAttribute('data-type', 'performance');
        templateBtn.setAttribute('data-type', 'performance');
    } else if (sectionId === 'attendance-section') {
        exportBtn.classList.remove('hidden');
        importBtn.classList.remove('hidden');
        templateBtn.classList.remove('hidden');
        exportBtn.setAttribute('data-type', 'attendance');
        importBtn.setAttribute('data-type', 'attendance');
        templateBtn.setAttribute('data-type', 'attendance');
    }
    
    lucide.createIcons();
}

// Download template
function downloadTemplate(type) {
    console.log('📥 Downloading template:', type);
    
    if (type === 'members') {
        const csv = 'ID,Name,Email,Role,Joining Date\n' +
                   '1,John Doe,john@example.com,QA Engineer,2024-01-15\n' +
                   '2,Jane Smith,jane@example.com,Senior QA Engineer,2023-06-01';
        downloadFile(new Blob([csv], { type: 'text/csv' }), 'template-team-members.csv');
    } else if (type === 'performance') {
        const csv = 'Team Member,Project Name,Period Type,Date,Test Cases Created,Test Cases Executed,Defects Reported,Asana Tickets\n' +
                   'John Doe,DSOT,Daily,2024-12-10,50,45,1,2\n' +
                   'John Doe,CMUI,Weekly,2024-12-02 to 2024-12-08,100,90,3,5\n' +
                   'Jane Smith,DMB,Monthly,2024-12,260,250,10,15';
        downloadFile(new Blob([csv], { type: 'text/csv' }), 'template-performance.csv');
    } else if (type === 'attendance') {
        const csv = 'ID,Member ID,Member Name,Date,Status,Notes\n' +
                   '1,1,John Doe,2024-12-01,present,\n' +
                   '2,1,John Doe,2024-12-02,wfh,Working from home\n' +
                   '3,2,Jane Smith,2024-12-01,present,';
        downloadFile(new Blob([csv], { type: 'text/csv' }), 'template-attendance.csv');
    }
    
    closeTemplateMenu();
    showNotification('Template downloaded!', 'success');
}

// ===== ATTENDANCE ACTIONS =====

// Edit attendance
function editAttendance(attId) {
    const att = attendanceData.find(a => a.id === attId);
    if (!att) return;
    
    // Populate edit form
    document.getElementById('edit-att-id').value = att.id;
    document.getElementById('edit-att-member').value = att.memberId;
    document.getElementById('edit-att-date').value = att.date;
    document.getElementById('edit-att-status').value = att.status;
    document.getElementById('edit-att-notes').value = att.notes || '';
    
    // Populate member dropdown
    const memberSelect = document.getElementById('edit-att-member');
    memberSelect.innerHTML = '<option value="">Choose a member...</option>' +
        teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    memberSelect.value = att.memberId;
    
    document.getElementById('edit-attendance-modal').classList.remove('hidden');
    lucide.createIcons();
}

function closeEditAttendanceModal() {
    document.getElementById('edit-attendance-modal').classList.add('hidden');
    document.getElementById('edit-attendance-form').reset();
}

// Handle edit attendance form submission
document.addEventListener('DOMContentLoaded', function() {
    const editAttForm = document.getElementById('edit-attendance-form');
    if (editAttForm) {
        editAttForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const attId = document.getElementById('edit-att-id').value;
            const attIndex = attendanceData.findIndex(a => a.id === attId);
            
            if (attIndex === -1) {
                showNotification('Attendance record not found!', 'error');
                return;
            }
            
            attendanceData[attIndex] = {
                ...attendanceData[attIndex],
                memberId: document.getElementById('edit-att-member').value,
                date: document.getElementById('edit-att-date').value,
                status: document.getElementById('edit-att-status').value,
                notes: document.getElementById('edit-att-notes').value || ''
            };
            
            saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
            renderAttendanceHistory();
            renderAttendanceSummary();
            renderAttendanceCalendar();
            updateDashboard();
            closeEditAttendanceModal();
            
            showNotification('Attendance updated successfully!', 'success');
        });
    }
});

// Duplicate attendance
function duplicateAttendance(attId) {
    const att = attendanceData.find(a => a.id === attId);
    if (!att) return;
    
    if (!confirm('Create a duplicate of this attendance record?')) {
        return;
    }
    
    const duplicate = {
        ...att,
        id: Date.now().toString(),
        addedDate: new Date().toISOString()
    };
    
    attendanceData.push(duplicate);
    saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
    renderAttendanceHistory();
    renderAttendanceSummary();
    renderAttendanceCalendar();
    updateDashboard();
    
    showNotification('Attendance record duplicated successfully!', 'success');
}

// ===== ATTENDANCE CALENDAR VIEW =====

let currentCalendarDate = new Date();
let currentCalendarViewType = 'month'; // 'month' or 'year'

// Render attendance calendar
function renderAttendanceCalendar() {
    const viewType = document.getElementById('calendar-view-type')?.value || 'month';
    currentCalendarViewType = viewType;
    
    if (viewType === 'year') {
        renderYearlyCalendar();
    } else {
        renderMonthlyCalendar();
    }
}

// Render monthly calendar
function renderMonthlyCalendar() {
    const calendar = document.getElementById('attendance-calendar');
    const memberFilter = document.getElementById('calendar-member-filter').value;
    
    if (!calendar) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update month/year dropdowns
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    
    if (monthSelect) {
        monthSelect.value = month;
    }
    
    if (yearSelect) {
        yearSelect.value = year;
    }
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Get today's date for highlighting
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    
    // Build calendar HTML
    let calendarHTML = `
        <div class="grid grid-cols-7 gap-2">
            <!-- Day headers -->
            <div class="text-center text-xs font-semibold text-gray-600 py-1">Su</div>
            <div class="text-center text-xs font-semibold text-gray-600 py-1">Mo</div>
            <div class="text-center text-xs font-semibold text-gray-600 py-1">Tu</div>
            <div class="text-center text-xs font-semibold text-gray-600 py-1">We</div>
            <div class="text-center text-xs font-semibold text-gray-600 py-1">Th</div>
            <div class="text-center text-xs font-semibold text-gray-600 py-1">Fr</div>
            <div class="text-center text-xs font-semibold text-gray-600 py-1">Sa</div>
    `;
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        calendarHTML += '<div class="h-16"></div>';
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = isCurrentMonth && day === today.getDate();
        
        // Get attendance for this date
        let attendanceRecords = attendanceData.filter(a => a.date === dateStr);
        
        // Filter by member if selected
        if (memberFilter) {
            attendanceRecords = attendanceRecords.filter(a => a.memberId === memberFilter);
        }
        
        // Check if weekend or holiday
        const isWeekendDay = isWeekend(dateStr);
        const holiday = getHoliday(dateStr);
        
        // Determine color based on attendance status
        let bgColor = 'bg-gray-100';
        let textColor = 'text-gray-900';
        let statusText = '';
        let borderClass = '';
        
        // Mark weekends
        if (isWeekendDay) {
            bgColor = 'bg-gray-200';
            textColor = 'text-gray-600';
            borderClass = 'border-2 border-gray-400';
        }
        
        // Mark holidays (override weekend)
        if (holiday) {
            bgColor = 'bg-yellow-100';
            textColor = 'text-yellow-900';
            borderClass = 'border-2 border-yellow-500';
            statusText = '🎉';
        }
        
        if (attendanceRecords.length > 0 && !holiday) {
            // If filtering by member, show that member's status
            if (memberFilter) {
                const status = attendanceRecords[0].status;
                if (status === 'available') {
                    bgColor = 'bg-green-300';
                    statusText = 'A';
                } else if (status === 'pto-full') {
                    bgColor = 'bg-blue-300';
                    statusText = 'PTO';
                } else if (status === 'pto-first-half' || status === 'pto-second-half') {
                    bgColor = 'bg-blue-200';
                    statusText = 'PTO½';
                } else if (status === 'lwp-full') {
                    bgColor = 'bg-orange-300';
                    statusText = 'LWP';
                } else if (status === 'lwp-first-half' || status === 'lwp-second-half') {
                    bgColor = 'bg-orange-200';
                    statusText = 'LWP½';
                } else if (status === 'pl-full') {
                    bgColor = 'bg-purple-300';
                    statusText = 'PL';
                } else if (status === 'co-full') {
                    bgColor = 'bg-teal-300';
                    statusText = 'CO';
                } else if (status === 'holiday') {
                    bgColor = 'bg-yellow-300';
                    statusText = '🎉';
                }
            } else {
                // Show count of records for all members
                // Determine color based on the most common status
                const statusCounts = {};
                attendanceRecords.forEach(record => {
                    statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
                });
                
                // Get the most common status
                let mostCommonStatus = 'available';
                let maxCount = 0;
                for (const [status, count] of Object.entries(statusCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        mostCommonStatus = status;
                    }
                }
                
                // Set color based on most common status
                if (mostCommonStatus === 'available') {
                    bgColor = 'bg-green-300';
                } else if (mostCommonStatus === 'pto-full') {
                    bgColor = 'bg-blue-300';
                } else if (mostCommonStatus === 'pto-first-half' || mostCommonStatus === 'pto-second-half') {
                    bgColor = 'bg-blue-200';
                } else if (mostCommonStatus === 'lwp-full') {
                    bgColor = 'bg-orange-300';
                } else if (mostCommonStatus === 'lwp-first-half' || mostCommonStatus === 'lwp-second-half') {
                    bgColor = 'bg-orange-200';
                } else if (mostCommonStatus === 'pl-full') {
                    bgColor = 'bg-purple-300';
                } else if (mostCommonStatus === 'co-full') {
                    bgColor = 'bg-teal-300';
                } else if (mostCommonStatus === 'holiday') {
                    bgColor = 'bg-yellow-300';
                } else {
                    bgColor = 'bg-green-300';
                }
                
                statusText = attendanceRecords.length;
            }
        }
        
        // Override with today color if it's today
        if (isToday) {
            bgColor = 'bg-cyan-400';
            textColor = 'text-white';
        }
        
        const titleText = holiday ? `${holiday.name} - ${dateStr}` : (isWeekendDay ? `Weekend - ${dateStr}` : dateStr);
        
        calendarHTML += `
            <div class="h-16 flex flex-col items-center justify-center ${bgColor} ${textColor} ${borderClass} rounded-lg cursor-pointer hover:opacity-80 transition-opacity" 
                 onclick="showDayAttendance('${dateStr}')" 
                 title="${titleText}">
                <div class="text-xs font-medium">${day}</div>
                ${statusText ? `<div class="text-xs mt-0.5">${statusText}</div>` : ''}
            </div>
        `;
    }
    
    calendarHTML += '</div>';
    calendar.innerHTML = calendarHTML;
    
    lucide.createIcons();
    
    // Update attendance summary for selected month
    renderAttendanceSummary();
    
    // Update quick leave summary
    renderQuickLeaveSummary();
}

// Render yearly calendar (12 months in grid)
function renderYearlyCalendar() {
    const calendar = document.getElementById('attendance-calendar');
    if (!calendar) return;
    
    const year = currentCalendarDate.getFullYear();
    
    // Update year dropdown for yearly view
    const yearSelect = document.getElementById('calendar-year-select-yearly');
    if (yearSelect) {
        yearSelect.value = year;
    }
    
    let calendarHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    
    // Render all 12 months
    for (let month = 0; month < 12; month++) {
        const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' });
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        calendarHTML += `
            <div class="border border-gray-200 rounded-lg p-3 bg-white">
                <h4 class="text-sm font-bold text-gray-900 mb-2 text-center">${monthName}</h4>
                <div class="grid grid-cols-7 gap-1 text-xs">
        `;
        
        // Day headers
        const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        dayHeaders.forEach(day => {
            calendarHTML += `<div class="text-center font-semibold text-gray-600 py-1">${day}</div>`;
        });
        
        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            calendarHTML += '<div></div>';
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Get attendance for this date
            const attendanceRecords = attendanceData.filter(a => a.date === dateStr);
            
            let bgColor = 'bg-white';
            let hasLeave = false;
            
            if (isWeekend) {
                bgColor = 'bg-gray-100';
            } else if (attendanceRecords.length > 0) {
                // Check if any leave type exists
                const hasAnyLeave = attendanceRecords.some(a => 
                    a.status.includes('pto') || 
                    a.status.includes('lwp') || 
                    a.status.includes('pl') || 
                    a.status.includes('co')
                );
                
                if (hasAnyLeave) {
                    hasLeave = true;
                    // Determine color based on most common leave type
                    const statusCounts = {};
                    attendanceRecords.forEach(record => {
                        if (record.status.includes('pto') || record.status.includes('lwp') || 
                            record.status.includes('pl') || record.status.includes('co')) {
                            statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
                        }
                    });
                    
                    let mostCommonStatus = '';
                    let maxCount = 0;
                    for (const [status, count] of Object.entries(statusCounts)) {
                        if (count > maxCount) {
                            maxCount = count;
                            mostCommonStatus = status;
                        }
                    }
                    
                    if (mostCommonStatus.includes('pto-full')) {
                        bgColor = 'bg-blue-400';
                    } else if (mostCommonStatus.includes('pto')) {
                        bgColor = 'bg-blue-300';
                    } else if (mostCommonStatus.includes('lwp-full')) {
                        bgColor = 'bg-orange-400';
                    } else if (mostCommonStatus.includes('lwp')) {
                        bgColor = 'bg-orange-300';
                    } else if (mostCommonStatus.includes('pl')) {
                        bgColor = 'bg-purple-400';
                    } else if (mostCommonStatus.includes('co')) {
                        bgColor = 'bg-teal-400';
                    }
                }
            }
            
            const textColor = hasLeave ? 'text-white font-bold' : 'text-gray-700';
            
            calendarHTML += `
                <div class="${bgColor} ${textColor} text-center py-1 rounded cursor-pointer hover:ring-2 hover:ring-indigo-300" 
                     onclick="showDayAttendance('${dateStr}')" 
                     title="${dateStr}">
                    ${day}
                </div>
            `;
        }
        
        calendarHTML += `
                </div>
            </div>
        `;
    }
    
    calendarHTML += '</div>';
    calendar.innerHTML = calendarHTML;
    
    lucide.createIcons();
    
    // Update quick leave summary for entire year
    renderQuickLeaveSummary();
}

// Change calendar month
function changeCalendarMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderAttendanceCalendar();
}

// Render quick leave summary for current month or year
function renderQuickLeaveSummary() {
    const container = document.getElementById('quick-leave-summary');
    if (!container) return;
    
    const year = currentCalendarDate.getFullYear();
    const viewType = currentCalendarViewType;
    
    // Get start and end dates based on view type
    let startDateStr, endDateStr;
    if (viewType === 'year') {
        startDateStr = `${year}-01-01`;
        endDateStr = `${year}-12-31`;
    } else {
        const month = currentCalendarDate.getMonth();
        const monthStr = String(month + 1).padStart(2, '0');
        const lastDay = new Date(year, month + 1, 0).getDate();
        startDateStr = `${year}-${monthStr}-01`;
        endDateStr = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    }
    
    if (teamMembers.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic">No team members</p>';
        return;
    }
    
    // Calculate leave counts for each member
    const memberLeaveData = teamMembers.map(member => {
        const memberAttendance = attendanceData.filter(att => {
            return att.memberId === member.id && 
                   att.date >= startDateStr && 
                   att.date <= endDateStr;
        });
        
        let ptoFull = 0, ptoHalf = 0;
        let lwpFull = 0, lwpHalf = 0;
        let plFull = 0, coFull = 0;
        let totalLeaves = 0;
        
        memberAttendance.forEach(att => {
            if (att.status === 'pto-full') {
                ptoFull++;
                totalLeaves += 1;
            } else if (att.status === 'pto-first-half' || att.status === 'pto-second-half') {
                ptoHalf++;
                totalLeaves += 0.5;
            } else if (att.status === 'lwp-full') {
                lwpFull++;
                totalLeaves += 1;
            } else if (att.status === 'lwp-first-half' || att.status === 'lwp-second-half') {
                lwpHalf++;
                totalLeaves += 0.5;
            } else if (att.status === 'pl-full') {
                plFull++;
                totalLeaves += 1;
            } else if (att.status === 'co-full') {
                coFull++;
                totalLeaves += 1;
            }
        });
        
        return {
            member,
            ptoFull,
            ptoHalf,
            lwpFull,
            lwpHalf,
            plFull,
            coFull,
            totalLeaves
        };
    });
    
    // Calculate team totals
    const teamTotals = memberLeaveData.reduce((acc, data) => ({
        ptoFull: acc.ptoFull + data.ptoFull,
        ptoHalf: acc.ptoHalf + data.ptoHalf,
        lwpFull: acc.lwpFull + data.lwpFull,
        lwpHalf: acc.lwpHalf + data.lwpHalf,
        plFull: acc.plFull + data.plFull,
        coFull: acc.coFull + data.coFull,
        totalLeaves: acc.totalLeaves + data.totalLeaves
    }), { ptoFull: 0, ptoHalf: 0, lwpFull: 0, lwpHalf: 0, plFull: 0, coFull: 0, totalLeaves: 0 });
    
    // Render HTML
    let html = '';
    
    // Team Total Summary
    html += `
        <div class="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-200 mb-3">
            <div class="font-bold text-gray-900 mb-2 flex items-center justify-between">
                <span>Team Total</span>
                <span class="text-lg text-indigo-600">${teamTotals.totalLeaves.toFixed(1)} days</span>
            </div>
            <div class="grid grid-cols-2 gap-1 text-xs">
                ${teamTotals.ptoFull > 0 ? `<div class="flex justify-between"><span class="text-gray-600">PTO Full:</span><span class="font-medium">${teamTotals.ptoFull}</span></div>` : ''}
                ${teamTotals.ptoHalf > 0 ? `<div class="flex justify-between"><span class="text-gray-600">PTO Half:</span><span class="font-medium">${teamTotals.ptoHalf}</span></div>` : ''}
                ${teamTotals.lwpFull > 0 ? `<div class="flex justify-between"><span class="text-gray-600">LWP Full:</span><span class="font-medium">${teamTotals.lwpFull}</span></div>` : ''}
                ${teamTotals.lwpHalf > 0 ? `<div class="flex justify-between"><span class="text-gray-600">LWP Half:</span><span class="font-medium">${teamTotals.lwpHalf}</span></div>` : ''}
                ${teamTotals.plFull > 0 ? `<div class="flex justify-between"><span class="text-gray-600">PL:</span><span class="font-medium">${teamTotals.plFull}</span></div>` : ''}
                ${teamTotals.coFull > 0 ? `<div class="flex justify-between"><span class="text-gray-600">CO:</span><span class="font-medium">${teamTotals.coFull}</span></div>` : ''}
            </div>
        </div>
    `;
    
    // Individual Member Summaries
    memberLeaveData.forEach(data => {
        if (data.totalLeaves === 0) return; // Skip members with no leaves
        
        html += `
            <div class="bg-gray-50 p-2 rounded border border-gray-200 hover:bg-gray-100 transition-colors">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-semibold text-gray-900 truncate" title="${data.member.name}">${data.member.name}</span>
                    <span class="font-bold text-indigo-600">${data.totalLeaves.toFixed(1)}</span>
                </div>
                <div class="grid grid-cols-2 gap-1">
                    ${data.ptoFull > 0 ? `<div class="flex justify-between text-gray-600"><span>PTO:</span><span>${data.ptoFull}</span></div>` : ''}
                    ${data.ptoHalf > 0 ? `<div class="flex justify-between text-gray-600"><span>PTO½:</span><span>${data.ptoHalf}</span></div>` : ''}
                    ${data.lwpFull > 0 ? `<div class="flex justify-between text-gray-600"><span>LWP:</span><span>${data.lwpFull}</span></div>` : ''}
                    ${data.lwpHalf > 0 ? `<div class="flex justify-between text-gray-600"><span>LWP½:</span><span>${data.lwpHalf}</span></div>` : ''}
                    ${data.plFull > 0 ? `<div class="flex justify-between text-gray-600"><span>PL:</span><span>${data.plFull}</span></div>` : ''}
                    ${data.coFull > 0 ? `<div class="flex justify-between text-gray-600"><span>CO:</span><span>${data.coFull}</span></div>` : ''}
                </div>
            </div>
        `;
    });
    
    // Show message if no leaves
    if (teamTotals.totalLeaves === 0) {
        html = '<p class="text-gray-500 italic text-center py-4">No leaves taken this month</p>';
    }
    
    container.innerHTML = html;
}

// Change calendar to selected month/year
function changeCalendarToSelected() {
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    
    if (monthSelect && yearSelect) {
        const selectedMonth = parseInt(monthSelect.value);
        const selectedYear = parseInt(yearSelect.value);
        
        currentCalendarDate = new Date(selectedYear, selectedMonth, 1);
        renderAttendanceCalendar();
    }
}

// Change calendar view type
function changeCalendarViewType() {
    const viewType = document.getElementById('calendar-view-type').value;
    const monthNav = document.getElementById('month-navigation');
    const yearNav = document.getElementById('year-navigation');
    
    if (viewType === 'year') {
        monthNav.classList.add('hidden');
        yearNav.classList.remove('hidden');
        populateYearDropdownForYearly();
    } else {
        monthNav.classList.remove('hidden');
        yearNav.classList.add('hidden');
    }
    
    renderAttendanceCalendar();
}

// Change calendar year for yearly view
function changeCalendarYear(direction) {
    currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() + direction);
    renderAttendanceCalendar();
}

// Change calendar to selected year
function changeCalendarToSelectedYear() {
    const yearSelect = document.getElementById('calendar-year-select-yearly');
    if (yearSelect) {
        const selectedYear = parseInt(yearSelect.value);
        currentCalendarDate = new Date(selectedYear, 0, 1);
        renderAttendanceCalendar();
    }
}

// Populate year dropdown
function populateYearDropdown() {
    const yearSelect = document.getElementById('calendar-year-select');
    if (!yearSelect) return;
    
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5; // 5 years back
    const endYear = currentYear + 5;   // 5 years forward
    
    let options = '';
    for (let year = startYear; year <= endYear; year++) {
        options += `<option value="${year}">${year}</option>`;
    }
    
    yearSelect.innerHTML = options;
    yearSelect.value = currentCalendarDate.getFullYear();
}

// Populate year dropdown for yearly view
function populateYearDropdownForYearly() {
    const yearSelect = document.getElementById('calendar-year-select-yearly');
    if (!yearSelect) return;
    
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 5;
    
    let options = '';
    for (let year = startYear; year <= endYear; year++) {
        options += `<option value="${year}">${year}</option>`;
    }
    
    yearSelect.innerHTML = options;
    yearSelect.value = currentCalendarDate.getFullYear();
}

// Show attendance for a specific day
function showDayAttendance(dateStr) {
    const memberFilter = document.getElementById('calendar-member-filter').value;
    let records = attendanceData.filter(a => a.date === dateStr);
    
    if (memberFilter) {
        records = records.filter(a => a.memberId === memberFilter);
    }
    
    const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    });
    
    const modal = document.getElementById('day-attendance-modal');
    const title = document.getElementById('day-attendance-title');
    const content = document.getElementById('day-attendance-content');
    
    title.textContent = `Attendance for ${formattedDate}`;
    
    if (records.length === 0) {
        content.innerHTML = '<p class="text-gray-500 text-center py-4">No attendance records for this date.</p>';
    } else {
        content.innerHTML = records.map(record => {
            const member = teamMembers.find(m => m.id === record.memberId);
            const statusColors = {
                'available': 'bg-green-100 text-green-800',
                'pto-full': 'bg-blue-100 text-blue-800',
                'pto-first-half': 'bg-blue-100 text-blue-800',
                'pto-second-half': 'bg-blue-100 text-blue-800',
                'lwp-full': 'bg-orange-100 text-orange-800',
                'lwp-first-half': 'bg-orange-100 text-orange-800',
                'lwp-second-half': 'bg-orange-100 text-orange-800',
                'pl-full': 'bg-purple-100 text-purple-800',
                'co-full': 'bg-teal-100 text-teal-800',
                'holiday': 'bg-yellow-100 text-yellow-800'
            };
            const statusColor = statusColors[record.status] || 'bg-gray-100 text-gray-800';
            
            // Format status display text
            const statusDisplayMap = {
                'available': 'AVAILABLE',
                'pto-full': 'PTO - FULL DAY',
                'pto-first-half': 'PTO - FIRST HALF',
                'pto-second-half': 'PTO - SECOND HALF',
                'lwp-full': 'LWP - FULL DAY',
                'lwp-first-half': 'LWP - FIRST HALF',
                'lwp-second-half': 'LWP - SECOND HALF',
                'pl-full': 'PL - FULL DAY',
                'co-full': 'CO - FULL DAY',
                'holiday': 'HOLIDAY'
            };
            const statusDisplay = statusDisplayMap[record.status] || record.status.toUpperCase();
            
            return `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                ${member ? member.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                                <h4 class="font-semibold text-gray-900">${member ? member.name : 'Unknown'}</h4>
                                <div class="flex items-center space-x-2 mt-1">
                                    <span class="px-2 py-1 rounded text-xs font-medium ${statusColor}">
                                        ${statusDisplay}
                                    </span>
                                    ${record.notes ? `<span class="text-sm text-gray-600">• ${record.notes}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="editAttendanceFromDay('${record.id}')" 
                                class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit">
                            <i data-lucide="edit-2" width="18" height="18"></i>
                        </button>
                        <button onclick="deleteAttendanceFromDay('${record.id}')" 
                                class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete">
                            <i data-lucide="trash-2" width="18" height="18"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    modal.classList.remove('hidden');
    lucide.createIcons();
}

// Close day attendance modal
function closeDayAttendanceModal() {
    document.getElementById('day-attendance-modal').classList.add('hidden');
}

// Edit attendance from day view
function editAttendanceFromDay(attId) {
    closeDayAttendanceModal();
    editAttendance(attId);
}

// Delete attendance from day view
function deleteAttendanceFromDay(attId) {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        attendanceData = attendanceData.filter(a => a.id !== attId);
        saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
        renderAttendanceHistory();
        renderAttendanceSummary();
        renderAttendanceCalendar();
        updateDashboard();
        closeDayAttendanceModal();
        showNotification('Attendance record deleted!', 'success');
    }
}

// Update calendar member filter dropdown
function updateCalendarMemberFilter() {
    const select = document.getElementById('calendar-member-filter');
    if (!select) return;
    
    select.innerHTML = '<option value="">All Members</option>' +
        teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', function() {
    populateYearDropdown();
    updateCalendarMemberFilter();
    renderAttendanceCalendar();
    
    // Initialize holiday form
    const holidayForm = document.getElementById('add-holiday-form');
    if (holidayForm) {
        holidayForm.addEventListener('submit', handleAddHoliday);
    }
    
    // Initialize edit holiday form
    const editHolidayForm = document.getElementById('edit-holiday-form');
    if (editHolidayForm) {
        editHolidayForm.addEventListener('submit', handleEditHoliday);
    }
    
    // Initialize bulk edit form
    const bulkEditForm = document.getElementById('bulk-edit-attendance-form');
    if (bulkEditForm) {
        bulkEditForm.addEventListener('submit', handleBulkEditAttendance);
        
        // Add event listeners for preview update
        document.getElementById('bulk-edit-start-date')?.addEventListener('change', updateBulkEditPreview);
        document.getElementById('bulk-edit-end-date')?.addEventListener('change', updateBulkEditPreview);
    }
});

// ===== HOLIDAYS & WEEKENDS MANAGEMENT =====

// Check if a date is a weekend
function isWeekend(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();
    return appSettings.weekendDays.includes(dayOfWeek);
}

// Check if a date is a holiday
function isHoliday(dateStr) {
    return holidaysData.some(h => h.date === dateStr);
}

// Get holiday for a date
function getHoliday(dateStr) {
    return holidaysData.find(h => h.date === dateStr);
}

// Save weekend settings
function saveWeekendSettings() {
    const excludeWeekends = document.getElementById('exclude-weekends').checked;
    const weekendCheckboxes = document.querySelectorAll('.weekend-day:checked');
    const weekendDays = Array.from(weekendCheckboxes).map(cb => parseInt(cb.value));
    
    appSettings = {
        weekendDays: weekendDays,
        excludeWeekendsFromAttendance: excludeWeekends
    };
    
    saveData(STORAGE_KEYS.SETTINGS, appSettings);
    renderAttendanceCalendar();
    renderAttendanceSummary();
    showNotification('Weekend settings saved successfully!', 'success');
}

// Load weekend settings into form
function loadWeekendSettings() {
    document.getElementById('exclude-weekends').checked = appSettings.excludeWeekendsFromAttendance;
    
    document.querySelectorAll('.weekend-day').forEach(cb => {
        cb.checked = appSettings.weekendDays.includes(parseInt(cb.value));
    });
}

// Handle add holiday
function handleAddHoliday(e) {
    e.preventDefault();
    
    const name = document.getElementById('holiday-name').value;
    const fromDate = document.getElementById('holiday-date-from').value;
    const toDate = document.getElementById('holiday-date-to').value;
    const type = document.getElementById('holiday-type').value;
    const description = document.getElementById('holiday-description').value;
    
    if (!fromDate) {
        showNotification('Please select a start date!', 'error');
        return;
    }
    
    // Create holidays for date range
    const startDate = new Date(fromDate + 'T00:00:00');
    const endDate = toDate ? new Date(toDate + 'T00:00:00') : startDate;
    
    if (endDate < startDate) {
        showNotification('End date must be after start date!', 'error');
        return;
    }
    
    const holidaysToAdd = [];
    const skippedDates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Skip if holiday already exists for this date
        if (holidaysData.some(h => h.date === dateStr)) {
            skippedDates.push(dateStr);
        } else {
            holidaysToAdd.push({
                id: Date.now().toString() + '_' + currentDate.getTime(),
                name: name,
                date: dateStr,
                type: type,
                description: description,
                addedDate: new Date().toISOString()
            });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (holidaysToAdd.length === 0) {
        showNotification('All dates in this range already have holidays!', 'error');
        return;
    }
    
    holidaysData.push(...holidaysToAdd);
    saveData(STORAGE_KEYS.HOLIDAYS, holidaysData);
    renderHolidaysList();
    renderAttendanceCalendar();
    document.getElementById('add-holiday-form').reset();
    
    const count = holidaysToAdd.length;
    let message = `${count} holiday${count > 1 ? 's' : ''} added successfully!`;
    if (skippedDates.length > 0) {
        message += ` (${skippedDates.length} date${skippedDates.length > 1 ? 's' : ''} skipped - already exist)`;
    }
    showNotification(message, 'success');
}

// Render holidays list
function renderHolidaysList() {
    const container = document.getElementById('holidays-list');
    const paginationContainer = document.getElementById('holidays-pagination');
    if (!container) return;
    
    if (holidaysData.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No holidays added yet.</p>';
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }
    
    // Sort holidays by date
    const sortedHolidays = [...holidaysData].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Pagination
    const totalItems = sortedHolidays.length;
    const totalPages = Math.ceil(totalItems / holidaysPagination.itemsPerPage);
    const startIndex = (holidaysPagination.currentPage - 1) * holidaysPagination.itemsPerPage;
    const endIndex = Math.min(startIndex + holidaysPagination.itemsPerPage, totalItems);
    const paginatedHolidays = sortedHolidays.slice(startIndex, endIndex);
    
    // Show pagination controls
    if (paginationContainer) {
        paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
    }
    
    container.innerHTML = paginatedHolidays.map(holiday => {
        const date = new Date(holiday.date + 'T00:00:00');
        const formattedDate = date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        
        const typeColors = {
            'public': 'bg-red-100 text-red-800',
            'company': 'bg-blue-100 text-blue-800',
            'optional': 'bg-green-100 text-green-800',
            'statutory-india': 'bg-orange-100 text-orange-800'
        };
        const typeColor = typeColors[holiday.type] || 'bg-gray-100 text-gray-800';
        
        return `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div class="flex-1">
                    <div class="flex items-center space-x-3">
                        <div class="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg text-white">
                            <i data-lucide="calendar-x" width="24" height="24"></i>
                        </div>
                        <div>
                            <h4 class="font-semibold text-gray-900">${holiday.name}</h4>
                            <div class="flex items-center space-x-2 mt-1">
                                <span class="text-sm text-gray-600">${formattedDate}</span>
                                <span class="px-2 py-1 rounded text-xs font-medium ${typeColor}">
                                    ${holiday.type.toUpperCase()}
                                </span>
                            </div>
                            ${holiday.description ? `<p class="text-sm text-gray-500 mt-1">${holiday.description}</p>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="editHoliday('${holiday.id}')" 
                            class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit">
                        <i data-lucide="edit-2" width="18" height="18"></i>
                    </button>
                    <button onclick="duplicateHoliday('${holiday.id}')" 
                            class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Duplicate">
                        <i data-lucide="copy" width="18" height="18"></i>
                    </button>
                    <button onclick="deleteHoliday('${holiday.id}')" 
                            class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete">
                        <i data-lucide="trash-2" width="18" height="18"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Update pagination info
    updateHolidaysPaginationInfo(startIndex + 1, endIndex, totalItems, holidaysPagination.currentPage, totalPages);
    
    lucide.createIcons();
}

// Update holidays pagination info
function updateHolidaysPaginationInfo(start, end, total, currentPage, totalPages) {
    document.getElementById('holidays-showing-start').textContent = start;
    document.getElementById('holidays-showing-end').textContent = end;
    document.getElementById('holidays-total').textContent = total;
    
    // Update prev/next buttons
    const prevBtn = document.getElementById('holidays-prev-btn');
    const nextBtn = document.getElementById('holidays-next-btn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
    }
    
    // Render page numbers
    const pageNumbersContainer = document.getElementById('holidays-page-numbers');
    if (!pageNumbersContainer) return;
    
    let pageButtons = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        pageButtons += `
            <button onclick="goToHolidaysPage(${i})" 
                    class="px-3 py-1 rounded-lg text-sm ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}">
                ${i}
            </button>
        `;
    }
    
    pageNumbersContainer.innerHTML = pageButtons;
}

// Change holidays page (prev/next)
function changeHolidaysPage(direction) {
    const totalPages = Math.ceil(holidaysData.length / holidaysPagination.itemsPerPage);
    
    if (direction === 'prev' && holidaysPagination.currentPage > 1) {
        holidaysPagination.currentPage--;
    } else if (direction === 'next' && holidaysPagination.currentPage < totalPages) {
        holidaysPagination.currentPage++;
    }
    
    renderHolidaysList();
}

// Go to specific holidays page
function goToHolidaysPage(page) {
    holidaysPagination.currentPage = page;
    renderHolidaysList();
}

// Edit holiday
function editHoliday(holidayId) {
    const holiday = holidaysData.find(h => h.id === holidayId);
    if (!holiday) return;
    
    document.getElementById('edit-holiday-id').value = holiday.id;
    document.getElementById('edit-holiday-name').value = holiday.name;
    document.getElementById('edit-holiday-date').value = holiday.date;
    document.getElementById('edit-holiday-type').value = holiday.type;
    document.getElementById('edit-holiday-description').value = holiday.description || '';
    
    document.getElementById('edit-holiday-modal').classList.remove('hidden');
    lucide.createIcons();
}

function closeEditHolidayModal() {
    document.getElementById('edit-holiday-modal').classList.add('hidden');
    document.getElementById('edit-holiday-form').reset();
}

function handleEditHoliday(e) {
    e.preventDefault();
    
    const holidayId = document.getElementById('edit-holiday-id').value;
    const name = document.getElementById('edit-holiday-name').value;
    const date = document.getElementById('edit-holiday-date').value;
    const type = document.getElementById('edit-holiday-type').value;
    const description = document.getElementById('edit-holiday-description').value;
    
    const holiday = holidaysData.find(h => h.id === holidayId);
    if (!holiday) return;
    
    // Check if another holiday exists for this date (excluding current)
    if (holidaysData.some(h => h.id !== holidayId && h.date === date)) {
        showNotification('A holiday already exists for this date!', 'error');
        return;
    }
    
    holiday.name = name;
    holiday.date = date;
    holiday.type = type;
    holiday.description = description;
    
    saveData(STORAGE_KEYS.HOLIDAYS, holidaysData);
    renderHolidaysList();
    renderAttendanceCalendar();
    closeEditHolidayModal();
    showNotification('Holiday updated successfully!', 'success');
}

// Duplicate holiday
function duplicateHoliday(holidayId) {
    const holiday = holidaysData.find(h => h.id === holidayId);
    if (!holiday) return;
    
    const duplicate = {
        ...holiday,
        id: Date.now().toString(),
        addedDate: new Date().toISOString()
    };
    
    holidaysData.push(duplicate);
    saveData(STORAGE_KEYS.HOLIDAYS, holidaysData);
    renderHolidaysList();
    renderAttendanceCalendar();
    showNotification('Holiday duplicated successfully! You can now edit it.', 'success');
}

// Delete holiday
function deleteHoliday(holidayId) {
    if (!confirm('Are you sure you want to delete this holiday?')) {
        return;
    }
    
    holidaysData = holidaysData.filter(h => h.id !== holidayId);
    saveData(STORAGE_KEYS.HOLIDAYS, holidaysData);
    renderHolidaysList();
    renderAttendanceCalendar();
    showNotification('Holiday deleted successfully!', 'success');
}

// ===== BULK EDIT ATTENDANCE =====

// Populate bulk edit members checkboxes
function populateBulkEditMembers() {
    const container = document.getElementById('bulk-edit-members-list');
    if (!container) {
        console.error('Bulk edit members list container not found');
        return;
    }
    
    console.log('Populating bulk edit members, count:', teamMembers.length);
    
    if (teamMembers.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 italic">No team members available. Please add team members first.</p>';
        return;
    }
    
    container.innerHTML = teamMembers.map(m => `
        <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input type="checkbox" class="bulk-edit-member-checkbox rounded" value="${m.id}" onchange="updateBulkEditPreview()">
            <span class="text-sm">${m.name}</span>
        </label>
    `).join('');
    
    console.log('Bulk edit members populated successfully');
}

// Toggle all bulk edit members
function toggleAllBulkEditMembers() {
    const checkboxes = document.querySelectorAll('.bulk-edit-member-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    
    updateBulkEditPreview();
}

// Update bulk edit preview
function updateBulkEditPreview() {
    const checkboxes = document.querySelectorAll('.bulk-edit-member-checkbox:checked');
    const startDate = document.getElementById('bulk-edit-start-date')?.value;
    const endDate = document.getElementById('bulk-edit-end-date')?.value;
    const preview = document.getElementById('bulk-edit-preview');
    
    if (!preview) return;
    
    const selectedMembers = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedMembers.length === 0 || !startDate || !endDate) {
        preview.textContent = '';
        return;
    }
    
    // Calculate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
        preview.textContent = '⚠️ Start date must be before end date';
        preview.className = 'text-sm text-red-600';
        return;
    }
    
    // Always exclude weekends (Saturday=6, Sunday=0)
    let dateCount = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        // Exclude Saturday (6) and Sunday (0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            dateCount++;
        }
    }
    
    const totalRecords = selectedMembers.length * dateCount;
    preview.textContent = `📊 Will update/create ${totalRecords} records (${selectedMembers.length} members × ${dateCount} weekdays)`;
    preview.className = 'text-sm text-indigo-600 font-medium';
}

// Handle bulk edit attendance
function handleBulkEditAttendance(e) {
    e.preventDefault();
    
    const checkboxes = document.querySelectorAll('.bulk-edit-member-checkbox:checked');
    const startDate = document.getElementById('bulk-edit-start-date').value;
    const endDate = document.getElementById('bulk-edit-end-date').value;
    const status = document.getElementById('bulk-edit-status').value;
    const notes = document.getElementById('bulk-edit-notes').value;
    
    const selectedMemberIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedMemberIds.length === 0) {
        showNotification('Please select at least one member', 'error');
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
        showNotification('Start date must be before end date', 'error');
        return;
    }
    
    // Generate dates - ALWAYS exclude weekends (Saturday and Sunday)
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        // Exclude Saturday (6) and Sunday (0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = d.toISOString().slice(0, 10);
            dates.push(dateStr);
        }
    }
    
    if (dates.length === 0) {
        showNotification('No weekdays found in the selected range', 'error');
        return;
    }
    
    // Confirm action
    const memberNames = selectedMemberIds.map(id => {
        const member = teamMembers.find(m => m.id === id);
        return member ? member.name : 'Unknown';
    }).join(', ');
    
    const confirmMsg = `Update attendance for:\n\n` +
                      `Members: ${memberNames}\n` +
                      `Dates: ${dates[0]} to ${dates[dates.length - 1]} (weekdays only)\n` +
                      `Total Records: ${selectedMemberIds.length * dates.length}\n` +
                      `New Status: ${status}\n\n` +
                      `This will create new records or update existing ones.\n` +
                      `Weekends (Sat & Sun) are automatically excluded.\n\n` +
                      `Continue?`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    let created = 0;
    let updated = 0;
    
    selectedMemberIds.forEach(memberId => {
        dates.forEach(date => {
            // Check if record exists
            const existingIndex = attendanceData.findIndex(a => 
                a.memberId === memberId && a.date === date
            );
            
            if (existingIndex >= 0) {
                // Update existing record
                attendanceData[existingIndex].status = status;
                attendanceData[existingIndex].notes = notes || attendanceData[existingIndex].notes;
                updated++;
            } else {
                // Create new record
                attendanceData.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    memberId: memberId,
                    date: date,
                    status: status,
                    notes: notes || 'Bulk edited',
                    addedDate: new Date().toISOString()
                });
                created++;
            }
        });
    });
    
    saveData(STORAGE_KEYS.ATTENDANCE, attendanceData);
    renderAttendanceHistory();
    renderAttendanceSummary();
    renderAttendanceCalendar();
    updateDashboard();
    
    // Reset form
    document.getElementById('bulk-edit-attendance-form').reset();
    document.getElementById('bulk-edit-preview').textContent = '';
    
    // Repopulate checkboxes
    populateBulkEditMembers();
    
    showNotification(`Bulk edit completed! Created: ${created}, Updated: ${updated}`, 'success');
}
