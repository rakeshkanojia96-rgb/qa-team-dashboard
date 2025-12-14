#!/bin/bash

# QA Team Performance Management Tool - Backup Script
# Creates a timestamped backup of all application files

echo "🔄 Creating backup..."

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create backup folder with timestamp
BACKUP_DIR="QA_Team_Backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Copy all application files
echo "📦 Copying application files..."
cp app.js "$BACKUP_DIR/"
cp index.html "$BACKUP_DIR/"
cp styles.css "$BACKUP_DIR/"
cp README.md "$BACKUP_DIR/"
cp CSV_EXCEL_FORMAT_GUIDE.md "$BACKUP_DIR/" 2>/dev/null
cp QUICK_CSV_REFERENCE.md "$BACKUP_DIR/" 2>/dev/null
cp bulk-attendance-november.js "$BACKUP_DIR/" 2>/dev/null
cp cleanup-november-weekends.js "$BACKUP_DIR/" 2>/dev/null

# Create backup info file
echo "📝 Creating backup info..."
cat > "$BACKUP_DIR/BACKUP_INFO.md" << EOF
# QA Team Performance Management Tool - Backup

**Backup Date:** $(date "+%B %d, %Y at %I:%M:%S %p")  
**Backup Location:** \`$SCRIPT_DIR/$BACKUP_DIR/\`

## Contents

- app.js - Main application logic
- index.html - UI structure
- styles.css - Styling
- README.md - Documentation
- CSV_EXCEL_FORMAT_GUIDE.md - Import guide
- QUICK_CSV_REFERENCE.md - Quick reference
- Utility scripts

## Restore Instructions

1. Copy files from this backup folder
2. Replace current files in main folder
3. Open index.html in browser

## Data Restore

To restore your data:
1. Open the application
2. Click "Export" to save current data (optional)
3. Click "Import" to load backed up data
4. Select your data JSON file

---

**Backup created by:** create-backup.sh script  
**Status:** ✅ Complete
EOF

# Count files
FILE_COUNT=$(ls -1 "$BACKUP_DIR" | wc -l | xargs)

echo ""
echo "✅ Backup created successfully!"
echo "📁 Location: $BACKUP_DIR"
echo "📊 Files backed up: $FILE_COUNT"
echo ""
echo "💡 Tip: Export your data from the application and save it to this backup folder"
echo ""
