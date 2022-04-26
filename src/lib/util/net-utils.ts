import os from "os";

export function findLoopbackAddress(): string {
  let ipv6: string | undefined = undefined; // ::1/128
  let ipv6LinkLocal: string | undefined = undefined; // fe80::/10
  let ipv4: string | undefined = undefined; // 127.0.0.1/8

  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    let internal = false;
    for (const info of infos) {
      if (!info.internal) {
        continue;
      }

      internal = true;
      // @ts-expect-error Nodejs 18+ uses the number 4 the string "IPv4"
      if (info.family === "IPv4" || info.family === 4) {
        if (!ipv4) {
          ipv4 = info.address;
        }
      // @ts-expect-error Nodejs 18+ uses the number 6 the string "IPv6"
      } else if (info.family === "IPv6" || info.family === 6) {
        if (info.scopeid) {
          if (!ipv6LinkLocal) {
            ipv6LinkLocal = info.address + "%" + name; // ipv6 link local addresses are only valid with a scope
          }
        } else if (!ipv6) {
          ipv6 = info.address;
        }
      }
    }

    if (internal) {
      break;
    }
  }

  const address = ipv4 || ipv6 || ipv6LinkLocal;
  if (!address) {
    throw new Error("Could not find a valid loopback address on the platform!");
  }
  return address;
}
let loopbackAddress: string | undefined = undefined; // loopback addressed used for the internal http server (::1 or 127.0.0.1)

/**
 * Returns the loopback address for the machine.
 * Uses IPV4 loopback address by default and falls back to global unique IPv6 loopback and then
 * link local IPv6 loopback address.
 * If no loopback interface could be found a error is thrown.
 */
export function getOSLoopbackAddress(): string {
  return loopbackAddress ?? (loopbackAddress = findLoopbackAddress());
}

/**
 * Refer to {@link getOSLoopbackAddress}.
 * Instead of throwing an error, undefined is returned if loopback interface couldn't be detected.
 */
export function getOSLoopbackAddressIfAvailable(): string | undefined {
  try {
    return loopbackAddress ?? (loopbackAddress = findLoopbackAddress());
  } catch (error) {
    console.log(error.stack);
    return undefined;
  }
}
