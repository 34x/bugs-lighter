const request = require('request-promise-native');
const hue = require('node-hue-api');
const utils = require('./src/utils');
const fs = require('fs');

const argv = process.argv;

const cmd = argv[2];

const configFile = argv.indexOf('--config') < 0 ? undefined : argv[argv.indexOf('--config') + 1];
if (!configFile) {
  console.warn('Please provide config via: --config config.json');
  return;
}

const isInit = 'init' === cmd;
const config = isInit ? null : require(configFile);

const hueApi = isInit ? null : new hue.HueApi(config.hueBridge.host, config.hueBridge.username);

const findBridge = async () => {
  const bridge = await hue.upnpSearch();

  return bridge;
}

const triggerLamp = async (inParams) => {
  const params = inParams || {};
  console.log('triggerLamp: ', params);
  if (!!params.state) {
    await hueApi.setLightState(params.bulb, params.state)
  } else {
    const offTransition = 400;
    const offState = hue.lightState.create().on(false).transition(offTransition);
    const retry = params.retry || { count: 1, delay: 500 } ;
    const rgb = params.rgb;
    const on = params.on || !!rgb;
    const onTransition = 200;
    let state = hue.lightState.create().on(on).transition(onTransition);

    if (on) {
      state = state.rgb(rgb.r, rgb.g, rgb.b)
                   .brightness(params.brightness || 100)
    }

    for (let i = 0; i < retry.count; i++) {
      if (i > 0) {
        await hueApi.setLightState(params.bulb, offState);
        await utils.delay(retry.delay + offTransition);
      }
      await hueApi.setLightState(params.bulb, state);
      await utils.delay(onTransition);
    }
  }

};

const pingLamp = async (params) => {
  const onTransition = 100;
  const offTransition = 800;

  const on = hue.lightState.create().on().rgb(20, 20, 255).brightness(80).transition(onTransition);
  const off = hue.lightState.create().on(false).transition(offTransition);

  try {
    const originalStatus = await hueApi.lightStatus(params.bulb)
    for (let i = 0; i < 4; i++) {
      await hueApi.setLightState(params.bulb, on)
      await utils.delay(onTransition);
      await hueApi.setLightState(params.bulb, off)
      await utils.delay(offTransition);
    }
    if (originalStatus.state.on) {
      await hueApi.setLightState(params.bulb, originalStatus.state)
    }
  } catch (err) {
    if (-1 === err.message.search('not available')) {
      throw err;
    }

    const lights = (await hueApi.lights()).lights.map((l) => l.id);
    console.log('The light is ' + params.bulb + ' not available.');
    console.log('Available lights: ' + lights.join(', '));
  }
};

const pingAll = async () => {
  const lights = (await hueApi.lights()).lights.map((l) => l.id);
  for (const idx in lights) {
    const lightID = lights[idx];
    console.log('Ping light#' + lightID);
    await pingLamp({ bulb: lightID });
  }
}

const party = async () => {
  const lights = await hueApi.lights()

  const states = [
    hue.lightState.create().on().rgb(255, 0, 0), // red
    hue.lightState.create().on().rgb(0, 255, 0), // green
    hue.lightState.create().on().rgb(0, 0, 255), // blue
    hue.lightState.create().on().rgb(255, 100, 0),
    hue.lightState.create().on().rgb(255, 0, 100),
    hue.lightState.create().on().rgb(0, 255, 100),
  ];

  for (let round = 10; round > 0; round--) {
    console.log('Rounds left ' + round);
    for (let idx in lights.lights) {
      const l = lights.lights[idx];
      const rndIdx = Math.round(Math.random() * 1000) % states.length;
      const state = states[rndIdx];
      await hueApi.setLightState(l.id, state);
      await utils.delay(150);
    }
  }

}

const callbacks = {
  triggerLamp
};

const runState = async (entry, stateName) => {
  const states = config.states;

  let state = entry.states[stateName];

  if (!state) {
    state = entry.states['*'];
  }

  state = utils.deepOverride(states[state.parent], state);

  await callbacks[state.callback](state.params);
}

const run = async (params) => {
  console.log('Run with params: ', params)

  Object.keys(config.checkers).forEach(async (entryKey) => {
    if (undefined !== params.check && entryKey !== params.check) {
      return;
    }
    const entry = config.checkers[entryKey];

    console.log('Processing #' + entryKey + ': ' + entry.name)

    if (!!params.state) {
      await runState(entry, params.state);
      return;
    }

    const module = require('./src/modules/' + entry.module);

    const moduleConfig = utils.deepOverride(config.configs[entry.config.parent], entry.config);

    const result = await module(moduleConfig);

    if (params.moduleOnly) {
      console.log('Module only result');
      console.log(result);
      return;
    }

    const resultState = result.state;
    await runState(entry, result.state);
  });
}

const init = async (configFilename) => {

  if(fs.existsSync(configFilename)) {
    console.error('Config file ' + configFilename + ' exists. Please provide another name');
    return;
  }

  const newConfig = {
    hueBridge: {
      host: undefined,
      username: undefined,
    },
    states: {
      error: {
        callback: 'triggerLamp',
        params: {
          rgb: { r: 255, g: 0, b: 0},
          brightness: 100,
        }
      },
      '*': {
        callback: 'triggerLamp',
      }
    },
    configs: {
      sentry: {
        token: '...',
        user: '...',
        timeout: 2,
      }
    },
    checkers: {
      ios: {
        name: 'Sentry ios',
        module: 'sentry',
        config: {
          'parent': 'sentry',
          'project': '...'
        },
        'states': {
          error: {
            parent: 'error',
            params: { bulb: 8 }
          },
          '*': {
            parent: '*',
            'params': { bulb: 8 }
          }
        }
      }
    }
  };

  const bridge = await findBridge();

  newConfig.hueBridge.host = bridge[0].ipaddress;

  const api = new hue.HueApi();

  for (let i = 0; i < 12; i++) {
    await utils.delay(2000);
    try {
      const registration = await api.registerUser(newConfig.hueBridge.host, 'light_notifier/1');
      newConfig.hueBridge.username = registration;
      break;
    } catch (err) {
      console.log('Please, press the button on the bridge');
    }
  }

  const json = JSON.stringify(newConfig, null, 2);

  fs.writeFileSync(configFilename, json);

  console.log('All done, please modify the config file (' + configFilename + ') and enjoy your new light notifications');

};

if ('ping' === cmd) {
  pingLamp({ bulb: argv[3] })
} else if ('pingAll' === cmd) {
  pingAll();
} else if ('party' === cmd) {
  party();
} else if ('init' === cmd) {
  init(configFile);
} else {
  run({
    check: argv.indexOf('--check') < 0 ? undefined : argv[argv.indexOf('--check') + 1],
    moduleOnly: argv.indexOf('--module-only') > -1 ? true : false,
    state: argv.indexOf('--state') < 0 ? undefined : argv[argv.indexOf('--state') + 1],
  });
}
