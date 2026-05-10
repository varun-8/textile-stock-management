const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Use the actual runtime config path from AppData
const configPath = path.join(process.env.APPDATA || require('os').homedir(), 'desktop', 'backend-data', 'config.json');

async function restoreLogos() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management');
    
    const db = mongoose.connection.db;
    console.log('✅ Connected\n');
    
    // Get DC with logos
    const dcs = await db.collection('deliverychallans').find({}).toArray();
    if (dcs.length === 0) {
      console.log('❌ No DCs found');
      mongoose.connection.close();
      return;
    }
    
    const dc = dcs[0];
    const templateSnapshot = dc.templateSnapshot;
    
    console.log('📋 Template data found in DC:');
    console.log('  Company:', templateSnapshot.companyName);
    console.log('  GSTIN:', templateSnapshot.gstin);
    console.log('  Phone:', templateSnapshot.phoneText);
    console.log('  Logo1 size:', templateSnapshot.logoDataUrl ? templateSnapshot.logoDataUrl.length : 0, 'bytes');
    console.log('  Logo2 size:', templateSnapshot.logoDataUrl2 ? templateSnapshot.logoDataUrl2.length : 0, 'bytes\n');
    
    // Read config
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    // Update dcTemplate with complete data
    config.dcTemplates = config.dcTemplates || [];
    config.activeDcTemplateId = 'tpl-default';
    
    const updatedTemplate = {
      layoutMode: templateSnapshot.layoutMode || 'printed',
      companyName: templateSnapshot.companyName || 'SREE LAKSHM',
      subTitle: templateSnapshot.subTitle || '',
      documentTitle: templateSnapshot.documentTitle || 'DELIVERY NOTE',
      gstin: templateSnapshot.gstin || '',
      address: templateSnapshot.address || '',
      phoneText: templateSnapshot.phoneText || '',
      tableHeaderColor: templateSnapshot.tableHeaderColor || '#1a5c1a',
      showPartyAddress: templateSnapshot.showPartyAddress !== false,
      showQuality: templateSnapshot.showQuality !== false,
      showFolding: templateSnapshot.showFolding !== false,
      showLotNo: templateSnapshot.showLotNo !== false,
      showBillNo: templateSnapshot.showBillNo !== false,
      showBillPreparedBy: templateSnapshot.showBillPreparedBy !== false,
      showVehicle: templateSnapshot.showVehicle !== false,
      showDriver: templateSnapshot.showDriver !== false,
      logoDataUrl: templateSnapshot.logoDataUrl || '',
      logoDataUrl2: templateSnapshot.logoDataUrl2 || '',
      companyNameSize: templateSnapshot.companyNameSize || 16,
      subTitleSize: templateSnapshot.subTitleSize || 8,
      addressSize: templateSnapshot.addressSize || 7.5
    };
    
    // Update or create default template
    const existingIndex = config.dcTemplates.findIndex(t => t.id === 'tpl-default');
    if (existingIndex >= 0) {
      config.dcTemplates[existingIndex].config = updatedTemplate;
    } else {
      config.dcTemplates.push({
        id: 'tpl-default',
        name: 'Default Template',
        config: updatedTemplate
      });
    }
    
    config.dcTemplate = updatedTemplate;
    
    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('📝 Config file updated with:');
    console.log('  ✅ Company: ' + updatedTemplate.companyName);
    console.log('  ✅ GSTIN: ' + updatedTemplate.gstin);
    console.log('  ✅ Phone: ' + updatedTemplate.phoneText);
    console.log('  ✅ Address: ' + (updatedTemplate.address.substring(0, 50) + '...'));
    console.log('  ✅ Logo 1: ' + (updatedTemplate.logoDataUrl ? updatedTemplate.logoDataUrl.length + ' bytes' : 'Not found'));
    console.log('  ✅ Logo 2: ' + (updatedTemplate.logoDataUrl2 ? updatedTemplate.logoDataUrl2.length + ' bytes' : 'Not found'));
    
    console.log('\n✨ DC template logos restored successfully!');
    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

restoreLogos();
