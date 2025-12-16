// Analytics rendering and calculations

// Analytics date filter state
let analyticsDateFilter = {
    preset: '30',
    fromDate: null,
    toDate: null
};

// Apply analytics date filter
function applyAnalyticsDateFilter() {
    const preset = document.getElementById('analytics-date-preset').value;
    const customDates = document.getElementById('analytics-custom-dates');
    
    analyticsDateFilter.preset = preset;
    
    if (preset === 'custom') {
        customDates.style.display = 'flex';
        analyticsDateFilter.fromDate = document.getElementById('analytics-date-from').value;
        analyticsDateFilter.toDate = document.getElementById('analytics-date-to').value;
    } else {
        customDates.style.display = 'none';
        
        if (preset === 'all') {
            analyticsDateFilter.fromDate = null;
            analyticsDateFilter.toDate = null;
        } else {
            const days = parseInt(preset);
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);
            
            analyticsDateFilter.fromDate = fromDate.toISOString().split('T')[0];
            analyticsDateFilter.toDate = toDate.toISOString().split('T')[0];
        }
    }
    
    renderAnalytics();
}

// Clear analytics date filter
function clearAnalyticsDateFilter() {
    document.getElementById('analytics-date-preset').value = '30';
    document.getElementById('analytics-date-from').value = '';
    document.getElementById('analytics-date-to').value = '';
    document.getElementById('analytics-custom-dates').style.display = 'none';
    
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    
    analyticsDateFilter = {
        preset: '30',
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0]
    };
    
    renderAnalytics();
}

// Filter performance data by date
function getFilteredPerformanceByDate(data) {
    if (!analyticsDateFilter.fromDate || !analyticsDateFilter.toDate) {
        return data;
    }
    
    return data.filter(perf => {
        const perfDate = perf.period || perf.month;
        if (!perfDate) return false;
        
        return perfDate >= analyticsDateFilter.fromDate && perfDate <= analyticsDateFilter.toDate;
    });
}

// Render all analytics
function renderAnalytics() {
    renderAnalyticsKPIs();
    renderTopPerformers();
    renderPerformanceTrendsChart();
    renderProjectDistributionChart();
    renderMemberComparisonChart();
    renderDefectsVsTestsChart();
    renderMemberPerformanceSummary();
    lucide.createIcons();
}

// Render Analytics KPI Cards
function renderAnalyticsKPIs() {
    const filteredData = getFilteredPerformanceByDate(performanceData);
    
    if (filteredData.length === 0) {
        document.getElementById('analytics-total-tc').textContent = '0';
        document.getElementById('analytics-exec-rate').textContent = '0%';
        document.getElementById('analytics-total-defects').textContent = '0';
        document.getElementById('analytics-active-projects').textContent = '0';
        return;
    }

    // Calculate totals
    let totalCreated = 0;
    let totalExecuted = 0;
    let totalDefects = 0;
    const projects = new Set();

    filteredData.forEach(perf => {
        totalCreated += perf.testsCreated || 0;
        totalExecuted += perf.testsExecuted || 0;
        totalDefects += perf.defectsReported || 0;
        if (perf.projectName) projects.add(perf.projectName);
    });

    const execRate = totalCreated > 0 ? ((totalExecuted / totalCreated) * 100).toFixed(1) : 0;

    // Update KPIs
    document.getElementById('analytics-total-tc').textContent = totalCreated.toLocaleString();
    document.getElementById('analytics-exec-rate').textContent = execRate + '%';
    document.getElementById('analytics-total-defects').textContent = totalDefects.toLocaleString();
    document.getElementById('analytics-active-projects').textContent = projects.size;

    // Update trends
    document.getElementById('analytics-tc-trend').textContent = `${totalExecuted.toLocaleString()} executed`;
    document.getElementById('analytics-exec-trend').textContent = execRate >= 80 ? 'Good' : 'Needs improvement';
    document.getElementById('analytics-defects-trend').textContent = `${(totalDefects / filteredData.length).toFixed(1)} avg per record`;
    document.getElementById('analytics-projects-list').textContent = Array.from(projects).slice(0, 3).join(', ');
}

