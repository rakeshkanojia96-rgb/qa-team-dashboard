// 1-on-1 Review Page - Individual performance review without team member comparisons

// 1-on-1 date filter state
let oneOnOneDateFilter = {
    preset: '30',
    fromDate: null,
    toDate: null
};

let selectedMemberId = null;

// Apply date filter for 1-on-1
function applyOneOnOneDateFilter() {
    const preset = document.getElementById('one-on-one-date-preset').value;
    const customDates = document.getElementById('one-on-one-custom-dates');
    
    oneOnOneDateFilter.preset = preset;
    
    if (preset === 'custom') {
        customDates.style.display = 'flex';
        oneOnOneDateFilter.fromDate = document.getElementById('one-on-one-date-from').value;
        oneOnOneDateFilter.toDate = document.getElementById('one-on-one-date-to').value;
        
        if (!oneOnOneDateFilter.fromDate || !oneOnOneDateFilter.toDate) {
            return;
        }
    } else {
        customDates.style.display = 'none';
        
        if (preset === 'all') {
            oneOnOneDateFilter.fromDate = null;
            oneOnOneDateFilter.toDate = null;
        } else {
            const days = parseInt(preset);
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);
            
            oneOnOneDateFilter.fromDate = fromDate.toISOString().split('T')[0];
            oneOnOneDateFilter.toDate = toDate.toISOString().split('T')[0];
        }
    }
    
    renderOneOnOne();
}

// Filter performance data by date for 1-on-1
function getOneOnOneFilteredData(data) {
    if (!oneOnOneDateFilter.fromDate || !oneOnOneDateFilter.toDate) {
        return data;
    }
    
    return data.filter(perf => {
        const perfDate = perf.period || perf.month;
        if (!perfDate) return false;
        
        let perfDateComparable = perfDate;
        if (perfDate.length === 7) {
            perfDateComparable = perfDate + '-01';
        }
        
        return perfDateComparable >= oneOnOneDateFilter.fromDate && 
               perfDateComparable <= oneOnOneDateFilter.toDate;
    });
}

// Populate member dropdown
function populateOneOnOneMemberSelect() {
    const select = document.getElementById('one-on-one-member');
    if (!select) {
        console.error('1-on-1 member select not found');
        return;
    }
    
    console.log('Attempting to populate 1-on-1 dropdown...');
    console.log('teamMembers available:', typeof teamMembers !== 'undefined');
    console.log('teamMembers length:', Array.isArray(teamMembers) ? teamMembers.length : 'Not an array');
    console.log('teamMembers data:', teamMembers);
    
    select.innerHTML = '<option value="">Choose a team member...</option>';
    
    // Check if teamMembers is available and populated
    if (typeof teamMembers === 'undefined' || !Array.isArray(teamMembers) || teamMembers.length === 0) {
        console.warn('No team members available for 1-on-1 review');
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No team members found - Please add members first';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    teamMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        select.appendChild(option);
    });
    
    console.log(`✓ Successfully populated 1-on-1 dropdown with ${teamMembers.length} members`);
}

