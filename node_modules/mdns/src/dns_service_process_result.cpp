#include "mdns.hpp"

#include <v8.h>

#include "mdns_utils.hpp"
#include "dns_service_ref.hpp"

using namespace v8;
using namespace node;

namespace node_mdns {

Handle<Value>
DNSServiceProcessResult(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 1)) {
        return throwArgumentCountMismatchException(args, 1);
    }
    if ( ! args[0]->IsObject()) {
        return throwTypeError("argument 1 must be a DNSServiceRef object");
    }

    ServiceRef * ref = ObjectWrap::Unwrap<ServiceRef>(args[0]->ToObject());
    ref->SetThis(args.This());
    DNSServiceErrorType error = DNSServiceProcessResult(ref->GetServiceRef());
    if (error != kDNSServiceErr_NoError) {
        return throwMdnsError(error);
    }
    return Undefined();
}

} // end of namespace node_mdns
