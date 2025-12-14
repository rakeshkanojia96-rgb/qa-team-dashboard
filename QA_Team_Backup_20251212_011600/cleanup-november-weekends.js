// Cleanup Script: Remove November 2025 Weekend Attendance
// Run this in the browser console on the QA Team Performance Management Tool page

(function() {
    console.log('Starting November 2025 weekend attendance cleanup...');
    
    // Get November 2025 weekend dates
    const year = 2025;
    const month = 10; // November (0-indexed)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const weekendDates = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        
        // Check if Saturday (6) or Sunday (0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            weekendDates.push(dateStr);
        }
    }
    
    console.log(`Found ${weekendDates.length} weekend days in November 2025:`);
    console.log(weekendDates);
    
    // Get existing attendance data
    let attendanceData = JSON.parse(localStorage.getItem('qa_attendance_data') || '[]');
    const originalCount = attendanceData.length;
    console.log(`Total attendance records before cleanup: ${originalCount}`);
    
    // Filter out weekend attendance for November 2025
    const filteredData = attendanceData.filter(record => {
        // Keep record if it's NOT a November 2025 weekend
        return !weekendDates.includes(record.date);
    });
    
    const removedCount = originalCount - filteredData.length;
    
    // Save cleaned data
    localStorage.setItem('qa_attendance_data', JSON.stringify(filteredData));
    
    console.log('✅ Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Original records: ${originalCount}`);
    console.log(`   - Records removed: ${removedCount}`);
    console.log(`   - Remaining records: ${filteredData.length}`);
    console.log(`   - Weekend dates cleaned: ${weekendDates.length}`);
    console.log('');
    console.log('Weekend dates cleaned:');
    weekendDates.forEach(date => {
        const d = new Date(date + 'T00:00:00');
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        console.log(`   - ${date} (${dayName})`);
    });
    console.log('');
    console.log('🔄 Please refresh the page to see the updated attendance!');
    
    // Show alert
    alert(`Weekend Attendance Cleanup Complete!\n\n✅ Removed ${removedCount} records from November 2025 weekends\n\n📅 Cleaned ${weekendDates.length} weekend dates:\n${weekendDates.map(d => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    }).join('\n')}\n\nPlease refresh the page to see the updates.`);
})();
