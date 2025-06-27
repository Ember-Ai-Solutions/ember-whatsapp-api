const axios = require('axios');
const environment = require('../config/environment');
const logger = require('../config/logger');

const META_API_VERSION = environment.metaApiVersion;

async function sendTemplateMessages({ wabaId, apiToken, template_name, phone_numbers, variablesList, phoneId, language }) {
    try {
        const finalWabaId = wabaId;
        const finalApiToken = apiToken;
        const finalPhoneId = phoneId;
        const lang = language || 'pt_BR';

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
                    wabaId: finalWabaId,
                    template_name,
                    phone_number: phoneNumber,
                    message_id: response.data.messages?.[0]?.id
                });

                return {
                    phone_number: phoneNumber,
                    message_id: response.data.messages?.[0]?.id,
                    status: 'sent',
                    success: true
                };

            } catch (error) {
                logger.error('MessageService: Error sending template message to phone number', {
                    wabaId: finalWabaId,
                    template_name,
                    phone_number: phoneNumber,
                    error: error.response?.data || error.message
                });

                return {
                    phone_number: phoneNumber,
                    message_id: null,
                    status: 'failed',
                    success: false,
                    error: error.response?.data || error.message
                };
            }
        });

        const results = await Promise.all(sendPromises);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        logger.info('MessageService: Template messages batch completed', {
            wabaId: finalWabaId,
            template_name,
            total: phone_numbers.length,
            success: successCount,
            failed: failureCount
        });

        return {
            success: true,
            message: `Template messages sent. Success: ${successCount}, Failed: ${failureCount}`,
            results
        };

    } catch (error) {
        logger.error('MessageService: Error in sendTemplateMessages', {
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    sendTemplateMessages
}