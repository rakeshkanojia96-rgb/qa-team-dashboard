# Quick CSV Format Reference

## 📋 Team Members CSV

```csv
ID,Name,Email,Role,Joining Date
1,John Doe,john@example.com,QA Engineer,2024-01-15
2,Jane Smith,jane@example.com,Senior QA Engineer,2023-06-01
```

**Required**: Name, Email  
**Date Format**: YYYY-MM-DD

---

## 📊 Performance Data CSV

```csv
Team Member,Project Name,Period Type,Date,Test Cases Created,Test Cases Executed,Defects Reported,Asana Tickets
John Doe,DSOT,Daily,2024-12-10,50,45,1,2
John Doe,CMUI,Weekly,2024-12-02 to 2024-12-08,100,90,3,5
Jane Smith,DMB,Monthly,2024-12,260,250,10,15
```

**Required**: Team Member, Period Type, Date  
**Optional**: Project Name, All numeric fields (default to 0)  
**Period Types**: Daily, Weekly, Monthly  
**Date Formats**:
- Daily: YYYY-MM-DD
- Weekly: YYYY-MM-DD to YYYY-MM-DD
- Monthly: YYYY-MM

---

## 📅 Attendance CSV

```csv
ID,Member ID,Member Name,Date,Status,Notes
1,1,John Doe,2024-12-01,present,
2,1,John Doe,2024-12-02,wfh,Working from home
3,2,Jane Smith,2024-12-01,half-day,Medical appointment
```

**Required**: Member ID, Date, Status  
**Date Format**: YYYY-MM-DD  
**Valid Status**: present, absent, half-day, leave, wfh  
**Note**: Member ID must exist in Team Members

---

## 🎯 Quick Tips

1. **Download Templates**: Click "Templates" button in the app
2. **Import Order**: Team Members → Performance → Attendance
3. **Excel Support**: Save as CSV or use .xlsx/.xls directly
4. **UTF-8 Encoding**: For special characters
5. **Member IDs**: Must match across all files

---

## ⚠️ Common Mistakes

❌ Wrong date format (12/01/2024) → ✅ Use YYYY-MM-DD (2024-12-01)  
❌ Wrong month format (Nov 2024) → ✅ Use YYYY-MM (2024-11)  
❌ Wrong status (Present) → ✅ Use lowercase (present)  
❌ Missing Member ID → ✅ Import team members first  
❌ Column name typo → ✅ Match exactly (case-sensitive)

---

**Full Documentation**: See [CSV_EXCEL_FORMAT_GUIDE.md](CSV_EXCEL_FORMAT_GUIDE.md)
