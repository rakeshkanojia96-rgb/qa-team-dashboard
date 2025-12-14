# CSV/Excel Import Format Guide

This guide explains the exact format required for importing data via CSV or Excel files.

## 📥 How to Import

1. Click the **"Import"** button in the header
2. Select the type of data you want to import:
   - Team Members CSV
   - Performance CSV
   - Attendance CSV
3. Choose your CSV or Excel file (.csv, .xlsx, .xls)
4. Data will be imported automatically

## 📤 Download Templates

Click the **"Templates"** button in the header to download pre-formatted CSV templates for all three data types.

---

## 1️⃣ Team Members CSV Format

### Required Columns

| Column Name   | Type   | Required | Description                          | Example                    |
|---------------|--------|----------|--------------------------------------|----------------------------|
| ID            | Text   | No*      | Unique identifier (auto-generated)   | 1765392215829              |
| Name          | Text   | **Yes**  | Full name of team member             | Jaseem Sheikh              |
| Email         | Text   | **Yes**  | Email address (must be unique)       | jaseem@itsacheckmate.com   |
| Role          | Text   | No       | Job role/designation                 | Senior QA Engineer         |
| Joining Date  | Date   | No       | Date in YYYY-MM-DD format            | 2022-04-01                 |

*ID is optional - system will auto-generate if not provided

### Valid Role Values
- QA Engineer
- Senior QA Engineer
- QA Automation Engineer
- QA Analyst

### Example CSV

```csv
ID,Name,Email,Role,Joining Date
1,John Doe,john@example.com,QA Engineer,2024-01-15
2,Jane Smith,jane@example.com,Senior QA Engineer,2023-06-01
3,Bob Wilson,bob@example.com,QA Automation Engineer,2024-03-20
4,Alice Brown,alice@example.com,QA Analyst,2023-11-10
```

---

## 2️⃣ Performance Data CSV Format

### Required Columns

| Column Name          | Type    | Required | Description                              | Example           |
|----------------------|---------|----------|------------------------------------------|-------------------|
| Team Member          | Text    | **Yes**  | Name of team member                      | John Doe          |
| Project Name         | Text    | No       | Project name                             | DSOT, DMB, CMUI   |
| Period Type          | Text    | **Yes**  | Type of period (Daily/Weekly/Monthly)    | Daily             |
| Date                 | Date    | **Yes**  | Date, date range, or month               | 2024-12-10        |
| Test Cases Created   | Number  | No       | Number of test cases created             | 50                |
| Test Cases Executed  | Number  | No       | Number of test cases executed            | 45                |
| Defects Reported     | Number  | No       | Total defects/bugs reported              | 1                 |
| Asana Tickets        | Number  | No       | Number of Asana tickets                  | 2                 |

**All numeric fields are optional and default to 0 if not provided

### Example CSV

```csv
Team Member,Project Name,Period Type,Date,Test Cases Created,Test Cases Executed,Defects Reported,Asana Tickets
John Doe,DSOT,Daily,2024-12-10,50,45,1,2
John Doe,CMUI,Weekly,2024-12-02 to 2024-12-08,100,90,3,5
Jane Smith,DMB,Monthly,2024-12,260,250,10,15
Jane Smith,DSOT,Daily,2024-12-11,30,28,2,1
```

### Important Notes
- **Team Member name must match** an existing team member's name exactly
- **Period Type** must be one of: Daily, Weekly, or Monthly (case-insensitive)
- **Date format varies by Period Type:**
  - Daily: YYYY-MM-DD (e.g., 2024-12-10)
  - Weekly: YYYY-MM-DD to YYYY-MM-DD (e.g., 2024-12-02 to 2024-12-08)
  - Monthly: YYYY-MM (e.g., 2024-12)
- Project Name can be any text (e.g., DSOT, DMB, CMUI, DO, etc.)
- Numeric fields default to 0 if left empty
- You can have multiple rows for the same member with different projects/dates

---

## 3️⃣ Attendance CSV Format

### Required Columns

