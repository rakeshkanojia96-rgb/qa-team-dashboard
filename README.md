# QA Team Performance Management Tool

A comprehensive frontend-only performance tracking dashboard for QA team leads to manage team metrics, attendance, and appraisal data.

## Features

### ✅ Core Features (MVP)
- **Team Member Management**: Add and manage up to 4 QA team members
- **Performance Metrics Tracking**: 
  - Test cases written, executed, passed/failed
  - Bugs found and severity distribution
  - Productivity metrics and velocity trends
- **Individual Dashboards**: Personal performance views for each team member
- **Attendance Tracking**: Track attendance, leaves, and work hours
- **Analytics & Charts**: Visual representation of performance trends
- **Data Export/Import**: Backup and restore data as JSON files

### 🎯 Appraisal Support
- Quarterly/annual performance summaries
- Goal setting and tracking
- Historical performance data
- Strengths and improvement areas identification

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **UI Framework**: TailwindCSS for modern styling
- **Charts**: Chart.js for data visualization
- **Icons**: Lucide Icons
- **Storage**: Browser LocalStorage (no backend required)

## How to Use

1. **Open the Tool**: Simply open `index.html` in any modern web browser
2. **Add Team Members**: Start by adding your 4 team members
3. **Enter Data**: Input performance metrics, attendance, and other data
   - **Manual Entry**: Use the forms in each section
   - **Bulk Import**: Import data via CSV or Excel files
4. **View Analytics**: Check dashboards and performance trends
5. **Export Data**: Export as JSON or CSV format
6. **Import Data**: Import JSON (full data) or CSV/Excel (specific sections)

### Import/Export Options

#### Export Formats
- **JSON**: Complete backup of all data
- **CSV**: Separate files for Team Members, Performance, and Attendance

#### Import Formats
- **JSON**: Restore complete backup (.json)
- **CSV**: Import specific data (.csv)
- **Excel**: Import specific data (.xlsx, .xls)

#### Download Templates
Click the **"Templates"** button to download pre-formatted CSV templates with sample data.

For detailed CSV/Excel format specifications, see [CSV_EXCEL_FORMAT_GUIDE.md](CSV_EXCEL_FORMAT_GUIDE.md)

## Installation

No installation required! Just:
1. Download/clone this folder
2. Open `index.html` in your browser
3. Start tracking performance

## Data Storage

- All data is stored locally in your browser's LocalStorage
- Data persists across browser sessions
- Use Export/Import features for backup and data portability
- No internet connection required after initial load

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with LocalStorage support

## Future Enhancements

- PDF report generation
- Advanced analytics and predictive insights
- Team comparison views
- Skill matrix visualization
- Integration with JIRA/TestRail (optional)

## Support

For questions or feature requests, contact your development team.

---

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Developed for**: QA Team Lead - Performance Management
