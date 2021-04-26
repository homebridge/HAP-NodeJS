import * as crypto from "crypto";
import { SRP } from "fast-srp-hap";
import { generateSetupCodeSync } from "../lib/util/setupcode";
import { generateSetupUri } from "../lib/util/setupid";

// TODO make this a bin script (and delivered in package.json "files), based on proper command line parsing via "commander" package

const setupCode = generateSetupCodeSync();
console.log("Setup code", setupCode);

if (process.argv[2]) {
  const setupURI = generateSetupUri(setupCode, process.argv[2], parseInt(process.argv[3]));
  console.log("Setup URI", setupURI);
} else {
  console.warn("Pass the setup ID and optionally category ID to generate the setup URI");
}

const salt = crypto.randomBytes(16);
const verifier = SRP.computeVerifier(SRP.params.hap, salt, Buffer.from("Pair-Setup"), Buffer.from(setupCode));

console.log("Salt", salt.toString("hex"));
console.log("Verifier", verifier.toString("hex"));
