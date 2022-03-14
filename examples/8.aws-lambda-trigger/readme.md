This example shows how migrations can be written in typescript and run with the help of `ts-node`.

Purpose of this project is to emulate an automatic trigger of umzug migrate commands from service file from lamdba handler.

Congifure awsSamtemplate to trigger lamdaEntry.js file.

Later trigger aws sam command locally

```bash
sam local invoke TestFunction -e event.json --parameter-overrides ' \
ParameterKey=Dialect,ParameterValue=mysql \
ParameterKey=DatabaseHost,ParameterValue=host.docker.internal \
ParameterKey=DatabaseName,ParameterValue=test \
ParameterKey=DatabaseUsername,ParameterValue=test \
ParameterKey=DatabasePassword,ParameterValue=test \ 
ParameterKey=NodeEnv,ParameterValue=development \ 
ParameterKey=DatabasePort,ParameterValue=63307 \'
```
