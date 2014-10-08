#include "mdns.hpp"

#include "mdns_utils.hpp"
#include "txt_record_ref.hpp"

using namespace v8;
using namespace node;

namespace node_mdns {

Handle<Value>
TXTRecordGetLength(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 1)) {
        return throwArgumentCountMismatchException(args, 1);
    }
    if ( ! args[0]->IsObject() || ! TxtRecordRef::HasInstance(args[0]->ToObject())) {
        return throwTypeError("argument 1 must be a buffer (txtRecord)");
    }
    TxtRecordRef * ref = ObjectWrap::Unwrap<TxtRecordRef>(args[0]->ToObject());
    uint16_t result = ::TXTRecordGetLength( & ref->GetTxtRecordRef());
    return scope.Close(Integer::New(result));
}

} // end of namespace node_mdns
