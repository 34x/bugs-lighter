# Events notifier

Fire lights according to configured evens (for example sentry error received)

Simple usage example:

```
node index.js init --config ./config.json
# you will have to tap on the hue bridge button once offered

# edit your config.json file

# after setup ping the first light
node index.js ping 1 --config ./config.json

# if the light blinked you are ready to go
# add script to your crontab (remember to use correct paths for every part of the cron job)

*/1 * * * * node index.js --config ./config.json

# By default sentry will check for error happened for the last 2 minutes
# in that case the script will fire configured light (see the config.json for more details)

```


Run syntax:

```

node index.js [command] [command_argument] --config ./config.json

```

Available commands:

```
# initialize config and bridge connection
init

# will ping a light with a specific ID with a light pong
ping lightID

# will ping all available lights
pingAll

# party mode (go throughout all bulbs and turn them on with random light)
party
```

Possible arguments:

`--check checker_key` - will run only check for specific checker key (the key from `config.checkers` object)
`--state state_value` - will run only state trigger (state value is a key  from `config.checkers.states` object). Useful for debugging and fine tuning.
`--module-only` - will run only modules part, without triggering states. Useful to test modules without messing with lights around

Examples:

```
# running only ios checker
node index.js --check ios --config ./config.json

# running only ios checker module
# in case of sentry module will provide additional data about the module run result
node index.js --check ios --module-only --config ./config.json

# testing states (will trigger error state for all checkers)
node index.js --state error --config ./config.json


# testing states (will trigger default state for all checkers)
node index.js --state * --config ./config.json
```

Ping specific lamp

```
node index.js ping 9 --config ./config.json
```