// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
import { createHash, randomBytes } from 'node:crypto'
import { readFile, stat } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import createDebug from 'debug'
import { Buffer } from 'safe-buffer'

import constants from './constants.js'
import readLine from './readline.js'

const debug = createDebug('HAP-NodeJS:DBus')

function sha1(input) {
  const shasum = createHash('sha1');
  shasum.update(input);
  return shasum.digest('hex');
}

function getUserHome() {
  return process.env[process.platform.match(/\$win/) ? 'USERPROFILE' : 'HOME'];
}

function getCookie(context, id, cb) {
  // http://dbus.freedesktop.org/doc/dbus-specification.html#auth-mechanisms-sha
  const dirname = join(getUserHome(), '.dbus-keyrings');
  // > There is a default context, "org_freedesktop_general" that's used by servers that do not specify otherwise.
  if (context.length === 0) context = 'org_freedesktop_general';

  const filename = join(dirname, context);
  // check it's not writable by others and readable by user
  stat(dirname, function (err, stat) {
    if (err) return cb(err);
    if (stat.mode & 0o22)
      return cb(
        new Error(
          'User keyrings directory is writeable by other users. Aborting authentication'
        )
      );
    if (process.hasOwnProperty('getuid') && stat.uid !== process.getuid())
      return cb(
        new Error(
          'Keyrings directory is not owned by the current user. Aborting authentication!'
        )
      );
    readFile(filename, 'ascii', function (err, keyrings) {
      if (err) return cb(err);
      const lines = keyrings.split('\n');
      for (let l = 0; l < lines.length; ++l) {
        const data = lines[l].split(' ');
        if (id === data[0]) return cb(null, data[2]);
      }
      return cb(new Error('cookie not found'));
    });
  });
}

function hexlify(input) {
  return Buffer.from(input.toString(), 'ascii').toString('hex');
}

export default function (stream, opts, cb) {
  // filter used to make a copy so we don't accidentally change opts data
  let authMethods;
  if (opts.authMethods) {
    authMethods = opts.authMethods;
  } else {
    authMethods = constants.defaultAuthMethods;
  }
  stream.write('\0');
  tryAuth(stream, authMethods.slice(), cb);
};

function tryAuth(stream, methods, cb) {
  if (methods.length === 0) {
    return cb(new Error('No authentication methods left to try'));
  }

  const authMethod = methods.shift();
  const uid = process.hasOwnProperty('getuid') ? process.getuid() : 0;
  const id = hexlify(uid);

  function beginOrNextAuth() {
    readLine(stream, function (line) {
      const ok = line.toString('ascii').match(/^([A-Za-z]+) (.*)/);
      if (ok && ok[1] === 'OK') {
        stream.write('BEGIN\r\n');
        return cb(null, ok[2]); // ok[2] = guid. Do we need it?
      } else {
        // TODO: parse error!
        if (!methods.empty) {
          tryAuth(stream, methods, cb);
        } else {
          return cb(line);
        }
      }
    });
  }

  switch (authMethod) {
    case 'EXTERNAL':
      stream.write(`AUTH ${authMethod} ${id}\r\n`);
      beginOrNextAuth();
      break;
    case 'DBUS_COOKIE_SHA1':
      stream.write(`AUTH ${authMethod} ${id}\r\n`);
      readLine(stream, function (line) {
        const data = Buffer.from(line.toString().split(' ')[1].trim(), 'hex')
          .toString()
          .split(' ');
        const cookieContext = data[0];
        const cookieId = data[1];
        const serverChallenge = data[2];
        // any random 16 bytes should work, sha1(rnd) to make it simpler
        const clientChallenge = randomBytes(16).toString('hex');
        getCookie(cookieContext, cookieId, function (err, cookie) {
          if (err) return cb(err);
          const response = sha1(
            [serverChallenge, clientChallenge, cookie].join(':')
          );
          const reply = hexlify(clientChallenge + response);
          stream.write(`DATA ${reply}\r\n`);
          beginOrNextAuth();
        });
      });
      break;
    case 'ANONYMOUS':
      stream.write('AUTH ANONYMOUS \r\n');
      beginOrNextAuth();
      break;
    default:
      debug(`Unsupported auth method: ${authMethod}`);
      beginOrNextAuth();
      break;
  }
}
