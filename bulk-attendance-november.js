// Bulk Attendance Script for November 2025
// Run this in the browser console on the QA Team Performance Management Tool page

(function() {
    console.log('Starting bulk attendance marking for November 2025...');
    
    // Get November 2025 dates (excluding weekends)
    const year = 2025;
    const month = 10; // November (0-indexed)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dates.push(dateStr);
        }
    }
    
    console.log(`Found ${dates.length} working days in November 2025`);
    console.log('Dates:', dates);
    
    // Get all team members
    const members = JSON.parse(localStorage.getItem('qa_team_members') || '[]');
    console.log(`Found ${members.length} team members`);
    
    if (members.length === 0) {
        console.error('No team members found! Please add team members first.');
        return;
    }
    
    // Get existing attendance data
    let attendanceData = JSON.parse(localStorage.getItem('qa_attendance_data') || '[]');
    console.log(`Existing attendance records: ${attendanceData.length}`);
    
    let created = 0;
    let skipped = 0;
    
    // Create attendance records for each member for each working day
    members.forEach(member => {
        dates.forEach(date => {
            // Check if attendance already exists
            const exists = attendanceData.some(a => a.memberId === member.id && a.date === date);
            
            if (!exists) {
                attendanceData.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    memberId: member.id,
                    date: date,
                    status: 'available',
                    notes: 'Bulk marked for November 2025',
                    addedDate: new Date().toISOString()
                });
                created++;
            } else {
                skipped++;
            }
        });
    });
    
    // Save to localStorage
    localStorage.setItem('qa_attendance_data', JSON.stringify(attendanceData));
    
    console.log('✅ Bulk attendance marking completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Team Members: ${members.length}`);
    console.log(`   - Working Days: ${dates.length}`);
    console.log(`   - Records Created: ${created}`);
    console.log(`   - Records Skipped (already exist): ${skipped}`);
    console.log(`   - Total Records: ${attendanceData.length}`);
    console.log('');
    console.log('🔄 Please refresh the page to see the updated attendance!');
    
    // Show alert
    alert(`Bulk Attendance Marked!\n\n✅ Created ${created} records\n⏭️ Skipped ${skipped} existing records\n\n📅 November 2025 (excluding weekends)\n👥 ${members.length} team members\n\nPlease refresh the page to see the updates.`);
})();
