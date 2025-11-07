const mongodbService = require('./mongodbService');
const environment = require('../config/environment');
const logger = require('../config/logger');

/**
 * Build MongoDB query based on filters
 */
function buildQuery(filters = {}) {
    const query = {};

    // Date range filter
    if (filters.dateRange && Array.isArray(filters.dateRange) && filters.dateRange.length === 2) {
        const [startDate, endDate] = filters.dateRange;
        query.dateTime = {};
        
        if (startDate) {
            query.dateTime.$gte = new Date(startDate);
        }
        if (endDate) {
            // Set end date to end of day
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.dateTime.$lte = end;
        }
    }

    // Campaign ID filter
    if (filters.campaignId) {
        query._id = typeof filters.campaignId === 'string' 
            ? new mongodbService.ObjectId(filters.campaignId) 
            : filters.campaignId;
    }

    // Campaign name filter
    if (filters.campaignName) {
        query.campaignName = filters.campaignName;
    }

    // Template name filter
    if (filters.templateName) {
        query.templateName = filters.templateName;
    }

    // From phone number filter
    if (filters.fromPhoneNumber) {
        query.fromPhoneNumber = filters.fromPhoneNumber;
    }

    return query;
}

/**
 * Get total messages sent
 */
async function getMessagesSent(projectId, filters = {}) {
    try {
        const campaignsDb = await mongodbService.getDbConnection(environment.mongoCampaignsDbName);
        const projectIdString = projectId.toString();
        const campaignsCollection = campaignsDb.collection(projectIdString);
        
        const query = buildQuery(filters);
        
        const campaigns = await campaignsCollection.find(query).toArray();
        
        const totalMessages = campaigns.reduce((sum, campaign) => {
            return sum + (campaign.total || 0);
        }, 0);

        logger.info('AnalyticsService: Messages sent calculated', { projectId, totalMessages, filters });
        return totalMessages;
    } catch (error) {
        logger.error('AnalyticsService: Error calculating messages sent', { error: error.message, projectId, filters });
        throw error;
    }
}

/**
 * Get total campaigns
 */
async function getCampaignsTotal(projectId, filters = {}) {
    try {
        const campaignsDb = await mongodbService.getDbConnection(environment.mongoCampaignsDbName);
        const projectIdString = projectId.toString();
        const campaignsCollection = campaignsDb.collection(projectIdString);
        
        const query = buildQuery(filters);
        
        const count = await campaignsCollection.countDocuments(query);

        logger.info('AnalyticsService: Campaigns total calculated', { projectId, count, filters });
        return count;
    } catch (error) {
        logger.error('AnalyticsService: Error calculating campaigns total', { error: error.message, projectId, filters });
        throw error;
    }
}

/**
 * Get total replies with optional text filter
 */
async function getReplies(projectId, filters = {}, textFilter = null) {
    try {
        const campaignsDb = await mongodbService.getDbConnection(environment.mongoCampaignsDbName);
        const projectIdString = projectId.toString();
        const campaignsCollection = campaignsDb.collection(projectIdString);
        
        const query = buildQuery(filters);
        
        const campaigns = await campaignsCollection.find(query).toArray();
        
        const uniqueRepliers = new Set();

        campaigns.forEach(campaign => {
            if (campaign.results && Array.isArray(campaign.results)) {
                campaign.results.forEach(result => {
                    // Skip if phoneNumber is null, undefined, or empty string
                    if (!result.phoneNumber || result.phoneNumber === null || result.phoneNumber === '') {
                        return;
                    }
                    
                    // Check if message was answered (status === "answered" OR has answers array)
                    const hasAnswers = result.answers && Array.isArray(result.answers) && result.answers.length > 0;
                    const status = (result.status || '').toLowerCase().trim();
                    const isAnswered = status === 'answered' || hasAnswers;
                    
                    if (isAnswered) {
                        // If text filter is provided, check if any answer matches
                        if (textFilter) {
                            if (hasAnswers) {
                                const filterText = textFilter.toLowerCase().trim();
                                const hasMatchingAnswer = result.answers.some(answer => {
                                    const answerText = (answer.messageText || '').toLowerCase().trim();
                                    // Case-insensitive exact match
                                    return answerText === filterText;
                                });
                                
                                if (hasMatchingAnswer) {
                                    uniqueRepliers.add(String(result.phoneNumber).trim());
                                }
                            }
                        } else {
                            // Count all replies (client who answered)
                            uniqueRepliers.add(String(result.phoneNumber).trim());
                        }
                    }
                });
            }
        });

        const totalReplies = uniqueRepliers.size;

        logger.info('AnalyticsService: Replies calculated', { 
            projectId, 
            totalReplies, 
            textFilter,
            filters 
        });
        return totalReplies;
    } catch (error) {
        logger.error('AnalyticsService: Error calculating replies', { error: error.message, projectId, filters, textFilter });
        throw error;
    }
}

