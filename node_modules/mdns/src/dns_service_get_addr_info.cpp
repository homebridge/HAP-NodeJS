#include "mdns.hpp"

#ifndef WIN32 // XXX
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/socket.h> // AF_INET and AF_INET6 on freebsd
#endif

#include <v8.h>

#include "mdns_utils.hpp"
#include "dns_service_ref.hpp"

using namespace v8;
using namespace node;

namespace node_mdns {

#ifdef HAVE_DNSSERVICEGETADDRINFO

void
DNSSD_API
OnAddressInfo(DNSServiceRef sdRef, DNSServiceFlags flags, 
        uint32_t interfaceIndex, DNSServiceErrorType errorCode,
        const char * hostname, const struct sockaddr * address,
        uint32_t ttl, void * context)
{
    if ( ! context) return;

    HandleScope scope;
    ServiceRef * serviceRef = static_cast<ServiceRef*>(context);
    Handle<Function> callback = serviceRef->GetCallback();
    Handle<Object> this_ = serviceRef->GetThis();

    const size_t argc(8);
    Local<Value> args[argc];
    args[0] = Local<Object>::New(serviceRef->handle_);
    args[1] = Integer::New(flags);
    args[2] = Integer::NewFromUnsigned(interfaceIndex);
    args[3] = Integer::New(errorCode);
    args[4] = stringOrUndefined(hostname);
    args[5] = String::Empty();
    char ip[INET6_ADDRSTRLEN];
    struct sockaddr_in *a4;
    struct sockaddr_in6 *a6;
    switch (address->sa_family) {
        case AF_INET6:
            a6 = (struct sockaddr_in6*)(address);
            inet_ntop(AF_INET6, &(a6->sin6_addr), ip, INET6_ADDRSTRLEN);
            args[5] = String::New(ip);
            break;
        case AF_INET:
            a4 = (struct sockaddr_in*)(address);
            inet_ntop(AF_INET, &(a4->sin_addr), ip, INET6_ADDRSTRLEN);
            args[5] = String::New(ip);
            break;
        default:
            break;
    }

    args[6] = Integer::New(ttl);

    if (serviceRef->GetContext().IsEmpty()) {
        args[7] = Local<Value>::New(Undefined());
    } else {
        args[7] = Local<Value>::New(serviceRef->GetContext());
    }
    callback->Call(this_, argc, args);
}

Handle<Value>
DNSServiceGetAddrInfo(Arguments const& args) {
    HandleScope scope;

    if (argumentCountMismatch(args, 7)) {
        return throwArgumentCountMismatchException(args, 7);
    }

    if ( ! ServiceRef::HasInstance(args[0])) {
        return throwTypeError("argument 1 must be a DNSServiceRef (sdRef)");
    }
    ServiceRef * serviceRef = ObjectWrap::Unwrap<ServiceRef>(args[0]->ToObject());
    if (serviceRef->IsInitialized()) {
        return throwError("DNSServiceRef is already initialized");
    }

    if ( ! args[1]->IsInt32()) {
        return throwError("argument 2 must be an integer (DNSServiceFlags)");
    }
    DNSServiceFlags flags = args[1]->ToInteger()->Int32Value();

    if ( ! args[2]->IsUint32() && ! args[2]->IsInt32()) {
       return throwTypeError("argument 3 must be an integer (interfaceIndex)");
    }
    uint32_t interfaceIndex = args[2]->ToInteger()->Uint32Value();

    if ( ! args[3]->IsInt32()) {
        return throwTypeError("argument 4 must be an integer (DNSServiceProtocol)");
    }
    uint32_t protocol = args[3]->ToInteger()->Int32Value();

    if ( ! args[4]->IsString()) {
        return throwTypeError("argument 5 must be a string (hostname)");
    }
    String::Utf8Value hostname(args[4]->ToString());

    if ( ! args[5]->IsFunction()) {
        return throwTypeError("argument 6 must be a function (callBack)");
    }
    serviceRef->SetCallback(Local<Function>::Cast(args[5]));

    if ( ! args[6]->IsNull() && ! args[6]->IsUndefined()) {
        serviceRef->SetContext(args[6]);
    }

    DNSServiceErrorType error = DNSServiceGetAddrInfo( & serviceRef->GetServiceRef(),
            flags, interfaceIndex, protocol, *hostname, OnAddressInfo, serviceRef);

    if (error != kDNSServiceErr_NoError) {
        return throwMdnsError(error);
    }
    if ( ! serviceRef->SetSocketFlags()) {
        return throwError("Failed to set socket flags (O_NONBLOCK, FD_CLOEXEC)");
    }

    return Undefined();
}

#endif // HAVE_DNSSERVICEGETADDRINFO

} // end of namespace node_mdns
