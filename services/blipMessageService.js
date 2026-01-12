const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');

const BLIP_MESSAGES_URL = 'https://http.msging.net/messages';

/**
 * Send a message to Blip
 * @param {Object} params - Message parameters
 * @param {string} params.contactIdentity - Contact identity (e.g., "5531996371744.whatsapp@0mn.io")
 * @param {string} params.authorization - Authorization token (format: "Key {token}" or just the token)
 * @param {string} params.content - Message content
 * @returns {Promise<Object>} Response from Blip API
 */
async function sendMessage({ id, contactIdentity, authorization, content }) {
    try {
        // Generate UUID for message ID
        const messageId = crypto.randomUUID();

        // Ensure authorization header format is correct
        const authHeader = authorization.startsWith('Key ') ? authorization : `Key ${authorization}`;

        const messageData = {
            id: id || messageId,
            to: contactIdentity,
            type: 'text/plain',
            content: content
        };

        logger.info('BlipMessageService: Sending message to Blip', {
            messageId,
            contactIdentity
        });

        const response = await axios.post(BLIP_MESSAGES_URL, messageData, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        logger.info('BlipMessageService: Message sent successfully', {
            messageId,
            contactIdentity,
            status: response.status
        });

        return response.data;

    } catch (error) {
        logger.error('BlipMessageService: Error sending message to Blip', {
            contactIdentity,
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    sendMessage
};
