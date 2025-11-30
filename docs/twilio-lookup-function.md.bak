# Twilio Lookup Function Setup

This repository includes a Twilio Serverless Function template at `twilio/functions/lookup-carrier.protected.js`. Deploy it with the Twilio CLI Serverless Toolkit to expose a simple HTTPS endpoint that returns carrier, line-type, and caller-name information for a phone number.

## Prerequisites

- Twilio CLI (`npm i -g twilio-cli`)
- Twilio Serverless Toolkit plugin (`twilio plugins:install @twilio-labs/plugin-serverless`)
- Upgraded Twilio project with Lookup carrier data enabled

## Deploy the Function

```bash
# Initialise a new service (run once)
twilio serverless:init flynnai-lookup --template=blank
cd flynnai-lookup

# Copy the provided function into your project
cp "../twilio/functions/lookup-carrier.protected.js" functions/lookup-carrier.protected.js

# Deploy to Twilio (creates a dev environment by default)
twilio serverless:deploy
```

The deploy command prints a URL similar to:

```
https://flynnai-lookup-1234-dev.twil.io/lookup-carrier
```

Copy that URL into `.env` as `EXPO_PUBLIC_TWILIO_LOOKUP_FUNCTION_URL` so the app can call it from the client.

## Local development (optional)

```bash
# From the service directory
twilio serverless:start --ngrok=""
```

This starts the function on `http://localhost:3000/lookup-carrier` and creates an ngrok tunnel for testing from devices.

## Function contract

- **Method:** `GET`
- **Query parameter:** `phoneNumber` (E.164 formatted)
- **Response:** JSON containing `carrier`, `callerName`, and formatting helpers

Example request:

```
GET /lookup-carrier?phoneNumber=%2B61409223600
```

Example response:

```json
{
  "phoneNumber": "+61409223600",
  "nationalFormat": "0409 223 600",
  "countryCode": "AU",
  "carrier": {
    "name": "Vodafone AU",
    "type": "mobile",
    "mobile_country_code": "505",
    "mobile_network_code": "03"
  },
  "callerName": {
    "caller_name": "VODAFONE AU",
    "caller_type": "BUSINESS"
  }
}
```

If the Twilio Lookup API fails, the function returns an error JSON body with status code 4xx/5xx. The app logs these cases and falls back to its local carrier heuristics.
