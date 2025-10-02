exports.handler = async (context, event, callback) => {
  console.log('Twilio Function: Invoked');
  console.log('Twilio Function: Event Payload', JSON.stringify(event, null, 2));
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Content-Type', 'application/json');

  if (event.httpMethod === 'OPTIONS') {
    response.setStatusCode(204);
    response.setBody('');
    return callback(null, response);
  }

  try {
    const client = context.getTwilioClient();
    const phoneNumber = event.phoneNumber || event.From;

    console.log('Twilio Function: Received phoneNumber', phoneNumber);

    if (!phoneNumber) {
      response.setStatusCode(400);
      response.setBody(JSON.stringify({ error: 'phoneNumber parameter is required' }));
      return callback(null, response);
    }

    const lookup = await client.lookups.v1
      .phoneNumbers(phoneNumber)
      .fetch({ type: ['carrier', 'caller-name'] });

    response.setStatusCode(200);
    response.setBody(
      JSON.stringify({
        phoneNumber: lookup.phoneNumber,
        nationalFormat: lookup.nationalFormat,
        countryCode: lookup.countryCode,
        carrier: lookup.carrier,
        callerName: lookup.callerName,
      }),
    );
    return callback(null, response);
  } catch (error) {
    console.error('Lookup failed', error);
    console.error('Twilio Function: Detailed Error', error.message, error.code, error.status);
    response.setStatusCode(error.status || 500);
    response.setBody(
      JSON.stringify({
        error: error.message,
        code: error.code,
        status: error.status,
      }),
    );
    return callback(null, response);
  }
};
