const { MongoClient, ObjectId } = require('mongodb');
const environment = require('../config/environment');
const logger = require('../config/logger');

let client;
let dbConnections = {};

async function connect() {
    if (!client) {
        client = new MongoClient(environment.mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        logger.info('MongoDBService: MongoDB connected');
    }
}

async function getDbConnection(dbName) {
    if (!client) {
        await connect();
    }
    if (!dbConnections[dbName]) {
        dbConnections[dbName] = client.db(dbName);
    }
    return dbConnections[dbName];
}

async function close() {
    if (client) {
        await client.close();
        logger.info('MongoDBService: MongoDB connection closed');
    }
}

module.exports = { connect, getDbConnection, close, ObjectId }; 