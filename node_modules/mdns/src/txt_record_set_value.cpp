#include "mdns.hpp"

#include <node_buffer.h>

#include "mdns_utils.hpp"
#include "txt_record_ref.hpp"

using namespace v8;
using namespace node;

namespace node_mdns {

size_t length(Handle<Value> v) {
    if (v->IsString()) {
        return v->ToString()->Utf8Length();
    } else if (Buffer::HasInstance(v)) {
        return Buffer::Length(v->ToObject());
    } else {
        return 0;
    }
}

Handle<Value>
TXTRecordSetValue(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 3)) {
        return throwArgumentCountMismatchException(args, 3);
    }
    if ( ! args[0]->IsObject() || ! TxtRecordRef::HasInstance(args[0]->ToObject())) {
        return throwTypeError("argument 1 must be a TXTRecordRef object");
    }
    TxtRecordRef * ref = ObjectWrap::Unwrap<TxtRecordRef>(args[0]->ToObject());

    if ( ! args[1]->IsString()) {
        return throwTypeError("argument 1 must be a string (key)");
    }
    String::Utf8Value key(args[1]);
    
    if ( ! (args[2]->IsNull() || args[2]->IsUndefined() ||
        Buffer::HasInstance(args[2]) || args[2]->IsString())) {
        return throwTypeError("argument 1 must be null, undefined, a buffer or a string (value)");
    }
    DNSServiceErrorType code = TXTRecordSetValue( & ref->GetTxtRecordRef(), *key,
            length(args[2]),
            ((args[2]->IsNull()||args[2]->IsUndefined()) 
                ? NULL : args[2]->IsString() ? *String::Utf8Value(args[2]->ToString()) : Buffer::Data(args[2]->ToObject())));

    if (code != kDNSServiceErr_NoError) {
        return throwMdnsError(code);
    }
    return Undefined();
}

} // end of namespace node_mdns
