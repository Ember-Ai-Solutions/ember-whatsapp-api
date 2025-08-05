const axios = require('axios');
const path = require('path');
const logger = require('../config/logger');
const environment = require('../config/environment');

const META_API_VERSION = environment.metaApiVersion;

async function uploadMediaFromUrl({ appId, accessToken, fileUrl }) {
    try {
        logger.info('MetaService: Starting media upload from URL', {
            appId,
            fileUrl
        });

        const fileInfo = await getFileInfoFromUrl(fileUrl);
        const fileName = fileInfo.fileName;
        const fileType = fileInfo.fileType;
        const fileLength = fileInfo.fileLength;

        logger.info('MetaService: File info extracted from URL', {
            appId,
            fileName,
            fileLength,
            fileType
        });

        const uploadSession = await startUploadSession({
            appId,
            accessToken,
            fileName,
            fileLength,
            fileType
        });

        const fileHandle = await uploadFileFromUrl({
            uploadSessionId: uploadSession.id,
            accessToken,
            fileUrl
        });

        logger.info('MetaService: Media upload completed successfully', {
            appId,
            fileName,
            fileHandle: fileHandle.h
        });

        return fileHandle;

    } catch (error) {
        logger.error('MetaService: Error uploading media from URL', {
            appId,
            fileUrl,
            error: error.response?.data || error.message
        });
        throw error;
    }
}

async function getFileInfoFromUrl(fileUrl) {
    try {
        const response = await axios.head(fileUrl);
        const contentLength = response.headers['content-length'];
        const contentType = response.headers['content-type'];
        
        if (!contentLength) {
            throw new Error('Could not determine file size from URL');
        }

        const urlPath = new URL(fileUrl).pathname;
        const fileName = path.basename(urlPath) || 'file';
        const fileType = getFileTypeFromContentType(contentType) || getFileTypeFromExtension(fileName);

        if (!fileType) {
            throw new Error('Could not determine file type from URL');
        }

        logger.info('MetaService: File info extracted', {
            fileName,
            fileLength: parseInt(contentLength),
            fileType,
            contentType
        });

        return {
            fileName,
            fileLength: parseInt(contentLength),
            fileType
        };

    } catch (error) {
        logger.error('MetaService: Error getting file info from URL', {
            fileUrl,
            error: error.message
        });
        throw error;
    }
}

async function uploadFileFromUrl({ uploadSessionId, accessToken, fileUrl }) {
    try {
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer'
        });

        const fileBuffer = Buffer.from(response.data);
        
        const uploadResponse = await axios.post(
            `https://graph.facebook.com/${META_API_VERSION}/${uploadSessionId}`,
            fileBuffer,
            {
                headers: {
                    'Authorization': `OAuth ${accessToken}`,
                    'file_offset': '0',
                    'Content-Type': 'application/octet-stream'
                }
            }
        );

        logger.info('MetaService: File upload from URL completed', {
            uploadSessionId,
            fileHandle: uploadResponse.data.h
        });

        return uploadResponse.data;

    } catch (error) {
        logger.error('MetaService: Error uploading file from URL', {
            uploadSessionId,
            fileUrl,
            error: error.response?.data || error.message
        });
        throw error;
    }
}

async function startUploadSession({ appId, accessToken, fileName, fileLength, fileType }) {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/${META_API_VERSION}/${appId}/uploads`,
            null,
            {
                params: {
                    file_name: fileName,
                    file_length: fileLength,
                    file_type: fileType,
                    access_token: accessToken
                }
            }
        );

        logger.info('MetaService: Upload session started', {
            appId,
            fileName,
            sessionId: response.data.id
        });

        return response.data;

    } catch (error) {
        logger.error('MetaService: Error starting upload session', {
            appId,
            fileName,
            error: error.response?.data || error.message
        });
        throw error;
    }
}

async function resumeUpload({ uploadSessionId, accessToken, fileUrl, fileOffset }) {
    try {
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer'
        });

        const fileBuffer = Buffer.from(response.data);
        
        const uploadResponse = await axios.post(
            `https://graph.facebook.com/${META_API_VERSION}/${uploadSessionId}`,
            fileBuffer,
            {
                headers: {
                    'Authorization': `OAuth ${accessToken}`,
                    'file_offset': fileOffset.toString(),
                    'Content-Type': 'application/octet-stream'
                }
            }
        );

        logger.info('MetaService: Upload resumed successfully', {
            uploadSessionId,
            fileOffset,
            fileHandle: uploadResponse.data.h
        });

        return uploadResponse.data;

    } catch (error) {
        logger.error('MetaService: Error resuming upload', {
            uploadSessionId,
            fileOffset,
            error: error.response?.data || error.message
        });
        throw error;
    }
}

async function getUploadStatus({ uploadSessionId, accessToken }) {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/${META_API_VERSION}/${uploadSessionId}`,
            {
                headers: {
                    'Authorization': `OAuth ${accessToken}`
                }
            }
        );

        logger.info('MetaService: Upload status retrieved', {
            uploadSessionId,
            fileOffset: response.data.file_offset
        });

        return response.data;

    } catch (error) {
        logger.error('MetaService: Error getting upload status', {
            uploadSessionId,
            error: error.response?.data || error.message
        });
        throw error;
    }
}

function validateFileType(fileType) {
    const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'video/mp4'
    ];

    if (!validTypes.includes(fileType)) {
        throw new Error(`Invalid file type: ${fileType}. Valid types are: ${validTypes.join(', ')}`);
    }
}

function getFileTypeFromExtension(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const typeMap = {
        '.pdf': 'application/pdf',
        '.jpeg': 'image/jpeg',
        '.jpg': 'image/jpg',
        '.png': 'image/png',
        '.mp4': 'video/mp4'
    };

    return typeMap[ext] || null;
}

function getFileTypeFromContentType(contentType) {
    if (!contentType) return null;
    
    const typeMap = {
        'application/pdf': 'application/pdf',
        'image/jpeg': 'image/jpeg',
        'image/jpg': 'image/jpg',
        'image/png': 'image/png',
        'video/mp4': 'video/mp4'
    };

    return typeMap[contentType] || null;
}

module.exports = {
    uploadMediaFromUrl,
    getFileInfoFromUrl,
    uploadFileFromUrl,
    startUploadSession,
    resumeUpload,
    getUploadStatus,
    validateFileType,
    getFileTypeFromExtension,
    getFileTypeFromContentType
}; 