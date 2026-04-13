/**
 * Cloud Provider Registry & Factory
 * Central place to register and switch between cloud providers
 * Add new providers by:
 * 1. Creating new file implementing CloudProvider interface
 * 2. Adding provider to PROVIDERS map below
 * 3. That's it! No other changes needed.
 */

const CloudProvider = require('./CloudProvider');
const BackblazeB2Provider = require('./BackblazeB2Provider');

const PROVIDERS = {
  'backblaze-b2': {
    name: 'Backblaze B2',
    class: BackblazeB2Provider,
    configFields: [
      'applicationKeyId',
      'applicationKey',
      'bucketName'
    ],
    docUrl: 'https://www.backblaze.com/b2/cloud-storage/',
    description: 'Backblaze B2 Cloud Storage'
  },
  // Example of how to add future providers:
  // 'aws-s3': {
  //   name: 'Amazon S3',
  //   class: AmazonS3Provider,
  //   configFields: ['accessKeyId', 'secretAccessKey', 'bucket', 'region'],
  //   docUrl: 'https://aws.amazon.com/s3/',
  //   description: 'Amazon S3 Cloud Storage'
  // },
  // 'google-gcs': {
  //   name: 'Google Cloud Storage',
  //   class: GoogleGCSProvider,
  //   configFields: ['projectId', 'keyFilePath', 'bucket'],
  //   docUrl: 'https://cloud.google.com/storage/',
  //   description: 'Google Cloud Storage'
  // },
  // 'azure-blob': {
  //   name: 'Azure Blob Storage',
  //   class: AzureBlobProvider,
  //   configFields: ['accountName', 'accountKey', 'containerName'],
  //   docUrl: 'https://azure.microsoft.com/en-us/services/storage/blobs/',
  //   description: 'Microsoft Azure Blob Storage'
  // }
};

/**
 * Get all available providers
 */
function getAvailableProviders() {
  return Object.keys(PROVIDERS).map(key => ({
    id: key,
    ...PROVIDERS[key]
  }));
}

/**
 * Get provider metadata
 */
function getProviderMetadata(providerId) {
  return PROVIDERS[providerId] || null;
}

/**
 * Factory function to create provider instance
 */
function createProvider(providerId, config) {
  const metadata = PROVIDERS[providerId];
  
  if (!metadata) {
    throw new Error(`Unknown cloud provider: ${providerId}`);
  }

  return new metadata.class(config);
}

/**
 * List configured required fields for a provider
 */
function getRequiredFields(providerId) {
  const metadata = PROVIDERS[providerId];
  if (!metadata) return [];
  return metadata.configFields || [];
}

/**
 * Validate configuration for provider
 */
function validateConfig(providerId, config) {
  const requiredFields = getRequiredFields(providerId);
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      missingFields,
      error: `Missing required fields: ${missingFields.join(', ')}`
    };
  }

  return { valid: true };
}

module.exports = {
  PROVIDERS,
  getAvailableProviders,
  getProviderMetadata,
  createProvider,
  getRequiredFields,
  validateConfig,
  CloudProvider
};
