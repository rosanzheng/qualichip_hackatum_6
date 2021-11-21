const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");
const PredictionApi = require("@azure/cognitiveservices-customvision-prediction");
const msRest = require("@azure/ms-rest-js");
const { CosmosClient } = require("@azure/cosmos");

const credential = new DefaultAzureCredential();
const keyVaultUrl = 'https://kv-qualichip.vault.azure.net/';
const secretClient = new SecretClient(keyVaultUrl, credential);

module.exports = async function (context, myBlob) {
    context.log(Object.keys(context.bindingData));
    const result = await getPrediction(myBlob);
    for (prediction of result.predictions) {
        if (prediction.probability >= 0.6) {
            await insertInCosmos(context.bindingData.name, prediction.probability, prediction.tagName, context.bindingData.uri); 
        }
    }
};

const getPrediction = async (blob) => {
    const predictionKeySecret = await secretClient.getSecret('custom-vision-prediction-key');
    const predictionKey = predictionKeySecret.value;
    const predictorCredentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": predictionKey } });
    const predictionEndpoint = 'https://qualichipcustomvision-prediction.cognitiveservices.azure.com/';
    const predictor = new PredictionApi.PredictionAPIClient(predictorCredentials, predictionEndpoint);
    const customVisionProjectId = '10ad6123-c92a-4fda-8fff-3ed46a345610';
    const result = await predictor.classifyImage(customVisionProjectId, 'Iteration2', blob);
    return result;
};

const insertInCosmos = async (id, confidence, tag, url,) => {
    const cosmosKeySecret = await secretClient.getSecret('cosmos-db-key');
    const cosmosKey = cosmosKeySecret.value;
    const cosmosEndpoint = 'https://cosmos-team6.documents.azure.com:443/';
    const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
    const container = await cosmosClient.database('qualichip-db').container('images');
    await container.items.create({
        id,
        confidence,
        predictionLabel: tag === 'GoodChip' ? 'good': 'bad',
        URL: url,
    });
};