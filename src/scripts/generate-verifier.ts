import * as crypto from "crypto";
import { SRP } from "fast-srp-hap";
import { generateSetupCodeSync } from "../lib/util/setupcode";
import { generateSetupUri } from "../lib/util/setupid";

const setupcode = generateSetupCodeSync();
console.log('Setup code', setupcode);

if (process.argv[2]) {
  const setupuri = generateSetupUri(setupcode, process.argv[2], parseInt(process.argv[3]));
  console.log('Setup URI', setupuri);
} else {
  console.warn('Pass the setup ID and optionally category ID to generate the setup URI');
}

const salt = crypto.randomBytes(16);
const verifier = SRP.computeVerifier(SRP.params.hap, salt, Buffer.from('Pair-Setup'), Buffer.from(setupcode));

console.log('Salt', salt.toString('hex'));
console.log('Verifier', verifier.toString('hex'));
