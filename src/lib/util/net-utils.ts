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
      if (info.family === "IPv4") {
        if (!ipv4) {
          ipv4 = info.address;
        }
      } else if (info.family === "IPv6") {
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

  const address = ipv6 || ipv6LinkLocal || ipv4;
  if (!address) {
    throw new Error("Could not find a valid loopback address on the platform!");
  }
  return address;
}
let loopbackAddress: string | undefined = undefined; // loopback addressed used for the internal http server (::1 or 127.0.0.1)

export function getOSLoopbackAddress(): string {
  return loopbackAddress ?? (loopbackAddress = findLoopbackAddress());
}
