#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {
  findServiceClientPrimaryToken,
  getServiceClientPrimaryToken,
  upsertServiceClient,
} from '../src/service-clients.mjs';

function valueFrom(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function listFrom(env, name) {
  return valueFrom(env, name).split(',').map((value) => value.trim()).filter(Boolean);
}

export function execute(command, env = process.env) {
  if (command === 'upsert') {
    return upsertServiceClient(env.SERVICE_CLIENTS_JSON || '', {
      id: valueFrom(env, 'CLIENT_ID'),
      tokens: listFrom(env, 'CLIENT_TOKENS'),
      scopes: listFrom(env, 'CLIENT_SCOPES'),
      requestsPerMinute: valueFrom(env, 'CLIENT_REQUESTS_PER_MINUTE'),
    });
  }
  if (command === 'primary-token') {
    return getServiceClientPrimaryToken(
      valueFrom(env, 'SERVICE_CLIENTS_JSON'),
      valueFrom(env, 'CLIENT_ID'),
    );
  }
  if (command === 'primary-token-if-present') {
    return findServiceClientPrimaryToken(
      valueFrom(env, 'SERVICE_CLIENTS_JSON'),
      valueFrom(env, 'CLIENT_ID'),
    );
  }
  throw new Error('Usage: service-clients.mjs <upsert|primary-token|primary-token-if-present>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${execute(process.argv[2])}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Service client operation failed'}\n`);
    process.exitCode = 1;
  }
}