| Column Name   | Type   | Required | Description                              | Example                    |
|---------------|--------|----------|------------------------------------------|----------------------------|
| ID            | Text   | No*      | Unique identifier (auto-generated)       | 1765392400123              |
| Member ID     | Text   | **Yes**  | ID of team member (from Team Members)    | 1765392215829              |
| Member Name   | Text   | No       | Name for reference only                  | Jaseem Sheikh              |
| Date          | Date   | **Yes**  | Date in YYYY-MM-DD format                | 2024-12-10                 |
| Status        | Text   | **Yes**  | Attendance status                        | present                    |
| Notes         | Text   | No       | Optional notes/comments                  | Working from home          |

*ID is optional - system will auto-generate if not provided

### Valid Status Values
- **present** - Employee was present in office
- **absent** - Employee was absent
- **half-day** - Employee worked half day
- **leave** - Employee on approved leave
- **wfh** - Work from home

### Example CSV

```csv
ID,Member ID,Member Name,Date,Status,Notes
1,1,John Doe,2024-12-01,present,
2,1,John Doe,2024-12-02,wfh,Working from home
3,1,John Doe,2024-12-03,present,
4,2,Jane Smith,2024-12-01,present,
5,2,Jane Smith,2024-12-02,half-day,Medical appointment
6,2,Jane Smith,2024-12-03,leave,Sick leave
```

### Important Notes
- **Member ID must match** an existing team member's ID
- Date format must be YYYY-MM-DD (e.g., 2024-12-10)
- Status must be one of the valid values (case-sensitive, lowercase)
- Notes field is optional and can be left empty

---

## 📊 Excel Format

Excel files (.xlsx, .xls) follow the **exact same format** as CSV files:

1. First row must contain column headers (exactly as shown above)
2. Data starts from row 2
3. Use the first sheet of the workbook (other sheets will be ignored)
4. Column order doesn't matter as long as headers match

### Excel Tips
- Use **Date format** for date columns (Excel will auto-format)
- Use **Number format** for numeric columns
- Use **Text format** for ID and text columns
- Avoid formulas - use plain values only

---

## 🔄 Import Behavior

### Team Members
- **Duplicate Check**: System checks email addresses
- **If email exists**: Member is skipped (not imported)
- **If email is new**: Member is added
- **Result**: Shows count of successfully imported members

### Performance Data
- **No duplicate check**: All records are added
- **Validation**: Checks if Member ID exists
- **Result**: Shows count of successfully imported records

### Attendance Data
- **No duplicate check**: All records are added
- **Validation**: Checks if Member ID exists
- **Result**: Shows count of successfully imported records

---

## ⚠️ Common Errors and Solutions

### Error: "Member ID not found"
**Solution**: Import team members first before importing performance or attendance data

### Error: "Invalid date format"
**Solution**: Use YYYY-MM-DD format for dates (e.g., 2024-12-10)

### Error: "Invalid month format"
**Solution**: Use YYYY-MM format for months (e.g., 2024-11)

### Error: "Invalid status value"
**Solution**: Use only valid status values: present, absent, half-day, leave, wfh (lowercase)

### Error: "Missing required columns"
**Solution**: Ensure all required columns are present with exact header names

### Error: "Parsing failed"
**Solution**: 
- Check for special characters in CSV
- Ensure proper comma separation
- Use quotes for text containing commas
- Save Excel file as CSV UTF-8 format

---

## 💡 Best Practices

1. **Start with Templates**: Download templates using the "Templates" button
2. **Import Order**: Import team members first, then performance and attendance
3. **Test with Small Data**: Test with 2-3 rows before bulk import
4. **Backup First**: Export existing data before importing new data
5. **Use Consistent IDs**: Keep Member IDs consistent across all files
6. **Date Formats**: Always use ISO format (YYYY-MM-DD)
7. **UTF-8 Encoding**: Save CSV files with UTF-8 encoding for special characters

---

## 📝 Quick Reference

### File Types Supported
- ✅ CSV (.csv)
- ✅ Excel 2007+ (.xlsx)
- ✅ Excel 97-2003 (.xls)

### Maximum File Size
- No hard limit (browser-dependent)
- Recommended: Under 5MB for best performance

### Character Encoding
- UTF-8 (recommended)
- ASCII (supported)

---

## 🆘 Need Help?

1. Click **"Templates"** button to download sample files
2. Use the sample data as a reference
3. Ensure column headers match exactly (case-sensitive)
4. Check that Member IDs exist before importing related data

---

**Last Updated**: December 2025  
**Version**: 1.0