// Main render function for 1-on-1 review
function renderOneOnOne() {
    selectedMemberId = document.getElementById('one-on-one-member').value;
    const contentDiv = document.getElementById('one-on-one-content');
    
    if (!selectedMemberId) {
        contentDiv.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i data-lucide="user-search" width="48" height="48" class="mx-auto mb-4 text-gray-400"></i>
                <p class="text-lg">Please select a team member to view their performance review</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    const member = teamMembers.find(m => m.id === selectedMemberId);
    if (!member) return;
    
    const filteredData = getOneOnOneFilteredData(performanceData);
    const memberData = filteredData.filter(p => p.memberId === selectedMemberId);
    const teamData = filteredData;
    
    // Calculate member stats
    const memberStats = {
        testsCreated: 0,
        testsExecuted: 0,
        defectsReported: 0,
        asanaTickets: 0,
        months: new Set()
    };
    
    memberData.forEach(perf => {
        memberStats.testsCreated += perf.testsCreated || 0;
        memberStats.testsExecuted += perf.testsExecuted || 0;
        memberStats.defectsReported += perf.defectsReported || 0;
        memberStats.asanaTickets += perf.asanaTickets || 0;
        const period = (perf.period || perf.month || '').slice(0, 7);
        if (period) memberStats.months.add(period);
    });
    
    // Calculate team averages
    const teamStats = {
        testsCreated: 0,
        testsExecuted: 0,
        defectsReported: 0,
        asanaTickets: 0,
        memberCount: new Set()
    };
    
    teamData.forEach(perf => {
        teamStats.testsCreated += perf.testsCreated || 0;
        teamStats.testsExecuted += perf.testsExecuted || 0;
        teamStats.defectsReported += perf.defectsReported || 0;
        teamStats.asanaTickets += perf.asanaTickets || 0;
        teamStats.memberCount.add(perf.memberId);
    });
    
    const teamMemberCount = teamStats.memberCount.size || 1;
    const teamAvg = {
        testsCreated: Math.round(teamStats.testsCreated / teamMemberCount),
        testsExecuted: Math.round(teamStats.testsExecuted / teamMemberCount),
        defectsReported: Math.round(teamStats.defectsReported / teamMemberCount),
        asanaTickets: Math.round(teamStats.asanaTickets / teamMemberCount)
    };
    
    const monthCount = memberStats.months.size || 1;
    const avgPerMonth = (memberStats.testsExecuted / monthCount).toFixed(1);
    const executionRate = memberStats.testsCreated > 0 
        ? ((memberStats.testsExecuted / memberStats.testsCreated) * 100).toFixed(1)
        : 0;
    const defectRate = memberStats.testsExecuted > 0 
        ? ((memberStats.defectsReported / memberStats.testsExecuted) * 100).toFixed(1)
        : 0;
    
    contentDiv.innerHTML = `
        <!-- Member Header -->
        <div class="card p-6 mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">${member.name}</h3>
                    <p class="text-gray-600">${member.email}</p>
                    <p class="text-sm text-gray-500 mt-2">Review Period: ${oneOnOneDateFilter.fromDate || 'Start'} to ${oneOnOneDateFilter.toDate || 'End'}</p>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-600">Active Months</div>
                    <div class="text-3xl font-bold text-indigo-600">${monthCount}</div>
                </div>
            </div>
        </div>
        
        <!-- Individual Performance Metrics -->
        <div class="mb-6">
            <h4 class="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <i data-lucide="user" width="20" height="20" class="mr-2 text-indigo-600"></i>
                Individual Performance
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="card p-6">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="text-sm font-medium text-gray-600">Tests Created</h5>
                        <i data-lucide="file-plus" width="20" height="20" class="text-indigo-600"></i>
                    </div>
                    <div class="text-3xl font-bold text-gray-900">${memberStats.testsCreated.toLocaleString()}</div>
                    <div class="text-xs text-gray-500 mt-1">Total in period</div>
                </div>
                
                <div class="card p-6">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="text-sm font-medium text-gray-600">Tests Executed</h5>
                        <i data-lucide="check-circle" width="20" height="20" class="text-green-600"></i>
                    </div>
                    <div class="text-3xl font-bold text-gray-900">${memberStats.testsExecuted.toLocaleString()}</div>
                    <div class="text-xs text-gray-500 mt-1">Avg ${avgPerMonth}/month</div>
                </div>
                
                <div class="card p-6">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="text-sm font-medium text-gray-600">Defects Reported</h5>
                        <i data-lucide="bug" width="20" height="20" class="text-orange-600"></i>
                    </div>
                    <div class="text-3xl font-bold text-gray-900">${memberStats.defectsReported.toLocaleString()}</div>
                    <div class="text-xs text-gray-500 mt-1">${defectRate}% defect rate</div>
                </div>
                
                <div class="card p-6">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="text-sm font-medium text-gray-600">Asana Tickets</h5>
                        <i data-lucide="list-checks" width="20" height="20" class="text-purple-600"></i>
                    </div>
                    <div class="text-3xl font-bold text-gray-900">${memberStats.asanaTickets.toLocaleString()}</div>
                    <div class="text-xs text-gray-500 mt-1">Total tickets</div>
                </div>
            </div>
        </div>
        
        <!-- Performance Insights -->
        <div class="mb-6">
            <h4 class="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <i data-lucide="trending-up" width="20" height="20" class="mr-2 text-indigo-600"></i>
                Performance Insights
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="card p-6">
                    <div class="text-sm font-medium text-gray-600 mb-2">Execution Rate</div>
                    <div class="text-2xl font-bold ${executionRate >= 80 ? 'text-green-600' : executionRate >= 60 ? 'text-yellow-600' : 'text-orange-600'}">${executionRate}%</div>
                    <div class="text-xs text-gray-500 mt-1">Tests executed vs created</div>
                </div>
                
                <div class="card p-6">
                    <div class="text-sm font-medium text-gray-600 mb-2">Quality Score</div>
                    <div class="text-2xl font-bold ${defectRate >= 10 ? 'text-green-600' : defectRate >= 5 ? 'text-yellow-600' : 'text-orange-600'}">${defectRate}%</div>
                    <div class="text-xs text-gray-500 mt-1">Defect detection rate</div>
                </div>
                
                <div class="card p-6">
                    <div class="text-sm font-medium text-gray-600 mb-2">Monthly Average</div>
                    <div class="text-2xl font-bold text-indigo-600">${avgPerMonth}</div>
                    <div class="text-xs text-gray-500 mt-1">Tests executed per month</div>
                </div>
            </div>
        </div>
        
        <!-- Team Context (Averages Only) -->
        <div class="mb-6">
            <h4 class="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <i data-lucide="users" width="20" height="20" class="mr-2 text-indigo-600"></i>
                Team Average Context
                <span class="ml-2 text-sm font-normal text-gray-500">(${teamMemberCount} team members)</span>
            </h4>
            <div class="card p-6 bg-gray-50">
                <p class="text-sm text-gray-600 mb-4">These are team averages for context - not for direct comparison</p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div class="text-xs text-gray-600 mb-1">Avg Tests Created</div>
                        <div class="text-lg font-semibold text-gray-700">${teamAvg.testsCreated.toLocaleString()}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-600 mb-1">Avg Tests Executed</div>
                        <div class="text-lg font-semibold text-gray-700">${teamAvg.testsExecuted.toLocaleString()}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-600 mb-1">Avg Defects Reported</div>
                        <div class="text-lg font-semibold text-gray-700">${teamAvg.defectsReported.toLocaleString()}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-600 mb-1">Avg Asana Tickets</div>
                        <div class="text-lg font-semibold text-gray-700">${teamAvg.asanaTickets.toLocaleString()}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Performance Trend Chart -->
        <div class="mb-6">
            <h4 class="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <i data-lucide="line-chart" width="20" height="20" class="mr-2 text-indigo-600"></i>
                Performance Trend
            </h4>
            <div class="card p-6">
                <div style="height: 300px;">
                    <canvas id="one-on-one-trend-chart"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Project Breakdown -->
        <div class="mb-6">
            <h4 class="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <i data-lucide="folder" width="20" height="20" class="mr-2 text-indigo-600"></i>
                Project Breakdown
            </h4>
            <div class="card p-6">
                <div id="one-on-one-project-breakdown"></div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    renderOneOnOneTrendChart(memberData);
    renderOneOnOneProjectBreakdown(memberData);
}

// Render individual trend chart
function renderOneOnOneTrendChart(memberData) {
    const canvas = document.getElementById('one-on-one-trend-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (window.oneOnOneTrendChartInstance) {
        window.oneOnOneTrendChartInstance.destroy();
    }
    
    if (memberData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No performance data available', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const monthsSet = new Set();
    memberData.forEach(perf => {
        const period = (perf.period || perf.month || '').slice(0, 7);
        if (period) monthsSet.add(period);
    });
    
    const months = Array.from(monthsSet).sort();
    const monthlyData = {};
    months.forEach(month => {
        monthlyData[month] = { created: 0, executed: 0, defects: 0, asanaTickets: 0 };
    });
    
    memberData.forEach(perf => {
        const period = (perf.period || perf.month || '').slice(0, 7);
        if (monthlyData[period]) {
            monthlyData[period].created += perf.testsCreated || 0;
            monthlyData[period].executed += perf.testsExecuted || 0;
            monthlyData[period].defects += perf.defectsReported || 0;
            monthlyData[period].asanaTickets += perf.asanaTickets || 0;
        }
    });
    
    const labels = months.map(m => {
        const date = new Date(m + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    
    window.oneOnOneTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Tests Created',
                    data: months.map(m => monthlyData[m].created),
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Tests Executed',
                    data: months.map(m => monthlyData[m].executed),
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Defects Found',
                    data: months.map(m => monthlyData[m].defects),
                    borderColor: 'rgb(249, 115, 22)',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Asana Tickets',
                    data: months.map(m => monthlyData[m].asanaTickets),
                    borderColor: 'rgb(168, 85, 247)',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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

// Render project breakdown
function renderOneOnOneProjectBreakdown(memberData) {
    const container = document.getElementById('one-on-one-project-breakdown');
    if (!container) return;
    
    const projectStats = {};
    memberData.forEach(perf => {
        const project = perf.projectName || 'Unknown';
        if (!projectStats[project]) {
            projectStats[project] = {
                created: 0,
                executed: 0,
                defects: 0,
                asanaTickets: 0
            };
        }
        projectStats[project].created += perf.testsCreated || 0;
        projectStats[project].executed += perf.testsExecuted || 0;
        projectStats[project].defects += perf.defectsReported || 0;
        projectStats[project].asanaTickets += perf.asanaTickets || 0;
    });
    
    const projects = Object.keys(projectStats).sort((a, b) => 
        projectStats[b].executed - projectStats[a].executed
    );
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No project data available</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">TC Created</th>
                        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">TC Executed</th>
                        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Defects</th>
                        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Asana Tickets</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${projects.map(project => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm font-medium text-gray-900">${project}</td>
                            <td class="px-4 py-3 text-sm text-center text-gray-700">${projectStats[project].created.toLocaleString()}</td>
                            <td class="px-4 py-3 text-sm text-center text-gray-700">${projectStats[project].executed.toLocaleString()}</td>
                            <td class="px-4 py-3 text-sm text-center text-gray-700">${projectStats[project].defects.toLocaleString()}</td>
                            <td class="px-4 py-3 text-sm text-center text-gray-700">${projectStats[project].asanaTickets.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}
