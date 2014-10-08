#include "mdns.hpp"

#include <node_buffer.h>

#include "mdns_utils.hpp"
#include "txt_record_ref.hpp"

using namespace v8;
using namespace node;

namespace node_mdns {

Handle<Value>
TXTRecordCreate(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 2)) {
        return throwArgumentCountMismatchException(args, 2);
    }
    if ( ! args[0]->IsObject() || ! TxtRecordRef::HasInstance(args[0]->ToObject())) {
        return throwTypeError("argument 1 must be a TXTRecordRef object");
    }

    void * buffer = NULL;
    uint16_t buffer_length = 0;
    if ( ! args[1]->IsUndefined() && ! args[1]->IsNull()) {
        if ( ! args[1]->IsObject() || ! Buffer::HasInstance(args[1]->ToObject())) {
            return throwTypeError("argument 1 must be a buffer");
        }
        Local<Object> buffer_object = args[1]->ToObject();
        buffer = Buffer::Data(buffer_object);
        buffer_length = Buffer::Length(buffer_object);
    }

    TxtRecordRef * ref = ObjectWrap::Unwrap<TxtRecordRef>(args[0]->ToObject());
    TXTRecordCreate( & ref->GetTxtRecordRef(), buffer_length, buffer);
    return Undefined();
}

} // end of namespace node_mdns