// Render Top Performers
function renderTopPerformers() {
    const container = document.getElementById('top-performers-list');
    const filteredData = getFilteredPerformanceByDate(performanceData);
    
    if (filteredData.length === 0 || teamMembers.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No performance data available</p>';
        return;
    }

    const memberStats = {};
    
    filteredData.forEach(perf => {

        if (!memberStats[perf.memberId]) {
            memberStats[perf.memberId] = {
                testsCreated: 0,
                testsExecuted: 0,
                defectsReported: 0,
                records: 0
            };
        }

        memberStats[perf.memberId].testsCreated += perf.testsCreated || 0;
        memberStats[perf.memberId].testsExecuted += perf.testsExecuted || 0;
        memberStats[perf.memberId].defectsReported += perf.defectsReported || 0;
        memberStats[perf.memberId].records++;
    });

    // Calculate scores and sort
    const performers = Object.entries(memberStats)
        .map(([memberId, stats]) => {
            const member = teamMembers.find(m => m.id === memberId);
            const score = (stats.testsCreated * 0.3) + (stats.testsExecuted * 0.4) + (stats.defectsReported * 0.3);
            return { member, stats, score };
        })
        .filter(p => p.member)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    if (performers.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No recent performance data</p>';
        return;
    }

    container.innerHTML = performers.map((performer, index) => {
        const badges = ['🥇', '🥈', '🥉'];
        return `
            <div class="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-bold text-gray-900">${badges[index]} ${performer.member.name}</h4>
                    <span class="text-2xl font-bold text-indigo-600">${performer.score.toFixed(0)}</span>
                </div>
                <div class="space-y-1 text-sm text-gray-600">
                    <div class="flex justify-between">
                        <span>TC Created:</span>
                        <span class="font-medium">${performer.stats.testsCreated}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>TC Executed:</span>
                        <span class="font-medium">${performer.stats.testsExecuted}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Defects Found:</span>
                        <span class="font-medium">${performer.stats.defectsReported}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Performance Trends Chart
function renderPerformanceTrendsChart() {
    const canvas = document.getElementById('testTrendsChart');
    const ctx = canvas.getContext('2d');
    const filteredData = getFilteredPerformanceByDate(performanceData);

    // Destroy existing chart if any
    if (window.testTrendsChartInstance) {
        window.testTrendsChartInstance.destroy();
    }

    if (filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Get last 6 months data
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toISOString().slice(0, 7));
    }

    const monthlyData = {};
    months.forEach(month => {
        monthlyData[month] = { created: 0, executed: 0, defects: 0 };
    });

    performanceData.forEach(perf => {
        const period = (perf.period || perf.month || '').slice(0, 7);
        if (monthlyData[period]) {
            monthlyData[period].created += perf.testsCreated || 0;
            monthlyData[period].executed += perf.testsExecuted || 0;
            monthlyData[period].defects += perf.defectsReported || 0;
        }
    });

    const labels = months.map(m => {
        const date = new Date(m + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    window.testTrendsChartInstance = new Chart(ctx, {
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

// Render Project Distribution Chart
function renderProjectDistributionChart() {
    const canvas = document.getElementById('projectDistributionChart');
    const ctx = canvas.getContext('2d');
    const filteredData = getFilteredPerformanceByDate(performanceData);

    if (window.projectDistributionChartInstance) {
        window.projectDistributionChartInstance.destroy();
    }

    if (filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    const projectStats = {};
    filteredData.forEach(perf => {
        const project = perf.projectName || 'Unknown';
        if (!projectStats[project]) {
            projectStats[project] = 0;
        }
        projectStats[project] += (perf.testsCreated || 0) + (perf.testsExecuted || 0);
    });

    const projects = Object.keys(projectStats).sort((a, b) => projectStats[b] - projectStats[a]).slice(0, 10);
    const values = projects.map(p => projectStats[p]);

    const colors = [
        'rgba(99, 102, 241, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(234, 179, 8, 0.8)',
        'rgba(20, 184, 166, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(148, 163, 184, 0.8)'
    ];

    window.projectDistributionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: projects,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Render Member Comparison Chart
function renderMemberComparisonChart() {
    const canvas = document.getElementById('memberComparisonChart');
    const ctx = canvas.getContext('2d');
    const filteredData = getFilteredPerformanceByDate(performanceData);

    if (window.memberComparisonChartInstance) {
        window.memberComparisonChartInstance.destroy();
    }

    if (filteredData.length === 0 || teamMembers.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    const memberStats = {};
    teamMembers.forEach(member => {
        memberStats[member.id] = {
            name: member.name,
            created: 0,
            executed: 0,
            defects: 0
        };
    });

    filteredData.forEach(perf => {
        if (memberStats[perf.memberId]) {
            memberStats[perf.memberId].created += perf.testsCreated || 0;
            memberStats[perf.memberId].executed += perf.testsExecuted || 0;
            memberStats[perf.memberId].defects += perf.defectsReported || 0;
        }
    });

    const members = Object.values(memberStats).sort((a, b) => b.created - a.created).slice(0, 10);
    const names = members.map(m => m.name);

    window.memberComparisonChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [
                {
                    label: 'Tests Created',
                    data: members.map(m => m.created),
                    backgroundColor: 'rgba(99, 102, 241, 0.8)'
                },
                {
                    label: 'Tests Executed',
                    data: members.map(m => m.executed),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)'
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

// Render Defects vs Tests Chart
function renderDefectsVsTestsChart() {
    const canvas = document.getElementById('defectsVsTestsChart');
    const ctx = canvas.getContext('2d');
    const filteredData = getFilteredPerformanceByDate(performanceData);

    if (window.defectsVsTestsChartInstance) {
        window.defectsVsTestsChartInstance.destroy();
    }

    if (filteredData.length === 0 || teamMembers.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    const memberStats = {};
    teamMembers.forEach(member => {
        memberStats[member.id] = {
            name: member.name,
            tests: 0,
            defects: 0
        };
    });

    filteredData.forEach(perf => {
        if (memberStats[perf.memberId]) {
            memberStats[perf.memberId].tests += (perf.testsCreated || 0) + (perf.testsExecuted || 0);
            memberStats[perf.memberId].defects += perf.defectsReported || 0;
        }
    });

    const members = Object.values(memberStats).filter(m => m.tests > 0);
    const scatterData = members.map(m => ({
        x: m.tests,
        y: m.defects,
        label: m.name
    }));

    window.defectsVsTestsChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Defects vs Tests',
                data: scatterData,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: 'rgba(99, 102, 241, 1)',
                pointRadius: 8,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${scatterData[context.dataIndex].label}: ${context.parsed.x} tests, ${context.parsed.y} defects`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Total Test Cases'
                    },
                    beginAtZero: true
                },
                y: {
                    title: {
                        display: true,
                        text: 'Defects Found'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Render Member Performance Summary Table
function renderMemberPerformanceSummary() {
    const tbody = document.getElementById('analytics-member-summary');
    const filteredData = getFilteredPerformanceByDate(performanceData);
    
    if (filteredData.length === 0 || teamMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No data available</td></tr>';
        return;
    }

    const memberStats = {};
    teamMembers.forEach(member => {
        memberStats[member.id] = {
            name: member.name,
            created: 0,
            executed: 0,
            defects: 0,
            months: new Set()
        };
    });

    filteredData.forEach(perf => {
        if (memberStats[perf.memberId]) {
            memberStats[perf.memberId].created += perf.testsCreated || 0;
            memberStats[perf.memberId].executed += perf.testsExecuted || 0;
            memberStats[perf.memberId].defects += perf.defectsReported || 0;
            
            const period = (perf.period || perf.month || '').slice(0, 7);
            if (period) memberStats[perf.memberId].months.add(period);
        }
    });

    const summaries = Object.values(memberStats)
        .map(stats => {
            const monthCount = stats.months.size || 1;
            const avgPerMonth = ((stats.created + stats.executed) / monthCount).toFixed(1);
            const qualityScore = stats.executed > 0 
                ? ((stats.defects / stats.executed) * 100).toFixed(1)
                : 0;
            
            return { ...stats, avgPerMonth, qualityScore, monthCount };
        })
        .sort((a, b) => (b.created + b.executed) - (a.created + a.executed));

    tbody.innerHTML = summaries.map(stats => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="font-medium text-gray-900">${stats.name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                ${stats.created.toLocaleString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                ${stats.executed.toLocaleString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                ${stats.defects.toLocaleString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-gray-600">
                ${stats.avgPerMonth}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <span class="px-2 py-1 text-xs font-medium rounded-full ${
                    stats.qualityScore < 5 ? 'bg-green-100 text-green-800' :
                    stats.qualityScore < 10 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                }">
                    ${stats.qualityScore}% defect rate
                </span>
            </td>
        </tr>
    `).join('');
}
