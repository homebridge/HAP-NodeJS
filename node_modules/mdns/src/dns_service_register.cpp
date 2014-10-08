#include "mdns.hpp"

#include <limits>

#ifndef WIN32 // XXX
#include <arpa/inet.h>
#endif

#include <node_buffer.h>

#include "mdns_utils.hpp"
#include "dns_service_ref.hpp"
#include "txt_record_ref.hpp"

using namespace v8;
using namespace node;

namespace node_mdns {

static
void
DNSSD_API
OnServiceRegistered(DNSServiceRef sdRef, DNSServiceFlags flags,
        DNSServiceErrorType errorCode, const char * name,
        const char * serviceType, const char * domain, void * context)
{
    if ( ! context) return;

    HandleScope scope;
    ServiceRef * serviceRef = static_cast<ServiceRef*>(context);
    Handle<Function> callback = serviceRef->GetCallback();
    Handle<Object> this_ = serviceRef->GetThis();

    if ( ! callback.IsEmpty() && ! this_.IsEmpty()) {
        const size_t argc(7);
        Local<Value> args[argc];
        args[0] = Local<Object>::New(serviceRef->handle_);
        args[1] = Integer::New(flags);
        args[2] = Integer::New(errorCode);
        args[3] = stringOrUndefined(name);
        args[4] = stringOrUndefined(serviceType);
        args[5] = stringOrUndefined(domain);
        if (serviceRef->GetContext().IsEmpty()) {
            args[6] = Local<Value>::New(Undefined());
        } else {
            args[6] = Local<Value>::New(serviceRef->GetContext());
        }
        callback->Call(this_, argc, args);
    }
}

Handle<Value>
DNSServiceRegister(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 11)) {
        return throwArgumentCountMismatchException(args, 11);
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

    bool has_name = false;
    if ( ! args[3]->IsNull() && ! args[3]->IsUndefined()) {
        if ( ! args[3]->IsString()) {
            return throwTypeError("argument 4 must be a string (name)");
        }
        has_name = true;
    }
    String::Utf8Value name(args[3]);

    if ( ! args[4]->IsString()) {
        return throwTypeError("argument 5 must be a string (service type)");
    }
    String::Utf8Value serviceType(args[4]->ToString());

    bool has_domain = false;
    if ( ! args[5]->IsNull() && ! args[5]->IsUndefined()) {
        if ( ! args[5]->IsString()) {
            return throwTypeError("argument 6 must be a string (domain)");
        }
        has_domain = true;
    }
    String::Utf8Value domain(args[5]);

    bool has_host = false;
    if ( ! args[6]->IsNull() && ! args[6]->IsUndefined()) {
        if ( ! args[6]->IsString()) {
            return throwTypeError("argument 7 must be a string (host)");
        }
        has_host = true;
    }
    String::Utf8Value host(args[6]);

    if ( ! args[7]->IsInt32()) {
        return throwTypeError("argument 8 must be an integer (port)");
    }
    int raw_port = args[7]->ToInteger()->Int32Value();
    if (raw_port > std::numeric_limits<uint16_t>::max() || raw_port < 0) {
        return throwError("argument 8: port number is out of bounds.");
    }
    uint16_t port = static_cast<uint16_t>(raw_port);

    uint16_t txtLen(0);
    const void * txtRecord(NULL);
    if ( ! args[8]->IsNull() && ! args[8]->IsUndefined()) {
        if (Buffer::HasInstance(args[8])) {
            Local<Object> bufferObject = args[8]->ToObject();
            txtRecord = Buffer::Data(bufferObject);
            txtLen = Buffer::Length(bufferObject);
        } else if (TxtRecordRef::HasInstance(args[8])) {
            TxtRecordRef * ref = ObjectWrap::Unwrap<TxtRecordRef>(args[8]->ToObject());
            txtLen = TXTRecordGetLength( & ref->GetTxtRecordRef());
            txtRecord = TXTRecordGetBytesPtr( & ref->GetTxtRecordRef());
        } else {
            return throwTypeError("argument 9 must be a buffer or a dns_sd.TXTRecordRef");
        }
    }

    if ( ! args[9]->IsNull() && ! args[9]->IsUndefined()) {
        if ( ! args[9]->IsFunction()) {
            return throwTypeError("argument 10 must be a function (callBack)");
        }
        serviceRef->SetCallback(Local<Function>::Cast(args[9]));
    }

    if ( ! args[10]->IsNull() && ! args[10]->IsUndefined()) {
        serviceRef->SetContext(args[10]);
    }

    // eleven arguments ... srsly?
    DNSServiceErrorType error = DNSServiceRegister(
            & serviceRef->GetServiceRef(),
            flags,
            interfaceIndex,
            has_name ? * name : NULL,
            *serviceType,
            has_domain ? * domain : NULL,
            has_host ? * host : NULL,
            htons(port),
            txtLen,
            txtRecord,
            args[9]->IsFunction() ? OnServiceRegistered : NULL,
            serviceRef);
    if (error != kDNSServiceErr_NoError) {
        return throwMdnsError(error);
    }
    if ( ! serviceRef->SetSocketFlags()) {
        return throwError("Failed to set socket flags (O_NONBLOCK, FD_CLOEXEC)");
    }
    return Undefined();
}

} // end of namespace node_mdns
