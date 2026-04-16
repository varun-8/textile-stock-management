# AMC (Annual Maintenance Contract) - Implementation Guide

## 📋 Overview
One-time license fee with optional annual maintenance service for local textile warehouse customers.

---

## 💰 Pricing Strategy

### One-Time License
- **₹100,000 - 150,000** per customer
- Includes: Desktop + Mobile + PWA apps, real-time tracking, barcode scanning, multi-company support

### Annual AMC (Optional)
- **Basic:** ₹5,000/year (1-2 warehouses, email support)
- **Plus:** ₹10,000/year (2-5 warehouses, phone support, 2 on-site visits)
- **Premium:** ₹15,000/year (large warehouse, unlimited support, priority visits)

---

## ✅ What's Included in AMC

### Support Services
- ✅ Phone/WhatsApp support for quick help
- ✅ On-site support (visit if system breaks)
- ✅ Bug fixes within 24-48 hours
- ✅ Free software updates (minor and major)
- ✅ Annual training sessions (1-2 times)
- ✅ Data backup assistance and recovery
- ✅ Scanner replacement if broken
- ✅ System re-installation if crashes

### NOT Included (Extra Charges)
- ❌ Hardware replacement beyond scanner
- ❌ Custom feature development
- ❌ Multi-location setup
- ❌ Data migration services

---

## ⏰ What Expires

| Item | Duration | After Expiry |
|------|----------|--------------|
| Support access | 1 year | No free support (paid support available) |
| Software updates | 1 year | No free updates (existing version still works) |
| Hardware warranty | 1 year | Hardware issues = paid repair |
| Backup service | 1 year | Manual backups only |
| Training entitlement | 1 year | Paid training if needed |
| **License key** | **Never** | ❌ One-time license never expires |

---

## 🔄 Renewal Process

### 30 Days Before Expiry
- Send reminder email/SMS to customer
- Show warning on dashboard
- Offer renewal discount (10-15%)

### On Expiry Date
- Show soft block: "AMC Expired - Limited Support"
- System still works but no premium features
- Renewal button prominently displayed
- Auto-email invoice

### After Expiry
- Customer can renew online or via WhatsApp
- Generate invoice automatically
- Update AMC dates in system

---

## 📋 Monthly Maintenance Tasks

| Task | Time | Frequency |
|------|------|-----------|
| Database backup verification | 30 min | Monthly |
| Performance check (response times) | 20 min | Monthly |
| User activity log review | 15 min | Monthly |
| Old data cleanup | 15 min | Monthly |

---

## 🔍 Quarterly Maintenance (Every 3 Months)

1. **Software Updates** - Install patches and security fixes
2. **Database Optimization** - Rebuild indexes, clean logs
3. **Security Audit** - Check for unauthorized access
4. **Scanner Testing** - Verify all scanners working properly

---

## 🎯 Annual Maintenance (Once a Year)

1. **Full System Audit** - Complete system health check (generate report)
2. **Performance Report** - Analytics showing usage patterns
3. **Data Validation** - Check for corrupt data, repair if needed
4. **Feature Training** - Train customer on new/underused features
5. **On-Site Visit** - Physical inspection, hardware check, urgent fixes

---

## 🚨 As-Needed Support

- Bug fixes: Within 24-48 hours
- Crash recovery: Restart system, restore data
- Hardware issues: Replace scanner, fix connections
- Data loss: Restore from backup
- Custom reports: Generate on demand

---

## 📊 Maintenance Log Template

```
Customer: _______________________
Company: _______________________
Contact: _______________________
Date of Visit/Check: _____________
Next Scheduled Visit: ____________

SYSTEM CHECKS:
[ ] System uptime: ___% (target >99%)
[ ] Database backup verified
[ ] All scanners responding correctly
[ ] User access logs checked
[ ] No critical errors in system
[ ] Software up to date
[ ] Inventory data integrity verified
[ ] Reports generating correctly
[ ] Mobile app connecting properly
[ ] Internet connectivity stable

ISSUES FOUND & RESOLUTION:
1. Issue: ________________ | Status: ☐ Fixed ☐ Pending
2. Issue: ________________ | Status: ☐ Fixed ☐ Pending
3. Issue: ________________ | Status: ☐ Fixed ☐ Pending

CUSTOMER FEEDBACK:
_________________________________

RECOMMENDATIONS:
_________________________________

TECHNICIAN NAME: _________________
SIGNATURE: ______________________
```

---

## 🛠️ System Features to Implement

### Phase 1: Core AMC Management
- [ ] Add AMC fields to User/Customer model (start date, expiry, tier, price)
- [ ] AMC dashboard widget showing status
- [ ] Expiry countdown (30, 14, 7, 1 days)
- [ ] Renewal form and invoice generation
- [ ] Email reminders (30, 14, 7, 1 days before)

### Phase 2: Support Tracking
- [ ] Support ticket system
- [ ] Issue tracking (created, resolved dates)
- [ ] Maintenance log storage
- [ ] Customer communication history

### Phase 3: Automation
- [ ] Soft block when expired (warn but allow use)
- [ ] Auto-email reminders
- [ ] Maintenance schedule alerts
- [ ] Performance monitoring dashboard
- [ ] Backup status verification

### Phase 4: Reporting
- [ ] AMC revenue report
- [ ] Renewal rate tracking
- [ ] Maintenance cost analysis
- [ ] Customer support metrics

---

## 💡 Sample Yearly Maintenance Schedule

```
MONTH 1: System check + software update
MONTH 2: No scheduled maintenance (support on-demand)
MONTH 3: Database optimization + quarterly review
MONTH 4: System check
MONTH 5: Scanner testing + pairing verification
MONTH 6: Database maintenance + backup verification
MONTHS 7-11: Regular monthly checks as needed
MONTH 12: Full annual audit + on-site visit + training session
```

---

## 📞 Support Workflow

1. Customer reports issue via phone/WhatsApp/email
2. Log in support system
3. **Response:** Within 4 hours for urgent issues, 24h for normal
4. Remote troubleshooting first
5. If needed: Schedule on-site visit
6. Document in maintenance log
7. Close ticket with resolution

---

## 🚀 Implementation Priority

**Phase 1 (Essential):** Core AMC tracking, expiry management, renewals  
**Phase 2 (Important):** Support ticketing, maintenance logs  
**Phase 3 (Nice-to-have):** Automation, reporting, analytics  

---

## 📌 Notes for Future

- Consider discounts for multi-year renewals
- Special pricing for loyal customers
- Bundle multiple warehouses at discount
- Track renewal rate to optimize pricing
- Gather feedback from maintenance visits to improve product
