const axios = require('axios');
const environment = require('../config/environment');
const logger = require('../config/logger');
const mongodbService = require('../services/mongodbService');

const META_API_VERSION = environment.metaApiVersion;

async function sendTemplateMessages({ wabaId, apiToken, template_name, phone_numbers, variablesList, phoneId, languageCode, fromPhoneNumber, projectId, campaignName }) {
    try {
        const finalWabaId = wabaId;
        const finalApiToken = apiToken;
        const finalPhoneId = phoneId;
        const campaignDateTime = new Date();
        const campaignId = new mongodbService.ObjectId();
        const lang = languageCode;

        const sendPromises = phone_numbers.map(async (phoneNumber, idx) => {
            try {
                const messageData = {
                    messaging_product: 'whatsapp',
                    to: phoneNumber,
                    type: 'template',
                    template: {
                        name: template_name,
                        language: {
                            code: lang
                        }
                    }
                };

                const variables = variablesList && variablesList[idx] ? variablesList[idx] : {};
                if (variables && Object.keys(variables).length > 0) {
                    messageData.template.components = [{
                        type: 'body',
                        parameters: Object.keys(variables).map(key => ({
                            type: 'text',
                            text: variables[key]
                        }))
                    }];
                }

                const response = await axios.post(
                    `https://graph.facebook.com/${META_API_VERSION}/${finalPhoneId}/messages`,
                    messageData,
                    {
                        headers: {
                            Authorization: `Bearer ${finalApiToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                logger.info('MessageService: Template message sent successfully', {
                    _id: campaignId,
                    wabaId: finalWabaId,
                    fromPhoneNumber,
                    projectId,
                    templateName: template_name,
                    phoneNumber: phoneNumber,
                    messageId: response.data.messages?.[0]?.id
                });

                return {
                    phoneNumber: phoneNumber,
                    messageId: response.data.messages?.[0]?.id,
                    status: 'sent',
                    success: true
                };

            } catch (error) {
                logger.error('MessageService: Error sending template message to phone number', {
                    _id: campaignId,
                    wabaId: finalWabaId,
                    fromPhoneNumber,
                    projectId,
                    templateName: template_name,
                    phoneNumber: phoneNumber,
                    error: error.response?.data || error.message
                });

                return {
                    phoneNumber: phoneNumber,
                    status: 'failed',
                    success: false,
                    error: error.response?.data.error || error.message
                };
            }
        });

        const results = await Promise.all(sendPromises);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        logger.info('MessageService: Template messages batch completed', {
            _id: campaignId,
            campaignName: campaignName || 'N/A',
            wabaId: finalWabaId,
            fromPhoneNumber,
            projectId,
            templateName: template_name,
            total: phone_numbers.length,
            success: successCount,
            failed: failureCount
        });

        const campaignData = {
            _id: campaignId,
            campaignName: campaignName || 'N/A',
            templateName: template_name,
            language: lang,
            fromPhoneNumber,
            dateTime: campaignDateTime,
            total: phone_numbers.length,
            success: successCount,
            failed: failureCount,
            results
        };

        await saveCampaign(campaignData, projectId);

        return campaignData;

    } catch (error) {
        logger.error('MessageService: Error in sendTemplateMessages', {
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function saveCampaign(campaignData, projectId) {
    try {

        const campaignsDb = await mongodbService.getDbConnection(environment.mongoCampaignsDbName);

        const projectIdString = projectId.toString();
        const exists = await campaignsDb
            .listCollections({ name: projectIdString }, { nameOnly: true })
            .hasNext();

        if (!exists) {
            await campaignsDb.createCollection(projectIdString, {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['campaignName', 'fromPhoneNumber', 'templateName', 'language', 'dateTime', 'success', 'failed', 'total', 'results'],
                        properties: {
                            campaignName: { bsonType: 'string' },
                            fromPhoneNumber: { bsonType: 'string' },
                            templateName: { bsonType: 'string' },
                            language: { bsonType: 'string' },
                            dateTime: { bsonType: 'date' },
                            success: { bsonType: 'int' },
                            failed: { bsonType: 'int' },
                            total: { bsonType: 'int' },
                            results: { bsonType: 'array' }
                        }
                    }
                }
            });
        }

        const campaignsCollection = campaignsDb.collection(projectIdString);
        await campaignsCollection.insertOne(campaignData);

    } catch (error) {
        logger.error('MessageService: Error in saveCampaign', { error: error.response?.data || error.message });
    }
}

async function getCampaigns({ projectId, id, name }) {
    try {
        if (!projectId) {
            throw new Error('projectId is required');
        }
        const campaignsDb = await mongodbService.getDbConnection(environment.mongoCampaignsDbName);
        const projectIdString = projectId.toString();
        const campaignsCollection = campaignsDb.collection(projectIdString);
        const query = {};
        if (id) {
            query._id = typeof id === 'string' ? new mongodbService.ObjectId(id) : id;
        }
        if (name) {
            query.campaignName = name;
        }
        const campaigns = await campaignsCollection.find(query).toArray();
        logger.info('MessageService: Campaigns fetched', { projectId, id, name, count: campaigns.length });
        return campaigns;
    } catch (error) {
        logger.error('MessageService: Error fetching campaigns', { error: error.response?.data || error.message });
        throw error;
    }
}

module.exports = {
    sendTemplateMessages,
    getCampaigns
}