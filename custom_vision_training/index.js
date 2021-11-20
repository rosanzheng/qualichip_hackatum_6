require("dotenv").config();
const path = require("path")
const util = require('util');
const fs = require('fs');
const TrainingApi = require("@azure/cognitiveservices-customvision-training");
const PredictionApi = require("@azure/cognitiveservices-customvision-prediction");
const msRest = require("@azure/ms-rest-js");

const trainingKey = process.env.TRAINING_KEY;
const trainingEndpoint = process.env.TRAINING_ENDPOINT;
const predictionKey = process.env.PREDICTION_KEY;
const predictionResourceId = process.env.PREDICTION_RESOURCE_ID;
const predictionEndpoint = process.env.PREDICTION_ENDPOINT;

const publishIterationName = "classifyModel";
const setTimeoutPromise = util.promisify(setTimeout);

const credentials = new msRest.ApiKeyCredentials({ inHeader: { "Training-key": trainingKey } });
const trainer = new TrainingApi.TrainingAPIClient(credentials, trainingEndpoint);
const predictor_credentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": predictionKey } });
const predictor = new PredictionApi.PredictionAPIClient(predictor_credentials, predictionEndpoint);

const getFilesRecursively = (directory, files) => {
    const filesInDirectory = fs.readdirSync(directory);
    for (const file of filesInDirectory) {
        const absolute = path.join(directory, file);
        if (fs.statSync(absolute).isDirectory()) {
            getFilesRecursively(absolute, files);
        } else {
            files.push(absolute);
        }
    }
}

const main = async () => {
    console.log("Creating project...");
    const sampleProject = await trainer.createProject("QualiChip");

    const badChip = await trainer.createTag(sampleProject.id, "BadChip");
    const goodChip = await trainer.createTag(sampleProject.id, "GoodChip");

    const sampleDataRoot = process.env.DATA_PATH;

    console.log("Adding images...");
    let fileUploadPromises = [];

    const goodChipPath = process.env.GOODCHIP_PATH;
    const goodChipFiles = [];
    getFilesRecursively(goodChipPath, goodChipFiles);
    let counter = 0;
    for(file of goodChipFiles) {
        if (counter % 50 === 0) {
            await setTimeoutPromise(1500);
        }
        fileUploadPromises.push(trainer.createImagesFromData(sampleProject.id, fs.readFileSync(file), { tagIds: [goodChip.id] }))
        counter++;
    }

    const badChipPath = process.env.BADCHIP_PATH;
    const badChipFiles = [];
    getFilesRecursively(badChipPath, badChipFiles);
    for(file of badChipFiles) {
        if (counter % 50 === 0) {
            await setTimeoutPromise(1500);
        }
        fileUploadPromises.push(trainer.createImagesFromData(sampleProject.id, fs.readFileSync(file), { tagIds: [badChip.id] }))
        counter++;
    }

    await Promise.all(fileUploadPromises);
}
main()