/**
 * Get total views (messages with readDateTime)
 */
async function getViews(projectId, filters = {}) {
    try {
        const campaignsDb = await mongodbService.getDbConnection(environment.mongoCampaignsDbName);
        const projectIdString = projectId.toString();
        const campaignsCollection = campaignsDb.collection(projectIdString);
        
        const query = buildQuery(filters);
        
        const campaigns = await campaignsCollection.find(query).toArray();
        
        const uniqueViewers = new Set();

        campaigns.forEach(campaign => {
            if (campaign.results && Array.isArray(campaign.results)) {
                campaign.results.forEach(result => {
                    // Skip if phoneNumber is null, undefined, or empty string
                    if (!result.phoneNumber || result.phoneNumber === null || result.phoneNumber === '') {
                        return;
                    }
                    
                    // Check if message was read (has readDateTime)
                    if (result.readDateTime) {
                        uniqueViewers.add(String(result.phoneNumber).trim());
                    }
                });
            }
        });

        const totalViews = uniqueViewers.size;

        logger.info('AnalyticsService: Views calculated', { projectId, totalViews, filters });
        return totalViews;
    } catch (error) {
        logger.error('AnalyticsService: Error calculating views', { error: error.message, projectId, filters });
        throw error;
    }
}

/**
 * Get total errors
 */
async function getErrors(projectId, filters = {}) {
    try {
        const campaignsDb = await mongodbService.getDbConnection(environment.mongoCampaignsDbName);
        const projectIdString = projectId.toString();
        const campaignsCollection = campaignsDb.collection(projectIdString);
        
        const query = buildQuery(filters);
        
        const campaigns = await campaignsCollection.find(query).toArray();
        
        // Count errors directly from results for accuracy
        let totalErrors = 0;
        
        campaigns.forEach(campaign => {
            if (campaign.results && Array.isArray(campaign.results)) {
                campaign.results.forEach(result => {
                    // Count messages that failed (success === false OR status === "failed")
                    if (result.success === false || result.status === 'failed') {
                        totalErrors++;
                    }
                });
            }
        });

        logger.info('AnalyticsService: Errors calculated', { 
            projectId, 
            totalErrors, 
            filters 
        });
        return totalErrors;
    } catch (error) {
        logger.error('AnalyticsService: Error calculating errors', { error: error.message, projectId, filters });
        throw error;
    }
}

/**
 * Process a single metric
 */
async function processMetric(projectId, metric, filters = {}) {
    try {
        const { type, filter: metricFilter } = metric;
        let result = 0;
        let key = type;

        switch (type) {
            case 'messagesSent':
                result = await getMessagesSent(projectId, filters);
                break;
            
            case 'campaignsTotal':
                result = await getCampaignsTotal(projectId, filters);
                break;
            
            case 'replies':
                const textFilter = metricFilter?.text || null;
                result = await getReplies(projectId, filters, textFilter);
                // If text filter is provided, append it to the key
                if (textFilter) {
                    key = `replies:${textFilter}`;
                }
                break;
            
            case 'views':
                result = await getViews(projectId, filters);
                break;
            
            case 'errors':
                result = await getErrors(projectId, filters);
                break;
            
            default:
                // Unknown metric type, return null to be filtered out
                logger.warn('AnalyticsService: Unknown metric type', { type });
                return null;
        }

        return { key, value: result };
    } catch (error) {
        logger.error('AnalyticsService: Error processing metric', { 
            error: error.message, 
            metric, 
            projectId 
        });
        // Return null to be filtered out, don't throw to allow other metrics to process
        return null;
    }
}

/**
 * Process multiple metrics in parallel
 */
async function processMetrics(projectId, metrics = [], filters = {}) {
    try {
        if (!projectId) {
            throw new Error('projectId is required');
        }

        if (!Array.isArray(metrics) || metrics.length === 0) {
            return {};
        }

        // Process all metrics in parallel
        const metricPromises = metrics.map(metric => processMetric(projectId, metric, filters));
        const results = await Promise.all(metricPromises);

        // Build result object, filtering out null values (failed/unknown metrics)
        const stats = {};
        results.forEach(result => {
            if (result !== null) {
                stats[result.key] = result.value;
            }
        });

        logger.info('AnalyticsService: Metrics processed', { projectId, metricsCount: metrics.length, stats });
        return stats;
    } catch (error) {
        logger.error('AnalyticsService: Error processing metrics', { error: error.message, projectId, metrics });
        throw error;
    }
}

module.exports = {
    processMetrics,
    getMessagesSent,
    getCampaignsTotal,
    getReplies,
    getViews,
    getErrors
};

