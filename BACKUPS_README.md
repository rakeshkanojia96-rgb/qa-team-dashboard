# Backups Folder

This folder contains backup copies of the QA Team Performance Management Tool.

## Current Backups

### QA_Team_Backup_20251212_011600
- **Date:** December 12, 2025 at 01:16:00 AM
- **Contents:** Complete application + data backup
- **Size:** ~270 KB
- **Includes:** All source files, data, documentation, and utility scripts

## How to Create New Backups

### Quick Backup Command
Run this from the main project folder:
```bash
cd "/Users/rakesh/Documents/checkmaterepo/QA Team Performance Management Tool"
BACKUP_DIR="QA_Team_Backup_$(date +%Y%m%d_%H%M%S)" && \
mkdir -p "$BACKUP_DIR" && \
cp app.js index.html styles.css README.md *.md *.js "$BACKUP_DIR/" 2>/dev/null && \
echo "Backup created: $BACKUP_DIR"
```

### Export Data
1. Open the application (index.html)
2. Click "Export" button
3. Save JSON file to the backup folder

## Backup Best Practices

1. **Regular Backups:** Create backups weekly or after major changes
2. **Test Restore:** Verify backups work by testing restore
3. **Multiple Locations:** Keep copies in different locations (local + cloud)
4. **Document Changes:** Note what's new in each backup

## Restore Instructions

### Restore Application Files
1. Copy files from backup folder
2. Replace current files
3. Open index.html in browser

### Restore Data
1. Open application
2. Click "Import" button
3. Select the backup JSON file
4. Confirm import

## Backup Naming Convention

Format: `QA_Team_Backup_YYYYMMDD_HHMMSS`

Example: `QA_Team_Backup_20251212_011600`
- 2025-12-12 (December 12, 2025)
- 01:16:00 (1:16 AM)

## Notes

- Backups are stored within the main project folder
- Each backup is self-contained and independent
- Data is exported separately as JSON files
- Keep at least 3-5 recent backups
- Delete old backups to save space (keep monthly archives)

---

**Last Updated:** December 12, 2025
