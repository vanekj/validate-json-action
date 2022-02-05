# Validate JSON(s) GitHub Action

Validate JSON(s) by given schema using Ajv schema validator.

## Why another JSON validation action you ask..

I was facing issues with the other actions for JSON validations and so I made my own. If you are facing issues like the one below, I recommend to switch to this one.

```
no schema with key or ref "https://json-schema.org/draft-07/schema"
```

## Inputs

### `schema`

**Required** Relative path to the JSON schema file

### `pattern`

**Required** Glob pattern to the JSON(s) to validate

## Outputs

List of all processed files and it's validation result.

## Example usage

```yml
uses: vanekj/validate-json-action@v1
with:
  schema: schemas/default.schema.json
  pattern: data/**/*.json
```
