// Phase 10: Data Integrity & Consistency Checker
// Validates referential integrity and repairs orphaned data

class DataConsistencyChecker {
  constructor() {
    this.issues = [];
  }

  /**
   * Check referential integrity
   */
  async checkReferentialIntegrity(models) {
    console.log('🔍 Checking referential integrity...');

    for (const [modelName, model] of Object.entries(models)) {
      const docs = await model.find().lean();
      
      for (const doc of docs) {
        // Check each field that references another model
        for (const [field, ref] of Object.entries(model.schema.paths)) {
          if (!ref.instance) continue; // Skip non-model fields

          // Skip if field is null
          if (!doc[field]) continue;

          // Check if referenced document exists
          const refModel = models[ref.instance];
          if (!refModel) continue;

          const exists = await refModel.findById(doc[field]).lean();
          if (!exists) {
            this.issues.push({
              type: 'ORPHANED_REFERENCE',
              model: modelName,
              documentId: doc._id,
              field,
              referencedId: doc[field],
              severity: 'warning'
            });
          }
        }
      }
    }

    return this.issues;
  }

  /**
   * Repair orphaned references
   */
  async repairOrphaned(model, field) {
    console.log(`🔧 Repairing orphaned references in ${model}.${field}`);

    const repaired = await model.updateMany(
      { [field]: null },
      { $unset: { [field]: 1 } }
    );

    console.log(`✅ Repaired ${repaired.modifiedCount} documents`);
    return repaired.modifiedCount;
  }

  /**
   * Validate data types
   */
  async validateDataTypes(model, schema) {
    const violations = [];
    const docs = await model.find().lean();

    for (const doc of docs) {
      for (const [field, rules] of Object.entries(schema)) {
        const value = doc[field];
        if (!value) continue;

        const expectedType = rules.type;
        const actualType = typeof value;

        if (actualType !== expectedType) {
          violations.push({
            documentId: doc._id,
            field,
            expectedType,
            actualType,
            value
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check for duplicate records
   */
  async findDuplicates(model, fields = []) {
    const duplicates = [];

    const grouped = await model.aggregate([
      { $group: {
          _id: fields.length ? fields.map(f => `$${f}`).reduce((a, b) => `${a}${b}`) : '$_id',
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);

    return grouped;
  }

  /**
   * Get consistency report
   */
  getReport() {
    return {
      timestamp: new Date().toISOString(),
      issuesFound: this.issues.length,
      issues: this.issues,
      summary: {
        orphaned: this.issues.filter(i => i.type === 'ORPHANED_REFERENCE').length,
        dataTypeViolations: this.issues.filter(i => i.type === 'TYPE_MISMATCH').length
      }
    };
  }

  /**
   * Clear issues
   */
  reset() {
    this.issues = [];
  }
}

module.exports = { DataConsistencyChecker };
