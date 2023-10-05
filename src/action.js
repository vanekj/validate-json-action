// Load node modules
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

// Load additional modules
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import core from '@actions/core';
import glob from '@actions/glob';
import styles from 'ansi-styles';
import YAML from 'yaml';

// Load action inputs variables
const schemaInput = core.getInput('schema');
const patternInput = core.getInput('pattern');
const additionalSchemaInput = core.getInput('additional_schema');
const schemaExtentionInput = core.getInput('additional_schema_extention');

// Load path to the checked out repository
const repositoryPath = process.env.GITHUB_WORKSPACE;

// Load the provided schema
const schemaPath = path.join(repositoryPath, schemaInput);
const schemaString = await fsPromises.readFile(schemaPath, 'utf-8');
const schemaObject = JSON.parse(schemaString);

// Get all jsons paths
const globber = await glob.create(patternInput, {
	followSymbolicLinks: false,
	implicitDescendants: false,
	matchDirectories: false,
	omitBrokenSymbolicLinks: true
});

// Init Ajv schema validator
const validatorInput = { allErrors: true }

if (core.getBooleanInput('allow_matching_properties')) {
	validatorInput.allowMatchingProperties = true;
}

const validator = new Ajv(validatorInput);

// Add formats if wanted
if (core.getBooleanInput('use_ajv_formats')) {
	core.debug('using ajv-formats with json-validator')
	addFormats(validator)
} else {
	core.debug('ajv-formats will not be used with the json-validator')
}

//Add in additional schemas
const additionalSchemaPath = path.join(repositoryPath, additionalSchemaInput);
var additionalSchemaObjectArray = [];
let fileDetails = await fs.lstatSync(additionalSchemaPath);
var validateFile
if(additionalSchemaInput.length === 0){
	validateFile = validator.compile(schemaObject);
}
else if(fileDetails.isFile()){
	additionalSchemaObjectArray.push(await extractFile(additionalSchemaPath));
	validateFile = validator.addSchema(additionalSchemaObjectArray).compile(schemaObject);
}
else if(fileDetails.isDirectory()){
	const files = await fsPromises.readdir(additionalSchemaPath);
	for(var i = 0; i < files.length; i++){
		var additionalSchemaFilePath = path.join(additionalSchemaPath, files[i]);
		let fileDetails = await fs.lstatSync(additionalSchemaFilePath);
		if(additionalSchemaFilePath != schemaPath && fileDetails.isFile() && additionalSchemaFilePath.includes(schemaExtentionInput)){
			additionalSchemaObjectArray.push(await extractFile(additionalSchemaFilePath));
		}
	}
	validateFile = validator.addSchema(additionalSchemaObjectArray).compile(schemaObject);
}


async function extractFile(filePath){
	const fileContents = await fsPromises.readFile(filePath, 'utf-8');
  const convertedToObject = JSON.parse(fileContents);
	return convertedToObject;
}

// Define errors counter so we can return correct exit code
let errorsCounter = 0;
let testCounter = 0;

var errorOutput = ``;

// Validate each file according to schema
for await (const jsonPath of globber.globGenerator()) {
	// Load JSON file as a string
	const jsonString = await fsPromises.readFile(jsonPath, 'utf-8');

	// Parse the JSON string to an Object so the validator could handle it
	const jsonObject = YAML.parse(jsonString);

	// Validate the file according to given schema
	const validationResult = validateFile(jsonObject);

	// Define relative JSON file path
	const jsonPathRelative = jsonPath.replace(repositoryPath, '');

	// Print the validation results
	if (validationResult) {
		core.info(`${styles.green.open}✔ file ${jsonPathRelative} is valid${styles.green.close}`);
	} else {
		core.info(`${styles.red.open}✖︎ file ${jsonPathRelative} is invalid${styles.red.close}`);
		errorOutput = errorOutput + `File ${jsonPathRelative} is invalid\n` + JSON.stringify(validateFile.errors, null, 2) + `\n\n`;
		errorsCounter++;
	}

	// Print details from the validator
	if (validateFile.errors) {
		core.startGroup('Validation details');
		core.info(JSON.stringify(validateFile.errors, null, 2));
		core.endGroup();
	}

	// Show Results in summary, if enabled.
	testCounter++;
}

// Fail the task run in case of any error
if (errorsCounter) {
	core.setFailed(`There are ${errorsCounter} invalid files`);
} else {
	errorOutput = errorOutput + `All files passed validation`
}

if (core.getBooleanInput('show_result_in_summary')) {
	var passedResults = testCounter - errorsCounter;
	core.summary.addHeading('Validation Results', 3)
	.addCodeBlock(`${errorOutput}`, "js")
	.addTable([
		[{data: 'Number of files tested', header: true}, `${testCounter}`],
		[{data: 'Number of files passed', header: true}, `${passedResults}`],
		[{data: 'Number of files failed', header: true}, `${errorsCounter}`]
	])
	.write();		
}
