"use strict";

const crypto  = require('crypto');

class BasicChallenge {
  constructor(params, delimiter) {
    let self = this;
    self.preference = 0;

    self.realm = params['realm'];
    self.delimiter = delimiter;
  }

  response(method, requestURI, username, password) {
    return 'Basic ' + (new Buffer(username + ':' + password).toString('base64'));
  }
}

class DigestChallenge {
  constructor(params, delimiter) {
    let self = this;
    self.preference = 1;

    self.realm = params['realm'];
    self.domain = params['domain'];
    self.nonce = params['nonce'];
    self.opaque = params['opaque'];
    self.stale = params['stale'];
    self.algorithm = params['algorithm'];
    self.qopOptions = params['qop'];
    self.authParam = params['auth'];

    self.delimiter = delimiter;

    if(!!self.algorithm && self.algorithm != 'MD5') {
      throw { message: 'Unsupported digest authentication algorithm' };
    }

    // TODO: Implement qop later.
    self.qopOptions = null;
  }

  hash(data) {
    let self = this;
    if(!self.algorithm || self.algorithm == 'MD5')
      return crypto.createHash('md5').update(data).digest('hex');
    else
      throw { message: 'Unsupported digest authentication algorithm' };
  }

  kd(secret, data) {
    let self = this;
    return self.hash(Buffer.concat([secret, new Buffer(':'), data]));
  }

  response(method, requestURI, username, password) {
    let self = this;
    if(!self.qopOptions) {
      let A1 = username + ':' + self.realm + ':' + password;
      let A2 = method + ':' + requestURI;

      let requestDigest = self.kd(new Buffer(self.hash(A1)), new Buffer(self.nonce + ':' + self.hash(A2)));

      let parts = ['Digest username="' + username + '"'];
      if(self.realm)
        parts.push('realm="' + self.realm + '"');
      if(self.nonce)
        parts.push('nonce="' + self.nonce + '"');
      parts.push('uri="' + requestURI + '"');
      parts.push('response="' + requestDigest + '"');
      if(self.algorithm)
        parts.push('algorithm=' + self.algorithm);
      if(self.opaque)
        parts.push('opaque="' + self.opaque + '"');

      return parts.join(self.delimiter);
    } else {
      // TODO: Implement support for qop/cnonce.
      throw { message: 'QOP not yet supported' };
    }
  }
}

class HTTPAuthenticate {
  constructor(username, password) {
    let self = this;
    self.username = username;
    self.password = password;
    self.challenges = [];
  }

  parseHeaderValue(headerValue) {
    let self = this;
    let challenges = headerValue.split(',');

    // First try comma-delimited multiple challenges.
    let parsedChallenges = [];
    try {
      for(let challenge of challenges) {
        let parsed = self.parseChallenge(challenge.trim(), ' ');
        if(parsed)
          parsedChallenges.push(parsed);
      }
    } catch(err) {
      if(err.code != -2)
        throw err;

      // Then try single challenge, comma delimited.
      let parsed = self.parseChallenge(headerValue, ', ');
      if(parsed)
        self.challenges.push(parsed);

      return;
    }

    for(let parsed of parsedChallenges)
      self.challenges.push(parsed);
  }

  parseChallenge(str, delimiter) {
    let self = this;

    let re = /([^"\s]+|[^"]*"[^"]*")(,?\s+|$)/g;

    let parts = [];
    let match;
    while((match = re.exec(str)) !== null) {
      parts.push(match[0]);
    }

    if(parts.length == 0)
      return;

    let scheme = parts.shift().trim();
    let params = {};
    for(let param of parts) {
      let paramParts = param.trim().split('=', 2);
      let key = paramParts[0];
      let value = '';
      if(paramParts.length >= 2) {
        value = paramParts[1];
        if(value.length >= 1 && value[value.length - 1] == ',') {
          value = value.substr(0, value.length - 1);
        }

        if(value.length >= 2 && value[0] == '"' && value[value.length - 1] == '"') {
          value = value.substr(1, value.length - 2);
        }
      }

      params[key] = value;
    }

    if(scheme.indexOf('=') != -1)
      throw { 'code': -2, 'message': 'Bad challenge' }

    try {
      if(scheme == 'Basic')
        return new BasicChallenge(params, delimiter);
      else if(scheme == 'Digest')
        return new DigestChallenge(params, delimiter);
    } catch(err) {
      return null;
    }

    return null;
  }

  ready() {
    let self = this;
    return self.challenges.length > 0;
  }

  response(method, requestURI) {
    let self = this;
    let selectedChallenge = null;

    for(let challenge of self.challenges) {
      if(!selectedChallenge || challenge.preference > selectedChallenge.preference)
        selectedChallenge = challenge;
    }

    if(!selectedChallenge)
      return null;

    return selectedChallenge.response(method, requestURI, self.username, self.password);
  }
}

module.exports = HTTPAuthenticate;
