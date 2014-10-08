#include "mdns.hpp"

#include "mdns_utils.hpp"

#include <string>

namespace node_mdns {

using namespace v8;

Local<Value>
buildException(DNSServiceErrorType error_code) {
    if (error_code == kDNSServiceErr_NoError) {
        return Local<Value>::New(Undefined());
    }

    std::string error_str("dns service error: ");
    error_str += errorString(error_code);
    Local<String> error_msg = String::New(error_str.c_str());
    Local<Value> error_v = Exception::Error(error_msg);
    Local<Object> error = error_v->ToObject();
    error->Set(String::NewSymbol("errorCode"), Integer::New(error_code));
    return error_v;
}

const char *
errorString(DNSServiceErrorType error) {
    switch (error) {
        case kDNSServiceErr_NoError:
            return "no error";
        case kDNSServiceErr_Unknown:
            return "unknown";
        case kDNSServiceErr_NoSuchName:
            return "no such name";
        case kDNSServiceErr_NoMemory:
            return "no memory";
        case kDNSServiceErr_BadParam:
            return "bad param";
        case kDNSServiceErr_BadReference:
            return "bad reference";
        case kDNSServiceErr_BadState:
            return "bad state";
        case kDNSServiceErr_BadFlags:
            return "bad flags";
        case kDNSServiceErr_Unsupported:
            return "unsupported";
        case kDNSServiceErr_NotInitialized:
            return "not initialized";
        case kDNSServiceErr_AlreadyRegistered:
            return "already registered";
        case kDNSServiceErr_NameConflict:
            return "name conflict";
        case kDNSServiceErr_Invalid:
            return "invalid";
        case kDNSServiceErr_Firewall:
            return "firewall";
        case kDNSServiceErr_Incompatible:
            return "incompatible";
        case kDNSServiceErr_BadInterfaceIndex:
            return "bad interface index";
        case kDNSServiceErr_Refused:
            return "refused";
        case kDNSServiceErr_NoSuchRecord:
            return "no such record";
        case kDNSServiceErr_NoAuth:
            return "no auth";
        case kDNSServiceErr_NoSuchKey:
            return "no such key";
        case kDNSServiceErr_NATTraversal:
            return "NAT traversal";
        case kDNSServiceErr_DoubleNAT:
            return "double NAT";
        case kDNSServiceErr_BadTime:
            return "bad time";
#ifdef kDNSServiceErr_BadSig
        case kDNSServiceErr_BadSig:
            return "bad sig";
#endif
#ifdef kDNSServiceErr_BadKey
        case kDNSServiceErr_BadKey:
            return "bad key";
#endif
#ifdef kDNSServiceErr_Transient
        case kDNSServiceErr_Transient:
            return "transient";
#endif
#ifdef kDNSServiceErr_ServiceNotRunning
        case kDNSServiceErr_ServiceNotRunning:
            return "service not running";
#endif
#ifdef kDNSServiceErr_NATPortMappingUnsupported
        case kDNSServiceErr_NATPortMappingUnsupported:
            return "NAT port mapping unsupported";
#endif
#ifdef kDNSServiceErr_NATPortMappingDisabled
        case kDNSServiceErr_NATPortMappingDisabled:
            return "NAT port mapping disabled";
#endif
#ifdef kDNSServiceErr_NoRouter
        case kDNSServiceErr_NoRouter:
            return "no router";
#endif
#ifdef kDNSServiceErr_PollingMode
        case kDNSServiceErr_PollingMode:
            return "polling mode";
#endif
        default:
            return "unknown error code";
    }
}

} // end of namespace node_mdns
