const request = require('request-promise-native');
const moment = require('moment');

const getErrors = async (user, project, token) => {
  return request(
    'https://sentry.io/api/0/projects/' + user + '/' + project + '/issues/\?statsPeriod\=24h',
    {
      json: true,
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }
  );
}

module.exports = async (config) => {
  const errors = await getErrors(config.user, config.project, config.token);
  const levels = {
    'fatal': 0,
    'error': 1,
    'warning': 2,
    'info': 3,
  };

  const result = {
    state: 'clear',
    user: config.user,
    project: config.project,
    errors: [],
    error: null,
  };

  if (errors.length > 0) {
    result.errors = errors.map((e) => { return { lastSeen: e.lastSeen, level: e.level } });

    const lastCheck = moment().subtract(config.timeout || 2, 'minutes');

    for (const idx in errors) {
      const err = errors[idx];
      const lastErrorSeen = moment(err.lastSeen);

      if (lastErrorSeen < lastCheck) {
        break;
      }

      if (null === result.error || levels[err.level] > levels[result.error.level]) {
        result.error = err;
      }
    }


    result.lastCheck = lastCheck.format();

    if (null !== result.error) {
      result.state = result.error.level;
    }
  }

  return result;
}