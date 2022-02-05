// Load node modules
import fs from 'node:fs/promises';
import path from 'node:path';

// Load additional modules
import Ajv from 'ajv';
import core from '@actions/core';
import glob from '@actions/glob';
import styles from 'ansi-styles';

// Load action inputs variables
const schemaInput = core.getInput('schema');
const patternInput = core.getInput('pattern');

// Load path to the checked out repository
const repositoryPath = process.env.GITHUB_WORKSPACE;

// Load the provided schema
const schemaPath = path.join(repositoryPath, schemaInput);
const schemaString = await fs.readFile(schemaPath, 'utf-8');
const schemaObject = JSON.parse(schemaString);

// Get all jsons paths
const globber = await glob.create(patternInput, {
	followSymbolicLinks: false,
	implicitDescendants: false,
	matchDirectories: false,
	omitBrokenSymbolicLinks: true
});

// Init Ajv schema validator
const validator = new Ajv({ allErrors: true });
const validateFile = validator.compile(schemaObject);

// Define errors counter so we can return correct exit code
let errorsCounter = 0;

// Validate each file according to schema
for await (const jsonPath of globber.globGenerator()) {
	// Load JSON file as a string
	const jsonString = await fs.readFile(jsonPath, 'utf-8');

	// Parse the JSON string to an Object so the validator could handle it
	const jsonObject = JSON.parse(jsonString);

	// Validate the file according to given schema
	const validationResult = validateFile(jsonObject);

	// Define relative JSON file path
	const jsonPathRelative = jsonPath.replace(repositoryPath, '');

	// Print the validation results
	if (validationResult) {
		core.info(`${styles.green.open}✔ file ${jsonPathRelative} is valid${styles.green.close}`);
	} else {
		core.info(`${styles.red.open}✖︎ file ${jsonPathRelative} is invalid${styles.red.close}`);
		errorsCounter++;
	}

	// Print details from the validator
	if (validateFile.errors) {
		core.startGroup('Validation details');
		core.info(JSON.stringify(validateFile.errors, null, 2));
		core.endGroup();
	}
}

// Fail the task run in case of any error
if (errorsCounter) {
	core.setFailed(`There are ${errorsCounter} invalid files`);
}
