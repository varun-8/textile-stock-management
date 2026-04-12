// Services exports - Business logic layer
module.exports = {
  // Job processing
  JobQueue: require('./jobs/jobQueue').JobQueue,
  AsyncReportGenerator: require('./jobs/reportGenerator').AsyncReportGenerator,
  
  // Backup & Recovery
  BackupManager: require('./backup/backupManager').BackupManager,
  DataConsistencyChecker: require('./backup/dataIntegrity').DataConsistencyChecker
};
